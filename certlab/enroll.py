#!/usr/bin/env python3
"""Small, auditable OpenSSL-based device certificate enrollment helper."""

from __future__ import annotations

import argparse
import json
import os
import platform
import re
import shutil
import socket
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

BASE = Path(__file__).resolve().parent
INVENTORY = BASE / "inventory.json"
PRIVATE = BASE / "private"
REQUESTS = BASE / "requests"
ISSUED = BASE / "issued"
REVOKED = BASE / "revoked"
ORG_CA = {"ORG-A": "ORG-A-CA", "ORG-B": "ORG-B-CA"}


class EnrollmentError(Exception):
    pass


def load_inventory() -> dict:
    try:
        data = json.loads(INVENTORY.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise EnrollmentError(f"Cannot read inventory: {exc}") from exc
    ids = [d.get("device_id") for d in data.get("devices", [])]
    if len(ids) != len(set(ids)) or not all(ids):
        raise EnrollmentError("Inventory contains missing or duplicate device IDs")
    hostnames = [d.get("hostname", "").casefold() for d in data["devices"] if d.get("hostname")]
    if len(hostnames) != len(set(hostnames)):
        raise EnrollmentError("Inventory contains duplicate hostnames")
    return data


def save_inventory(data: dict) -> None:
    temp = INVENTORY.with_suffix(".json.tmp")
    temp.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    os.chmod(temp, 0o600)
    temp.replace(INVENTORY)


def device_by_id(data: dict, device_id: str) -> dict:
    matches = [d for d in data["devices"] if d["device_id"] == device_id]
    if len(matches) != 1:
        raise EnrollmentError(f"Device ID is not assigned in inventory: {device_id}")
    return matches[0]


def org_paths(org: str) -> tuple[Path, Path]:
    if org not in ORG_CA:
        raise EnrollmentError("Organization must be ORG-A or ORG-B")
    return PRIVATE / f"{ORG_CA[org]}.key", PRIVATE / f"{ORG_CA[org]}.crt"


def run(command: list[str], *, capture: bool = False) -> str:
    try:
        result = subprocess.run(command, check=True, text=True, capture_output=capture)
    except FileNotFoundError as exc:
        raise EnrollmentError("OpenSSL is required and must be available on PATH") from exc
    except subprocess.CalledProcessError as exc:
        detail = (exc.stderr or exc.stdout or "").strip()
        raise EnrollmentError(detail or f"Command failed: {Path(command[0]).name}") from exc
    return result.stdout.strip() if capture else ""


def require_openssl() -> None:
    if not shutil.which("openssl"):
        raise EnrollmentError("OpenSSL is required and must be available on PATH")


def initialize_ca(args: argparse.Namespace) -> None:
    require_openssl()
    key, cert = org_paths(args.org)
    if key.exists() or cert.exists():
        raise EnrollmentError(f"CA material already exists for {args.org}; refusing to overwrite")
    PRIVATE.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(PRIVATE, 0o700)
    name = ORG_CA[args.org]
    run(["openssl", "genpkey", "-algorithm", "RSA", "-aes-256-cbc", "-pkeyopt", "rsa_keygen_bits:3072", "-out", str(key)])
    os.chmod(key, 0o600)
    try:
        run(["openssl", "req", "-new", "-x509", "-key", str(key), "-sha256", "-days", "3650", "-subj", f"/O=CipherSentinel/{args.org}/CN={name}", "-addext", "basicConstraints=critical,CA:TRUE,pathlen:0", "-addext", "keyUsage=critical,keyCertSign,cRLSign", "-out", str(cert)])
    except EnrollmentError:
        key.unlink(missing_ok=True)
        raise
    os.chmod(cert, 0o644)
    print(f"Created encrypted {name} key and public CA certificate. Store the key backup securely.")


def request(args: argparse.Namespace) -> None:
    require_openssl()
    data = load_inventory()
    device = device_by_id(data, args.device_id)
    if device["organization_id"] != args.org:
        raise EnrollmentError("Assigned device organization does not match requested organization")
    if device.get("enrollment_status") != "pending" or device.get("certificate_serial"):
        raise EnrollmentError("Device is not pending; request a reissue through the administrator")
    host = socket.gethostname().rstrip(".")
    if any(d["device_id"] != args.device_id and d.get("hostname", "").casefold() == host.casefold() for d in data["devices"]):
        raise EnrollmentError(f"Observed hostname {host!r} duplicates another inventory record")
    observed_os = "macOS" if platform.system() == "Darwin" else platform.system()
    print(f"Observed hostname: {host}\nObserved OS: {observed_os} {platform.release()}")
    if input(f"Confirm assigned organization {args.org} and device ID {args.device_id}? [y/N] ").strip().lower() != "y":
        raise EnrollmentError("Owner confirmation was not provided")
    REQUESTS.mkdir(mode=0o700, parents=True, exist_ok=True)
    key, csr = REQUESTS / f"{args.device_id}.key", REQUESTS / f"{args.device_id}.csr"
    if key.exists() or csr.exists():
        raise EnrollmentError("A key or CSR already exists for this device; refusing to overwrite")
    run(["openssl", "genpkey", "-algorithm", "EC", "-pkeyopt", "ec_paramgen_curve:P-256", "-out", str(key)])
    os.chmod(key, 0o600)
    try:
        san = f"URI:urn:ciphersentinel:device:{args.device_id},DNS:{host}"
        run(["openssl", "req", "-new", "-key", str(key), "-subj", f"/O=CipherSentinel/{args.org}/CN={args.device_id}", "-addext", f"subjectAltName={san}", "-out", str(csr)])
    except EnrollmentError:
        key.unlink(missing_ok=True)
        raise
    os.chmod(csr, 0o600)
    device["hostname"] = host
    device["hostname_source"] = "observed-during-enrollment"
    device["os"] = f"{observed_os} {platform.release()}"
    device["enrollment_status"] = "csr-pending-admin-approval"
    save_inventory(data)
    print(f"Created local private key {key} and CSR {csr}. Transfer only the CSR to an authorized administrator.")


def sign(args: argparse.Namespace) -> None:
    require_openssl()
    data = load_inventory()
    device = device_by_id(data, args.device_id)
    if device["organization_id"] != args.org:
        raise EnrollmentError("Assigned device organization does not match signing organization")
    if device.get("enrollment_status") != "csr-pending-admin-approval":
        raise EnrollmentError("Device has no pending CSR in inventory")
    csr = Path(args.csr).resolve()
    if not csr.is_file():
        raise EnrollmentError(f"CSR not found: {csr}")
    subject = run(["openssl", "req", "-in", str(csr), "-noout", "-subject", "-nameopt", "RFC2253"], capture=True)
    if f"CN={args.device_id}" not in subject or f"O={args.org}" not in subject:
        raise EnrollmentError("CSR subject does not match approved device ID and organization")
    key, ca_cert = org_paths(args.org)
    if not key.is_file() or not ca_cert.is_file():
        raise EnrollmentError(f"Initialize {ORG_CA[args.org]} on the protected admin host first")
    if input(f"Administrator: approve {args.device_id} for {args.org} and sign this CSR? [y/N] ").strip().lower() != "y":
        raise EnrollmentError("Administrator approval was not provided")
    ISSUED.mkdir(mode=0o700, parents=True, exist_ok=True)
    dest = ISSUED / f"{args.device_id}.crt"
    serial = PRIVATE / f"{ORG_CA[args.org]}.srl"
    if dest.exists():
        raise EnrollmentError("Issued certificate already exists; refusing to overwrite")
    host = device.get("hostname", "")
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False) as f:
        f.write("basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=clientAuth\n")
        f.write(f"subjectAltName=URI:urn:ciphersentinel:device:{args.device_id},DNS:{host}\n")
        extfile = Path(f.name)
    try:
        run(["openssl", "x509", "-req", "-in", str(csr), "-CA", str(ca_cert), "-CAkey", str(key), "-CAserial", str(serial), "-CAcreateserial", "-days", "365", "-sha256", "-extfile", str(extfile), "-out", str(dest)])
    finally:
        extfile.unlink(missing_ok=True)
    os.chmod(dest, 0o644)
    print(f"Signed {dest}. The owner must verify the cert and install it before enrollment is considered complete.")


