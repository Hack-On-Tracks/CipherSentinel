# CipherSentinel certificate enrollment lab

This free lab provides separate OpenSSL trust roots for two organizations,
device-local key/CSR generation, administrator-controlled signing, public
certificate inventory, verification, and a revocation ledger. It does not
silently enroll devices or claim RADIUS enforcement.

## Inventory

The corrected inventory contains two Organization A devices and one external
Organization B device. Windows hostnames and OSes were supplied by the
requester and must be confirmed by their owners during enrollment. Hostname is
metadata only; the stable ID and validated certificate are the identity.

| Organization | Device ID | Hostname / label | OS | State |
|---|---|---|---|---|
| A | ORG-A-DEVICE-001 | LAPTOP-B4EE7HH6 | Windows | Certificate issued; owner verification pending |
| A | ORG-A-DEVICE-002 | LAPTOP-3PPEMVCS | Windows | Pending owner confirmation |
| B (external) | ORG-B-DEVICE-001 | Rainamishra-23 | Windows | Pending owner confirmation |

One Org A certificate has been issued, but it is not installed yet. The local
machine had OpenSSL 4.0.3, Python 3.15.0, and FreeRADIUS 3.2.10 available.
macOS 27.0.1 was detected. Wi-Fi is inactive and no compatible 802.1X access
point/switch was confirmed; no network hardware was changed.

## Prepare the administrator workspace

Run from the repository root. This creates encrypted CA private keys outside
source control. OpenSSL prompts interactively for a passphrase; choose a
unique strong passphrase for each CA and store it in the organization's
approved password manager. Never put it in a command, environment variable,
chat, or repository.

```sh
python3 certlab/enroll.py init-ca --org ORG-A
python3 certlab/enroll.py init-ca --org ORG-B
```

Keep `certlab/private/` on a protected administrator machine, back it up
encrypted, and restrict access. `certlab/.gitignore` excludes keys, CSRs,
issued certificates, and CA state. Do not sync this directory to a public
cloud drive.

## On each device (Windows PowerShell or macOS Terminal)

Get the assigned ID and organization from the administrator before beginning.
The command records the machine's real hostname/OS in the CSR metadata, checks
inventory duplicate identities, generates a private key locally, and writes a
CSR under the ignored `certlab/requests/` directory. The organization prompt
is a confirmation only; it does not grant membership.

```sh
python3 certlab/enroll.py request --org ORG-A --device-id ORG-A-DEVICE-002
```

Windows: install Python 3 and OpenSSL 3+ from trusted official distributions,
then run the same command in PowerShell as `python certlab/enroll.py ...`.
macOS: use the system Python 3 and an installed OpenSSL 3+ (`brew install
openssl` if needed). `openssl` must be on `PATH`.

Transfer only the `.csr` to the administrator over an approved authenticated
channel. Never transfer the `.key`. The administrator independently checks
device owner, organization, assigned ID, observed hostname/OS, and CSR before
signing. An owner cannot approve their own membership by entering an org name.

## Administrator signing and device verification

On the protected administrator machine, copy the CSR into
`certlab/requests/` and sign it only after approval. The command refuses
unknown IDs, duplicate CSRs, and already-enrolled identities; it prompts for
the encrypted CA key passphrase.

```sh
python3 certlab/enroll.py sign --org ORG-A --device-id ORG-A-DEVICE-002 --csr certlab/requests/ORG-A-DEVICE-002.csr
```

Return the signed `.crt` and the matching public CA `.crt` to the owner. On
the device, place them in the ignored `certlab/issued/` directory and run:

```sh
python3 certlab/enroll.py verify --org ORG-A --device-id ORG-A-DEVICE-002 --cert certlab/issued/ORG-A-DEVICE-002.crt --key certlab/requests/ORG-A-DEVICE-002.key
```

This checks CA chain, client-auth EKU, validity, subject device ID, key match,
and organization mapping. Only after successful verification should the owner
import the identity into the OS certificate store. macOS can import a PKCS#12
bundle with Keychain Access; Windows can import via the Current User
certificate store. This lab does not export private keys into PKCS#12 or invoke
privileged OS installation automatically. Keep the device private key local.
The owner/admin must confirm OS import and mark enrollment complete through an
approved process; do not mark it complete just because signing succeeded.
After importing and testing the certificate in the OS store, an administrator
can record that confirmation:

```sh
python3 certlab/enroll.py mark-installed --device-id ORG-A-DEVICE-002
```

## Inventory and lifecycle

`inventory.json` contains public metadata only. The Entities page reads it
through `GET /api/certificates/devices` and displays organization, device,
certificate, and enrollment status. Verification records serial, SHA-256
certificate and CA fingerprints, issuer, and validity. To
revoke a device, mark its inventory lifecycle state and preserve the reason
without personal details:

```sh
python3 certlab/enroll.py revoke --device-id ORG-A-DEVICE-002 --reason lost
```

For actual RADIUS rejection, publish an updated CRL and configure/test the
server's revocation checking. The local revocation ledger is not enforcement.
To replace a device, assign a new device ID or explicitly retire the old
record; never reuse a key. Cleanup removes generated lab material only after
review:

```sh
python3 certlab/enroll.py cleanup
```

The cleanup command requires typing `DELETE GENERATED LAB MATERIAL` and does
not delete inventory or source configuration.

## CipherSentinel / RADIUS integration

`inventory.json` contains public metadata only. The Entities page reads it
through `GET /api/certificates/devices` and displays organization, device,
certificate, and enrollment status. Verification records serial, SHA-256
certificate and CA fingerprints, issuer, and validity.

Use validated RADIUS accounting/authentication records to enrich flow records
with device ID, issuer, session ID, and authentication result. Treat IP address
as supporting evidence and keep user attribution `unknown` unless another
trusted source establishes it. No flow-to-RADIUS connector exists yet in this
repository, so this lab does not invent or infer user identity. See
`freeradius/README.md` for a clearly scoped EAP-TLS policy template.

## Current completion status

- Environment discovery and a three-device inventory are complete.
- `ORG-A-DEVICE-001` has a signed certificate. Its chain, identity, SAN, and
  public-key match to the submitted CSR were verified. The device owner still
  needs to verify against the local private key and install it; it is not
  marked enrolled.
- The Org A CA exists. The Org B CA and remaining device certificates are
  pending. The two remaining device owners must confirm actual hostnames and
  OSes and generate their own keys/CSRs.
- No compatible 802.1X hardware was confirmed. Real 802.1X enforcement is not
  verified; the current deliverable is an enrollment workflow and RADIUS lab
  guide, not an active network policy.
