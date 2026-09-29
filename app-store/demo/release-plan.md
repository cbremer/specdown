# Release Plan

Plan the work, then share it — Gantt charts render right in your notes.

```mermaid
gantt
    title Version 2.0
    dateFormat YYYY-MM-DD
    section Design
    Research        :done,    d1, 2026-01-05, 10d
    Prototypes      :done,    d2, after d1, 12d
    section Build
    Core features   :active,  b1, after d2, 20d
    Polish          :         b2, after b1, 10d
    section Launch
    Beta            :         l1, after b2, 7d
    Release         :milestone, l2, after l1, 0d
```

## Milestones

1. **Design complete** — prototypes signed off
2. **Feature freeze** — only fixes after this point
3. **Release** — ship it
