# Session 87: align iPad Dev with Mac and iPhone 235

The owner requests iPad Dev 235 so all three local Dev installations use version
1.0.2 (235).

## Plan and scope

1. Verify runtime source and viewer assets against the retained Dev 235 manifests.
2. Preserve the generated Xcode project and change only Dev Debug's local build
   number from 234 to 235, retaining the Dev scheme and physical iPad destination.
3. Rebuild and run from Xcode, verify installed device metadata and package
   identity/content, then retain the iPad artifact and three-device checkpoint.

Runtime source matches the Mac/iPhone 235 snapshot, including the actual native
build and Development/Beta labels in About. All 110 viewer files match the 235
web manifest. No dependency install, web rebuild or project regeneration is
needed. This metadata-only alignment does not require repeating the unchanged
source suite; Session 86 retains its 87 suites / 1,510 passing tests and checks.

Other SpecDown instruction and security/release chats remain idle or not loaded.
Their work and the canonical checkout are outside this session's changes.

## Verification

Xcode's generated project was preserved privately before the build-number edit.
Xcode rebuilt and reported SpecDown Dev running on the physical iPad. Device
metadata independently confirms iPad and iPhone 1.0.2 (235); the installed Mac
Dev bundle also reports 1.0.2 (235). All three local Dev installations align.

The retained iPad artifact passed strict signature, Dev identity/profile
coverage, icon and all 110 viewer-file checks. A generated-project comparison
confirms the only setting change was Dev Debug's build number, 234 to 235.
The physical iPad About sheet was not inspected. App data was not reset.

Private evidence and the three-device checkpoint are retained under
`ios/DerivedData/wave-102-local-dev-235/ipad-refresh/`, with the parent
`BUILD-RECORD.json` updated to include the aligned iPad.
