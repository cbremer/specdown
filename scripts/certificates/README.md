# Public certificate for the desktop credential probe

`DeveloperIDG2CA.cer` is Apple's public **Developer ID Certification Authority G2**
intermediate certificate. It contains no private key or account credential.

- Source: <https://www.apple.com/certificateauthority/DeveloperIDG2CA.cer>
- Retrieved and independently checked November 3, 2026.
- DER size: 1,090 bytes.
- SHA-256: `f16cd3c54c7f83cea4bf1a3e6a0819c8aaa8e4a1528fd144715f350643d2df3a`.
- The bytes also match certificate 1 extracted from the retained signed regular
  desktop 0.0.232 application. The existing leaf-certificate pin is unchanged.

The validation helper checks this exact hash before any credential import. It
imports a verified copy only into its disposable keychain, and only when that
same certificate is absent. It never imports a root, changes certificate trust,
downloads a certificate at runtime, or installs this certificate on the owner's
Mac. Future certificate changes need a reviewed source change and independent
public provenance verification.
