# Release Plan

Plan the work, then share it — Gantt charts render right in your notes.

```mermaid
gantt
%% specdown:brand
    title Document import release
    dateFormat YYYY-MM-DD
    section Design
    Research        :done,    d1, 2026-01-05, 10d
    File picker     :done,    d2, after d1, 12d
    section Build
    Word and PDF    :active,  b1, after d2, 20d
    Scan recognition:         b2, after b1, 10d
    section Launch
    Beta testing    :         l1, after b2, 7d
    Release         :milestone, l2, after l1, 0d
```

## Milestones

1. **Design complete** — prototypes signed off
2. **Feature freeze** — only fixes after this point
3. **Release** — ship it
