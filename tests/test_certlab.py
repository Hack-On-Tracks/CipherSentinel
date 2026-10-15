import importlib.util
import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "certlab" / "enroll.py"
SPEC = importlib.util.spec_from_file_location("certlab_enroll", SCRIPT)
enroll = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(enroll)


@unittest.skipUnless(shutil.which("openssl"), "OpenSSL is required for certificate integration checks")
class CertificateLabTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.old_inventory = enroll.INVENTORY
        enroll.INVENTORY = self.root / "inventory.json"
        enroll.INVENTORY.write_text((SCRIPT.parent / "inventory.json").read_text())

    def tearDown(self):
        enroll.INVENTORY = self.old_inventory
        self.temp.cleanup()

    def openssl(self, *args):
        return subprocess.run(["openssl", *map(str, args)], check=True, capture_output=True, text=True)

    def test_inventory_has_four_distinct_pending_devices_and_no_secrets(self):
        inventory = enroll.load_inventory()
        devices = inventory["devices"]
        self.assertEqual(len(devices), 4)
        self.assertEqual(len({d["device_id"] for d in devices}), 4)
        self.assertEqual({d["organization_id"] for d in devices}, {"ORG-A", "ORG-B"})
        self.assertTrue(all(d["enrollment_status"] == "pending" for d in devices))
        content = json.dumps(inventory).lower()
        self.assertNotIn("private_key", content)
        self.assertNotIn("passphrase", content)
        self.assertNotIn("-----begin", content)

    def test_distinct_cas_issue_org_specific_client_certificates(self):
        roots = {}
        for org, device_id in (("ORG-A", "ORG-A-DEVICE-001"), ("ORG-B", "ORG-B-DEVICE-001")):
            key = self.root / f"{org}.key"
            csr = self.root / f"{org}.csr"
            root = self.root / f"{org}.crt"
            cert = self.root / f"{org}-client.crt"
            self.openssl("genpkey", "-algorithm", "RSA", "-pkeyopt", "rsa_keygen_bits:2048", "-out", key)
            self.openssl("req", "-new", "-x509", "-key", key, "-days", "5", "-subj", f"/O=CipherSentinel/{org}/CN={org}-CA", "-addext", "basicConstraints=critical,CA:TRUE", "-addext", "keyUsage=critical,keyCertSign,cRLSign", "-out", root)
            device_key = self.root / f"{device_id}.key"
            self.openssl("genpkey", "-algorithm", "EC", "-pkeyopt", "ec_paramgen_curve:P-256", "-out", device_key)
            self.openssl("req", "-new", "-key", device_key, "-subj", f"/O={org}/CN={device_id}", "-out", csr)
            ext = self.root / f"{org}.ext"
            ext.write_text("basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=clientAuth\n")
            serial = self.root / f"{org}.srl"
            self.openssl("x509", "-req", "-in", csr, "-CA", root, "-CAkey", key, "-CAserial", serial, "-CAcreateserial", "-days", "2", "-sha256", "-extfile", ext, "-out", cert)
            roots[org] = (root, cert)
            self.assertIn("OK", self.openssl("verify", "-purpose", "sslclient", "-CAfile", root, cert).stdout)
            self.assertIn("TLS Web Client Authentication", self.openssl("x509", "-in", cert, "-noout", "-ext", "extendedKeyUsage").stdout)
        self.assertNotEqual(roots["ORG-A"][0].read_bytes(), roots["ORG-B"][0].read_bytes())
        self.assertNotEqual(enroll.cert_fields(roots["ORG-A"][1])["serial"], enroll.cert_fields(roots["ORG-B"][1])["serial"])
        with self.assertRaises(subprocess.CalledProcessError):
            self.openssl("verify", "-purpose", "sslclient", "-CAfile", roots["ORG-A"][0], roots["ORG-B"][1])

    def test_missing_openssl_is_reported_as_unsupported(self):
        with patch.object(enroll.shutil, "which", return_value=None):
            with self.assertRaisesRegex(enroll.EnrollmentError, "OpenSSL is required"):
                enroll.require_openssl()


if __name__ == "__main__":
    unittest.main()
