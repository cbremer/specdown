# Session 36 — public Mac provisioning summary

November 1, 2026. The owner registered the current test Mac and completed the requested Mac development and Mac App Store profile setup with existing signing identities. Private profile files, their storage locations, account-specific identifiers and key material remain outside Git.

The existing direct-download desktop product is retained: it uses `com.specdown.desktop` and its own update feed. The Store product uses `com.mosaicpando.specdown`, matching the production iOS identity. These are separate packaging channels from the same reviewed source.

This historical provisioning setup does not establish that a later build is signed, sandbox-tested, uploaded or accepted. Subsequent sessions record those gates for each exact artifact. Build 229 remains historical Owner-only TestFlight evidence; current 1.0.1 (230) still needs its own distribution and physical acceptance.

The raw owner session is preserved locally. This public counterpart intentionally omits profile filenames/directories, certificate selection details and private recovery logistics. See the [publication inventory](2026-11-01-publication-inventory.json).
