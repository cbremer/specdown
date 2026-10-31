#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
test_dir="$(mktemp -d "${TMPDIR:-/tmp}/specdown-ios-security.XXXXXX")"
trap 'rm -rf "$test_dir"' EXIT

swiftc -warnings-as-errors \
  -module-cache-path "$test_dir/module-cache" \
  "$repo_dir/ios/SpecDown/SecurityPolicy.swift" \
  "$repo_dir/tests/native/SecurityPolicyTests.swift" \
  -o "$test_dir/security-policy-tests"
"$test_dir/security-policy-tests"
