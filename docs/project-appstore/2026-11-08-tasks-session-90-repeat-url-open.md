# Session 90: open another URL in portrait

## Report and diagnosis

The owner reported that iOS portrait appeared limited to opening one URL.
The underlying tab model accepts multiple documents (up to ten). The earliest
failure is access to the next URL action: accepting the first URL hides the
welcome screen and its URL button, while both the compact Open control and the
tab bar's plus button went directly to the file picker. A collapsed or hidden
sidebar did not provide an obvious alternate URL route.

Regressions first demonstrated the missing Open choices after a successful URL
open, then the plus button's file-only route. These distinguish the UI failure
from document replacement or a one-URL storage limit.

## Change and validation plan

- Reuse the existing iOS action-sheet pattern for Open File / Open from URL.
- Offer those choices from both persistent Open and the tab bar's plus button.
- Reuse the existing native URL form and anchor its popover to the invoking
  control after the choices sheet closes. Preserve file opening and cancellation.
- Verify two actual URL tabs, switching back to each accepted document, and
  opening from a regular iPad layout where the compact action bar is hidden.
- Refresh local Dev 1.0.2 (238) and the unpublished direct-desktop candidate from
  the shared viewer. Preserve previous artifacts, owner data and signing settings.

## Evidence

- Both new routes failed before their corrections and passed afterwards.
- Shared suite: **88 suites / 1521 tests passed**, including the desktop coverage
  gate. Lint, strict JavaScript types and the shared production build passed.
- Native phone group: **11 passed**. Native iPad URL group: **3 passed**, including
  the plus route with the compact action bar hidden, two accepted URL tabs and
  switching back to both documents. These are real WK/native tests using synthetic
  network responses, not physical-device acceptance.
- An additional iPad run confirms the URL choice lies inside the visual viewport
  before capturing the rendered Open menu. The original immediate window drawing
  captured a transition; the test now waits for visibility and uses WebKit's
  snapshot callback. One retry was needed after Simulator rejected the runner as
  busy before executing tests; the subsequent visibility test passed.
- Signed iOS Dev **1.0.2 (238)** passed strict signature, channel and bundled-file
  verification. Both physical mobile devices installed it successfully and report
  the expected native version/build. Their existing data was preserved.
- Signed Store Dev 238 and an unpublished direct-desktop Mac candidate were built.
  Each contains the same **110** viewer files and **20** desktop source files as
  the current source. The direct candidate remains unsigned and uninstalled.
  After the owner unlocked the Mac, Dev 238 replaced Dev 237 through normal
  quit/relaunch. Strict signature and installed-byte comparisons passed; About
  visibly showed **SpecDown — Development**, **Version 1.0.2 (build 238)**.
  The previous Dev 237 app and existing app data were preserved. All three local
  Dev installs are now aligned at 238.
- Private manifests, checks and installation receipts are retained under
  `ios/DerivedData/wave-102-local-dev-238/`.

## Owner check

After opening the first URL, tap **Open** or the tab bar's **+**, then **Open from
URL…**. Open another URL and switch between the two tabs. The iPad's native
sidebar URL command remains available in expanded layouts.
