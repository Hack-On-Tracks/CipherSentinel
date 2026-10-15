# FreeRADIUS EAP-TLS template

This is a configuration guide, not an active server configuration. No RADIUS
server or compatible 802.1X access point was detected/configured as part of the
lab. Do not copy this template into a production server without adapting paths,
client secrets, firewall rules, and policy to that environment.

After provisioning a server certificate and the two CA certificates, configure
the EAP module for `tls`, set `ca_file` to a bundle containing only the
organization CA(s) that policy explicitly trusts, and set the server
certificate/key paths. Use separate policy branches for the two issuers. For
Organization A access, authorize only identities whose verified issuer is
`ORG-A-CA` and whose certificate SAN/CN matches an active inventory device ID
in `ORG-A`. Reject Organization B by default. Do not authorize by CN text
alone; validate the chain and certificate status first.

Recommended policy behavior:

- Reject unknown, expired, not-yet-valid, revoked, or untrusted certificates.
- Keep Organization B's root out of the Organization A trust policy.
- Log timestamp, result, device ID, issuer, and a session identifier. Avoid
  logging private material or full authentication payloads.
- Enable CRL checking only after publishing and testing a current CRL; local
  inventory revocation alone does not make RADIUS reject a certificate.
- Verify EAP-TLS with an actual compatible AP/switch and a test client before
  claiming enforcement.

Consult the installed FreeRADIUS version's documentation for its exact
`mods-enabled/eap` syntax. This lab intentionally does not edit system files,
open firewall ports, or restart a system daemon.
