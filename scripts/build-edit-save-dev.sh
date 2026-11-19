#!/bin/sh
# Local Dev artifacts only. Requires installed npm dependencies and the current
# generated Xcode project with owner signing settings already retained.
set -eu
cd "$(dirname "$0")/.."
scripts/build-mobile.sh dev simulator MARKETING_VERSION=1.0.4 CURRENT_PROJECT_VERSION=251
version=$(node -p "require('./package.json').version")
rg -Fq "$version" markdown-viewer/dist/assets
CSC_IDENTITY_AUTO_DISCOVERY=false node_modules/.bin/electron-builder --config electron-builder.dev.js --mac dir --arm64 --publish never
if [ "${1:-}" = '--run' ]; then
  open -n 'dist/development-edit-save/mac-arm64/SpecDown Dev.app'
fi
