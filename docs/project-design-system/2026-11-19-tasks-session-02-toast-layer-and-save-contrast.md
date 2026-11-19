# Session 02: toast layer and note editor Save contrast

Linear: ZIL-219, ZIL-220.

## Done

- [x] **ZIL-220:** raised `.toast-region` from z-index 10000 to 10030. Toasts sat under every dialog layer (10002 for shortcuts, file info, command palette and presentation; 10020 for Recent Files and Bookmarks), so a toast fired while one was open was hidden. Dialog layers are unchanged. Renaming them is ZIL-228.
- [x] **ZIL-219:** `.annotation-editor-save` now uses `var(--text-on-accent)` instead of `white`. Dark theme measured 2.1:1 before and 8.28:1 after. Light theme is unchanged, since `text-on-accent` is white there.
- [x] Added `tests/unit/cssLayeringContrast.test.js`. It fails on the previous stylesheet (both checks) and passes on the fix.
- [x] Checked in Chromium with the real `styles.css` and `bookmarks.css` in dark theme: the toast is the topmost element over a 10020 dialog, and Save measures 8.28:1.
- [x] Updated the design system (Toast, NoteEditor, RecentFilesDialog and Modal guidelines, `bundle.css` copy, `evolving.md`). Added Bookmarks, a tenth dialog the Session 01 inventory missed.
