# Session 62: Make the Mac App Store explicit in launch copy

Date: 2026-11-01. Documentation-only continuation of Session 61.

## Request and changes

Chris requested that the copy make Mac App Store availability clear. The clean
[copy proposal](copy-proposal.html) now labels the Mac listing “Mac App Store,”
explicitly includes iPhone, iPad and Mac in the website and support App Store
calls to action, and presents the direct desktop download as a separate option
for Mac, Windows and Linux. Both Store links use the existing shared production
app record. No new app identity or download endpoint is introduced.

This is final proposed **launch copy**. Its Mac availability wording is intended
for publication when the native Mac App Store version is publicly available.
The prepared listing and submission fields remain proposals and dated records.
The current public README keeps its accurate preparation status.

## Availability evidence and publication gate

Local Sessions 52 and 55 establish Owner-only TestFlight build 229 and unsigned
replacement preparation 230; they do not establish public native Mac availability.
The [public Apple listing](https://apps.apple.com/au/app/specdown/id6822086808)
search on November 1 returned the iPhone/iPad product
with Apple-silicon compatibility, rather than evidence of the new native Mac
release. The US page and lookup endpoint could not be retrieved through the web
reader. This check therefore does not establish public native Mac availability.

The native Mac launch must be verified before adopting this copy on the public
website or support page. Do not treat an iPad app's Mac compatibility as evidence
that the separate native Mac platform has released. The root README, public-site
source, selected Store copy, version 230, native artifacts and Apple fields are
unchanged by this proposal.

## Validation

The change is restricted to the HTML proposal, this session and the project
index. Independent review verified the exact diff, retained metadata, correct shared
Store links and separate direct-download links. Browser inspection confirmed
readable download choices. Full 1,371 tests across 78 suites, lint and typecheck
passed. All 548 protected canonical-file hashes match the baseline. Signing, rebuilding, uploading and submission are outside this task.
