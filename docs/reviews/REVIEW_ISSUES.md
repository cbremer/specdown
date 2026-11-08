# Advisory review issues

## URL entry, 2026-11-08

Reviewer: Codex `url_entry_review`, completed. Reviewed base commit:
`c0ddabaea9c1cecfbcb6f20b0b05333e74bf3d21` plus the uncommitted URL candidate.
The preexisting About changes were excluded from this review.

| Concern | Proposed follow-up | Status |
| --- | --- | --- |
| P1: A native submit Task can start after immediate Cancel, before its JavaScript session exists. | Check controller/request ownership before calling JavaScript; cover submit followed synchronously by cancel. | Owner explicitly approved; reproduced by a failing native regression, fixed, and included in the passing 10-test native document group. |
| P2: The loader returns success when tab creation rejects at the tab limit or during document preparation. | Respect the acceptance result; keep the native URL/error visible and avoid a failed-open recent. | Owner explicitly approved; reproduced at ten tabs, fixed, and included in the passing 1518-test shared suite. |
| Keyboard visibility, compact iPad, large text and VoiceOver are not established by a window-containment assertion. | Record these as pending physical/manual acceptance until observed. | Evidence limitation recorded; no completed acceptance claimed. |
