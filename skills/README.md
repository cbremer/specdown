# Codex skills

This directory contains repository-managed Codex skills. Review a skill's
instructions and scripts before installing it: installed skills guide local
agent actions. Copying a skill does not grant release or credential access.

To install on another machine, first check whether a local copy already exists.
Preserve any local customizations and compare them before replacing files:

```bash
mkdir -p ~/.codex/skills
diff -ru ~/.codex/skills/specdown-xcode skills/specdown-xcode # if already installed
# For a new installation only (stop if the destination already exists):
test ! -e ~/.codex/skills/specdown-xcode && cp -R skills/specdown-xcode ~/.codex/skills/
```

Restart or open a new Codex task after copying so the skill is discovered.