def cert_fields(cert: Path) -> dict:
    output = run(["openssl", "x509", "-in", str(cert), "-noout", "-serial", "-fingerprint", "-sha256", "-startdate", "-enddate", "-issuer", "-subject"], capture=True)
    return dict(line.split("=", 1) for line in output.splitlines() if "=" in line)


def verify(args: argparse.Namespace) -> None:
    require_openssl()
    data = load_inventory()
    device = device_by_id(data, args.device_id)
    if device["organization_id"] != args.org:
        raise EnrollmentError("Device organization mapping does not match the selected CA")
    cert, private_key = Path(args.cert).resolve(), Path(args.key).resolve()
    key, ca_cert = org_paths(args.org)
    if not cert.is_file() or not private_key.is_file() or not ca_cert.is_file():
        raise EnrollmentError("Certificate, device-local key, and public CA certificate are all required")
    run(["openssl", "verify", "-purpose", "sslclient", "-CAfile", str(ca_cert), str(cert)])
    subject = run(["openssl", "x509", "-in", str(cert), "-noout", "-subject", "-nameopt", "RFC2253"], capture=True)
    if f"CN={args.device_id}" not in subject or f"O={args.org}" not in subject:
        raise EnrollmentError("Certificate subject does not match device and organization")
    eku = run(["openssl", "x509", "-in", str(cert), "-noout", "-ext", "extendedKeyUsage"], capture=True)
    if "TLS Web Client Authentication" not in eku and "clientAuth" not in eku:
        raise EnrollmentError("Certificate does not have client-authentication EKU")
    cert_pub = run(["openssl", "x509", "-in", str(cert), "-pubkey", "-noout"], capture=True)
    key_pub = run(["openssl", "pkey", "-in", str(private_key), "-pubout"], capture=True)
    if cert_pub.strip() != key_pub.strip():
        raise EnrollmentError("Certificate does not match the provided device private key")
    fields = cert_fields(cert)
    device["certificate_serial"] = fields.get("serial")
    device["certificate_sha256"] = fields.get("sha256 Fingerprint", "").replace(":", "").lower()
    device["issuing_ca"] = ORG_CA[args.org]
    device["not_before"] = fields.get("notBefore")
    device["not_after"] = fields.get("notAfter")
    device["enrollment_status"] = "certificate-verified-install-pending"
    save_inventory(data)
    print(f"Certificate chain, identity, client-auth EKU, validity, and key match verified for {args.device_id}.")
    print("OS certificate-store installation is still pending; enrollment is not yet complete.")


