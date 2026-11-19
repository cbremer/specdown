# Session 04: shared Modal and dialog accessibility

Linear: ZIL-230 (dialogs 1/3), ZIL-223 (dialog accessibility gaps).

## Done

- [x] **Shared Modal (Dialog variant) in the app.** `markdown-viewer/src/core/modal.js` (`createSdModal`) builds the scrim, panel, header (title and close button), body and optional footer. It wires Escape, the close button and a scrim click. Styles are the `.sd-*` block in `styles.css`.
- [x] **Shortcuts, About and File info** now use it: Shortcuts and About at size sm, File info at md. About keeps "Done" in the footer, and File info puts "Copy path" there (desktop only). Their one-off container styles are removed. Content styles (shortcut rows, file-info rows, About links) stay.
- [x] Each dialog is named by its visible title (`aria-labelledby`) instead of a hidden `aria-label`.
- [x] **ZIL-223:**
  - The iOS Contents and Viewer Actions sheets are now labelled `role="dialog"` / `aria-modal` surfaces, like the Open sheet. All iOS sheets close on Escape through their own close button and return focus to the opener.
  - The note editor traps Tab while open and returns focus to the opener.
  - The repo browser closes on Escape (it had no handler) and returns focus to the opener.
  - Focus is never returned to a text field, to avoid reopening the on-screen keyboard.
- [x] Tests:
  - Close button and scrim-click dismissal; dialog naming.
  - The Shortcuts focus trap now covers its close button.
  - iOS sheet roles, Escape and focus return.
  - Repo browser Escape and focus return.
  - Note editor Tab trap and focus return.
  - The 5 ZIL-223 checks fail on the previous code and pass on this one.
- [x] Checked the real app (Vite dev server, Chromium) in light and dark theme: all three dialogs render with the shared header and footer, Escape closes them, and the page reports no errors.
- [x] Design system: the Modal README marks the Dialog variant as shipped and documents `createSdModal`. The three dialog READMEs and previews use the shared markup, the copied rules in `bundle.css` are refreshed, the a11y notes for the iOS sheet, repo browser and note editor are updated, and `AGENTS.md` asks new dialogs to use the shared Modal.

## Not done

- Not tested on a device or in the native shells. The change is shared-viewer code that every surface loads.
- Recent files, Repo browser and Note editor still use their own styling (ZIL-231). The Sheet and Drawer variants are ZIL-232.
