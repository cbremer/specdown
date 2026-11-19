#!/bin/sh
# Local mobile build and retention entry point. Device products support both families.
set -eu
cd "$(dirname "$0")/.."
usage() {
  echo 'Usage: scripts/build-mobile.sh dev|beta|prod simulator|device|archive [MARKETING_VERSION=x] [CURRENT_PROJECT_VERSION=n]' >&2
  exit 2
}
[ "$#" -ge 2 ] || usage
channel=$1
kind=$2
shift 2
case "$channel" in
  dev) scheme='SpecDown Dev'; config='Dev Debug'; archive_config='Dev Release' ;;
  beta) scheme='SpecDown Beta'; config='Beta Debug'; archive_config='Beta Release' ;;
  prod) scheme='SpecDown'; config='Debug'; archive_config='Release' ;;
  *) usage ;;
esac
case "$kind" in
  simulator) destination='generic/platform=iOS Simulator'; sdk=iphonesimulator ;;
  device|archive) destination='generic/platform=iOS'; sdk=iphoneos ;;
  *) usage ;;
esac
for setting in "$@"; do
  case "$setting" in
    MARKETING_VERSION=*|CURRENT_PROJECT_VERSION=*) ;;
    *) usage ;;
  esac
done

npm run build
case "$channel/$kind" in
  dev/simulator) derived=ios/DerivedData/EditSaveDev ;;
  dev/device) derived=ios/DerivedData/EditSaveDevice ;;
  *) derived="ios/DerivedData/local-builds/$channel/$kind" ;;
esac
if [ "$kind" = archive ]; then
  mkdir -p "$derived/Archives"
  work=$(mktemp -d "$derived/Archives/build.XXXXXX")
  product="$work/SpecDown.xcarchive"
  xcodebuild -project ios/SpecDown.xcodeproj -scheme "$scheme" \
    -configuration "$archive_config" -destination "$destination" \
    -derivedDataPath "$derived" -archivePath "$product" "$@" archive
else
  if [ "$kind" = simulator ]; then set -- "$@" CODE_SIGNING_ALLOWED=NO; fi
  xcodebuild -project ios/SpecDown.xcodeproj -scheme "$scheme" -configuration "$config" \
    -destination "$destination" -derivedDataPath "$derived" "$@" build
  product="$derived/Build/Products/$config-$sdk/Specdown.app"
fi
exec python3 scripts/retain-build.py "$product"
