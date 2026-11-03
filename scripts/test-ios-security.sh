#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
test_dir="$(mktemp -d "${TMPDIR:-/tmp}/specdown-ios-security.XXXXXX")"
trap 'rm -rf "$test_dir"' EXIT

swiftc -warnings-as-errors \
  -module-cache-path "$test_dir/module-cache" \
  "$repo_dir/ios/SpecDown/SecurityPolicy.swift" \
  "$repo_dir/ios/SpecDown/DocumentLoadAcceptance.swift" \
  "$repo_dir/tests/native/SecurityPolicyTests.swift" \
  -o "$test_dir/security-policy-tests"
"$test_dir/security-policy-tests"

swiftc -warnings-as-errors \
  -module-cache-path "$test_dir/module-cache" \
  "$repo_dir/ios/SpecDown/AppIconCatalog.swift" \
  "$repo_dir/tests/native/AppIconCatalogTests.swift" \
  -o "$test_dir/app-icon-catalog-tests"
"$test_dir/app-icon-catalog-tests"

swiftc -warnings-as-errors \
  -module-cache-path "$test_dir/module-cache" \
  "$repo_dir/ios/SpecDown/RecentDocuments.swift" \
  "$repo_dir/ios/SpecDown/DocumentDeliveryQueue.swift" \
  "$repo_dir/ios/SpecDown/DocumentLoadAcceptance.swift" \
  "$repo_dir/tests/native/RecentDocumentsTests.swift" \
  -o "$test_dir/recent-documents-tests"
"$test_dir/recent-documents-tests"

swiftc -warnings-as-errors \
  -module-cache-path "$test_dir/module-cache" \
  "$repo_dir/ios/SpecDown/DocumentResources.swift" \
  "$repo_dir/tests/native/DocumentResourcesTests.swift" \
  -o "$test_dir/document-resources-tests"
"$test_dir/document-resources-tests"

swiftc -warnings-as-errors \
  -module-cache-path "$test_dir/module-cache" \
  "$repo_dir/ios/SpecDown/DiagramExportFiles.swift" \
  "$repo_dir/tests/native/DiagramExportTests.swift" \
  -o "$test_dir/diagram-export-tests"
"$test_dir/diagram-export-tests"