def mark_installed(args: argparse.Namespace) -> None:
    data = load_inventory()
    device = device_by_id(data, args.device_id)
    if device.get("enrollment_status") != "certificate-verified-install-pending":
        raise EnrollmentError("Certificate must pass verify before installation can be recorded")
    if input(f"Confirm {args.device_id} was imported and tested in its OS certificate store? [y/N] ").strip().lower() != "y":
        raise EnrollmentError("Installation confirmation was not provided")
    device["enrollment_status"] = "enrolled"
    save_inventory(data)
    print(f"Recorded {args.device_id} as enrolled based on administrator confirmation.")


def revoke(args: argparse.Namespace) -> None:
    data = load_inventory()
    device = device_by_id(data, args.device_id)
    device["lifecycle_status"] = "revoked"
    device["revocation_reason"] = re.sub(r"[^a-zA-Z0-9 _-]", "", args.reason)[:80]
    device["revoked_at"] = datetime.now(timezone.utc).isoformat()
    save_inventory(data)
    REVOKED.mkdir(mode=0o700, parents=True, exist_ok=True)
    print(f"Updated local inventory for {args.device_id}. Configure and test an actual RADIUS CRL to enforce revocation on network access.")


def cleanup(_args: argparse.Namespace) -> None:
    if input("This removes generated CAs, CSRs, certificates, and revocation files. Type DELETE GENERATED LAB MATERIAL: ") != "DELETE GENERATED LAB MATERIAL":
        raise EnrollmentError("Cleanup confirmation did not match; nothing was removed")
    for folder in (PRIVATE, REQUESTS, ISSUED, REVOKED):
        if folder.exists():
            shutil.rmtree(folder)
    print("Generated lab material removed. Inventory and source configuration were preserved.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(required=True)
    p = sub.add_parser("init-ca", help="Create an encrypted organization CA")
    p.add_argument("--org", required=True, choices=sorted(ORG_CA))
    p.set_defaults(func=initialize_ca)
    p = sub.add_parser("request", help="Generate a device-local key and CSR")
    p.add_argument("--org", required=True, choices=sorted(ORG_CA))
    p.add_argument("--device-id", required=True)
    p.set_defaults(func=request)
    p = sub.add_parser("sign", help="Administrator approves and signs a pending CSR")
    p.add_argument("--org", required=True, choices=sorted(ORG_CA))
    p.add_argument("--device-id", required=True)
    p.add_argument("--csr", required=True)
    p.set_defaults(func=sign)
    p = sub.add_parser("verify", help="Verify a signed certificate on its device")
    p.add_argument("--org", required=True, choices=sorted(ORG_CA))
    p.add_argument("--device-id", required=True)
    p.add_argument("--cert", required=True)
    p.add_argument("--key", required=True)
    p.set_defaults(func=verify)
    p = sub.add_parser("mark-installed", help="Record owner-confirmed OS certificate import")
    p.add_argument("--device-id", required=True)
    p.set_defaults(func=mark_installed)
    p = sub.add_parser("revoke", help="Mark an inventory identity revoked")
    p.add_argument("--device-id", required=True)
    p.add_argument("--reason", required=True, choices=["lost", "retired", "compromised", "unenrolled"])
    p.set_defaults(func=revoke)
    p = sub.add_parser("cleanup", help="Remove generated lab material after typed confirmation")
    p.set_defaults(func=cleanup)
    args = parser.parse_args()
    try:
        args.func(args)
    except (EnrollmentError, OSError) as exc:
        print(f"Enrollment error: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
