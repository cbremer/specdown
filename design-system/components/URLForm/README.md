# URLForm

Open from URL form: native SwiftUI form, shown as a popover on iPad (420×340) and a page sheet on iPhone.

**Source:** `NativeURLInputForm` in `ios/SpecDown/ContentView.swift`. Static rendition.

- `Form` with a single URL field (keyboard `.URL`, no autocapitalization or autocorrection, submit label Go), focused on appear.
- The header reads "URL". The footer explains HTTPS Markdown and public GitHub repositories.
- Toolbar: Cancel (cancellation) and Open (confirmation, disabled while empty or loading). Loading shows `ProgressView("Opening…")`.
- Errors appear in red below the field and are announced to VoiceOver. The message says what to do next.
