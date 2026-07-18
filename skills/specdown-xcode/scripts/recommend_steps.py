#!/usr/bin/env python3
"""Recommend SpecDown iOS prep steps from a git diff range."""

from __future__ import annotations

import subprocess
import sys


def changed_paths(before: str, after: str) -> list[str]:
    result = subprocess.run(
        ["git", "diff", "--name-only", f"{before}..{after}"],
        check=True,
        text=True,
        stdout=subprocess.PIPE,
    )
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def matches(path: str, prefixes: tuple[str, ...] = (), names: tuple[str, ...] = ()) -> bool:
    return path in names or any(path.startswith(prefix) for prefix in prefixes)


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print("usage: recommend_steps.py <before-commit> <after-commit>", file=sys.stderr)
        return 2

    before, after = argv[1], argv[2]
    paths = changed_paths(before, after)

    deps = any(matches(p, names=("package.json", "package-lock.json")) for p in paths)
    web = any(
        matches(
            p,
            prefixes=("markdown-viewer/",),
            names=("vite.config.js", "package.json", "package-lock.json"),
        )
        for p in paths
    )
    xcodegen = any(matches(p, names=("ios/project.yml",)) for p in paths)
    ios_native = any(matches(p, prefixes=("ios/",)) for p in paths)
    ios_build = web or ios_native

    print(f"Changed files: {len(paths)}")
    for path in paths:
        print(f"- {path}")

    print("\nRecommended steps:")
    print(f"- npm install: {'yes' if deps else 'no'}")
    print(f"- npm run build: {'yes' if web else 'no'}")
    print(f"- xcodegen generate: {'yes' if xcodegen else 'no'}")
    print(f"- iOS simulator build: {'yes' if ios_build else 'optional'}")

    if not paths:
        print("\nReason: no changes between the provided commits.")
    elif xcodegen:
        print("\nReason: ios/project.yml changed, so regenerate SpecDown.xcodeproj.")
    elif web and not ios_native:
        print("\nReason: web assets changed; rebuild dist before running the iOS app. XcodeGen is not required.")
    elif ios_native:
        print("\nReason: iOS native files changed; XcodeGen is only required if ios/project.yml changed.")
    else:
        print("\nReason: changes do not affect the iOS app build inputs.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
