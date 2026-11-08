# URL entry design proposal

Status: the owner selected the iPhone focused sheet and iPad popover concepts.
The complete behavior below, including the Mac proposal, is ready for review.

## Problem and evidence

The owner's iPhone screenshot shows the keyboard open while the active URL
field is out of view. The welcome card remains prominent above it. The shared
start screen places URL entry below file and sample controls inside a centered,
scrollable card, within a viewport-constrained app shell. The precise focus,
scroll and keyboard-resize failure has not yet been reproduced and measured.

The goal is a familiar opening workflow whose input and actions remain visible,
with presentations appropriate to the available window space.

## Presentations

- **iPhone:** an Open from URL button presents the focused form as a sheet.
  This is the owner's selected phone concept.
- **iPad with an expanded layout:** Open from URL is available in the native
  sidebar and on the welcome screen. It presents a compact popover anchored to
  the invoking control. This is the owner's selected iPad concept, and the
  sidebar command also permits opening another link while reading a document.
- **Compact iPad windows:** use the sheet presentation when the popover cannot
  fit comfortably. Adapt to the window's available space rather than a device
  model or a hand-tuned keyboard offset.
- **Mac, including Store and direct desktop:** retain direct URL entry on the
  welcome screen. A popover or sheet would add an extra opening step where
  there is already room for the form. This remains the proposed Mac treatment.
- **Web:** retain inline entry and verify the existing responsive behavior. The
  new native presentations do not establish that the browser layout is correct.

## Shared task behavior

The form has a persistent URL label, a URL-appropriate keyboard, Open and Cancel
where the presentation needs dismissal. Keyboard submission invokes Open.
URL autocorrection and automatic capitalization are disabled.

Opening requires an explicit submission. The form does not automatically read
the clipboard or start a request when a URL is pasted. It continues to support
the existing HTTPS Markdown and public GitHub repository/branch/folder flows.

Invalid input and loading failures retain the entered URL and display the
problem beside the field. Loading has a visible state and prevents duplicate
submission. Cancel dismisses the task, cancels pending work and preserves the
current document; a late result cannot replace a newer document.

For a repository URL, successful resolution continues into the existing file
chooser. For a document URL, successful acceptance opens the document. Avoid
stacking the URL form and repository chooser as competing modal surfaces.

## Alternatives considered

The phone's scrollable-homepage alternative kept direct entry but retained more
competing welcome content during typing; the owner chose the focused sheet.
The expanded iPad's inline alternative used its extra room but did not provide
the same dedicated sidebar opening command; the owner preferred the popover.
The proposed Mac treatment keeps its existing direct-entry affordance.

## Acceptance before shipping

Reproduce and measure the original iPhone focus failure before implementation.
Use standard keyboard avoidance and scrollable form behavior; keep the active
field, submission action and validation feedback visible without hiding
unrelated controls or adding device-specific positioning offsets.

Verify phone/tablet portrait and landscape, compact iPad windows, docked and
floating keyboards, hardware-keyboard submission, larger text and VoiceOver.
Check cancellation, invalid URLs, loading failures, repository selection and
document-switch races. Separately check Mac inline entry and browser behavior.
Existing document opening, Find, themes and safe-area behavior need to remain
usable after the keyboard closes.

The reviewed mockups establish the intended interaction, not a runtime fix or
physical-device acceptance. Implementation and refreshed Dev builds follow
approval of this proposal.
