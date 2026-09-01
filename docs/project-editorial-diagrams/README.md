# Project: Editorial diagrams in SpecDown

Explore whether SpecDown should become a **viewer** for
[diagram-design](https://github.com/cathrynlavery/diagram-design) output —
self-contained HTML + SVG editorial diagrams — without becoming a diagram
generator or abandoning Mermaid.

diagram-design is an agent skill (Claude Code, Codex, Factory Droid, Pi) that
*authors* finished diagrams. SpecDown is a markdown viewer that *presents*
diagrams. Those jobs don't overlap; the interesting question is the seam
between them.

## Timeline

| Date       | Doc                                                                                          | Summary                                                                                          |
| ---------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 2026-08-27 | [brainstorm-diagram-design](2026-08-27-brainstorm-diagram-design.md)                         | Frame the two products, reject generator-clone / Mermaid-replacement, recommend a viewer ladder |

## Current status

Brainstorm only — no code. Recommended next session, if we proceed: extract the
primary SVG from a dropped diagram-design `.html` file and wrap it in the
existing diagram chrome (expand → fullscreen, presentation, export). Do not
vendor the skill, do not execute motion scripts, do not retheme brand tokens.

## Naming conventions

Files follow `YYYY-MM-DD-<type>-<detail>.md` with types `brainstorm` / `spec` /
`tasks`. See [`../README.md`](../README.md).
