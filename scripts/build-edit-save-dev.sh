#!/bin/sh
# Local Dev artifacts only. Requires installed npm dependencies and the current
# generated Xcode project with owner signing settings already retained.
set -eu
cd "$(dirname "$0")/.."
npm run build
version=$(node -p "require('./package.json').version")
rg -Fq "$version" markdown-viewer/dist/assets
CSC_IDENTITY_AUTO_DISCOVERY=false node_modules/.bin/electron-builder --config electron-builder.dev.js --mac dir --arm64 --publish never
xcodebuild -project ios/SpecDown.xcodeproj -scheme 'SpecDown Dev' -configuration 'Dev Debug' -destination 'generic/platform=iOS Simulator' -derivedDataPath ios/DerivedData/EditSaveDev CODE_SIGNING_ALLOWED=NO MARKETING_VERSION=1.0.4 CURRENT_PROJECT_VERSION=245 build
if [ "${1:-}" = '--run' ]; then
  open -n 'dist/development-edit-save/mac-arm64/SpecDown Dev.app'
fi
