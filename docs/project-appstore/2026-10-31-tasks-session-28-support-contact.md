# Session 28 — Support contact clarity

Date: 2026-10-31. Task: WK-26. Base:
`e230784434be07926b40217cc89e7758f8597e95`.
Branch: `codex/support-contact-clarity`.
Source worktree:
`/Users/chrisbremer/code/specdown/.claude/worktrees/specdown-support-contact-20261031`.

## Report and observed behavior

The owner reported that the GitHub link on
<https://specdown.mosaicpando.com/support.html> went nowhere. Public-browser
checks of the actual link succeeded while signed out, both at desktop width
and at a 440 × 956 viewport. The destination was the public GitHub Issues page;
the New issue link led to GitHub login. No login was performed.

The investigation did not reproduce a dead URL, private repository, 404 or
native navigation block. Read-only iOS source inspection found that About uses
the public HTTPS support URL and delegates external HTTPS navigation to the
system browser. This source inspection is not physical-device acceptance.

The support page at the owner phone revision `e7b842b` and base `e230784` is
byte-identical. Main `681d952` has the same Contact destinations but lacks the
candidate's download section and has older image guidance. The Contact change
does not alter those separate differences.

## Scoped change

- Make the existing public `support@mosaicpando.com` address the first reporting
  route, with visible text that can also be copied.
- Retain the working Issues URL as **Browse GitHub issues** and explain that a
  GitHub account is required to report an issue there.
- Replace the support metadata draft's `[SUPPORT EMAIL]` placeholder with the
  same existing address and contact wording.

Download links, other support-page copy, styling, native code, app behavior,
dependencies and version declarations are unchanged. This clarifies how to
request help; it does not establish that an intermittent failure was reproduced
or resolved, and it does not verify mailbox delivery.

## Validation and handoff

The existing CI-style coverage suite passes: **1,128 tests / 67 suites**, with
roots limited to `./tests` and the required desktop coverage gates satisfied.
Lint, typecheck, production build and diff checks pass. Formatting is limited
to the changed HTML Contact fragment and the two touched Markdown documents;
no new copy-only unit test is added.

The build has the same 110 output paths as the validated `e230784` baseline;
109 files are byte-identical and only `support.html` changes. The built support
page exactly matches its source, and all source HTML outside Contact remains
byte-identical to the base. Independent source review found the scoped copy and
preserved links correct.

The built candidate passes browser checks at **1280 × 720** and **440 × 956**:
both Contact paragraphs are readable without horizontal overflow, the email
and Issues destinations are unchanged, and clicking **Browse GitHub issues**
opens the public Issues page while signed out. The phone-sized screenshot was
visually inspected. No email was sent and no GitHub login was performed.

Logs, `browser-candidate.json`, `browser-support-phone.jpg` and the final
scope/hash manifest are retained under
`/Users/chrisbremer/code/specdown/ios/DerivedData/support-contact-20261031/`.
The signed-out public-link observations are recorded separately in
`ios/DerivedData/launch-followup-20261101-0422/support-link-browser.json`.
The loopback preview was stopped and the temporary dependency symlink removed
after validation. This independently reviewed preparation is one logical
commit; it does not deploy the website, change account settings, send email,
access Apple, sign or package an app, or modify the canonical owner phone checkout.
