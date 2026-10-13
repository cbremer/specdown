# Session 03: iOS 1.0 submitted; 1.1 backlog

**Date:** 2026-10-13. SpecDown 1.0 (build 11) submitted to App Review for iPhone/iPad
(manual release). Builds 2–10 superseded through TestFlight feedback and independent
Cursor, Codex and Grok reviews. Mac App Store lane continues separately (certificates
pending).

## 1.1 backlog (deferred from 1.0)

**Hidden in 1.0, to restore working on iOS**

- [ ] Recent files that reopen (save security-scoped bookmarks for picked/opened files; restore the iPad sidebar "Recent" and ⋮ → Open Recent).
- [ ] Touch-friendly annotations (Annotate toggle in the More sheet; create a note by long-press instead of double-click).
- [ ] Diagram SVG/PNG export and copy-link via the iOS share sheet (save to Files/Photos, send).

**iOS polish / correctness**

- [ ] iPad portrait: Viewer Actions sheet sits low when opened from the menu.
- [ ] Native file-error toast is dropped if the page hasn't loaded yet (cold start from Files onto an unreadable file) — queue it until `pageDidLoad`.
- [ ] Share sheet registers for all `public.plain-text`; consider narrowing to Markdown + common text types.
- [ ] Relative images (`./diagram.png`) don't resolve on iOS (document read into a string, origin `specdown://app`); support page now says so.
- [ ] GitHub repository URLs call the code-search API without a token and error; raw file URLs work.
- [ ] Print hands HTML to the system formatter, which loads remote images.
- [ ] Bookmarks keep a copy of the document in WebKit local storage (no file bookmark on iOS).

**Web / desktop**

- [ ] Annotations are keyed by filename only, so an unrelated `README.md` inherits another's notes — use stable document identities (Codex).

**Release process**

- [ ] Use the 0.0.x web patch number as the iOS build number (always increasing, no hand bumps).
- [ ] CI upload lane (App Store Connect API key `.p8`, archived in private-credentials) and align `ios-release.yml` with the 1.0 marketing version.

**If a backend (e.g. Supabase) is added later**

- [ ] Update App Privacy (data linked to the user), privacy policy, add in-app account deletion; Sign in with Apple if other third-party logins are offered; demo account in review notes.

## Owner follow-ups

- [ ] Optional: ask Apple Developer Support (Membership and Account → Account Information Update) to show "Christopher Bremer" / "Christopher M. Bremer" as the seller name; or convert to an Organization (LLC + D-U-N-S) later.
- [ ] Release 1.0 manually after approval.
- [ ] Mac App Store: register this Mac, create Mac Development + Mac App Store profiles, Apple Distribution + Mac Installer Distribution certificates (steps in the Mac session notes).
