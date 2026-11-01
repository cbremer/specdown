#!/usr/bin/env python3
"""Verify generated iOS channel configuration or an already-built app, offline.

Project mode checks the generated project's explicit settings and shared schemes,
not command-line/environment overrides or signing. App mode checks the actual
compiled Info.plist. Neither mode launches Xcode or reads signing credentials.
"""

import argparse
import hashlib
import json
from pathlib import Path
import plistlib
import re
import subprocess
import sys
import xml.etree.ElementTree as ET


CHANNELS = {
    "production": ("com.mosaicpando.specdown", "SpecDown", "AppIcon", ""),
    "development": ("com.mosaicpando.specdown.dev", "SpecDown Dev", "AppIcon-flat", "Dev "),
    "beta": ("com.mosaicpando.specdown.beta", "SpecDown Beta", "AppIcon-light", "Beta "),
}
ICONS = {
    "AppIcon", "AppIcon-flat", "AppIcon-glass", "AppIcon-ceramic",
    "AppIcon-metallic", "AppIcon-layered", "AppIcon-minimal", "AppIcon-light",
}
DOCUMENT_TYPES = [{
    "CFBundleTypeName": "Markdown Document",
    "CFBundleTypeRole": "Viewer",
    "LSHandlerRank": "Alternate",
    "LSItemContentTypes": ["net.daringfireball.markdown", "public.plain-text"],
}]
IMPORTED_TYPES = [{
    "UTTypeIdentifier": "net.daringfireball.markdown",
    "UTTypeDescription": "Markdown Document",
    "UTTypeConformsTo": ["public.plain-text"],
    "UTTypeTagSpecification": {
        "public.filename-extension": ["md", "markdown"],
        "public.mime-type": ["text/markdown"],
    },
}]
BASELINE_INFO = {
    "NSAppTransportSecurity": {
        "NSAllowsArbitraryLoads": False,
        "NSAllowsArbitraryLoadsInWebContent": False,
    },
    "CFBundleDocumentTypes": DOCUMENT_TYPES,
    "UTImportedTypeDeclarations": IMPORTED_TYPES,
    "LSSupportsOpeningDocumentsInPlace": True,
    "LSRequiresIPhoneOS": True,
    "CFBundlePackageType": "APPL",
}
VARIABLE = re.compile(r"\$\(([^)]+)\)|\$\{([^}]+)\}")


class VerificationError(Exception):
    """An artifact does not satisfy the channel contract."""


def require(condition, message):
    if not condition:
        raise VerificationError(message)


def equal(actual, expected, label):
    # Do not accept an integer 0/1 in place of a plist boolean.
    require(json.dumps(actual, sort_keys=True) == json.dumps(expected, sort_keys=True),
            "{}: expected {!r}, found {!r}".format(label, expected, actual))


def read_plist(path):
    with Path(path).open("rb") as stream:
        value = plistlib.load(stream)
    require(isinstance(value, dict), "{} must contain a plist dictionary".format(path))
    return value


def verify_info(info, channel, version=None, build=None):
    bundle_id, name, primary, _ = CHANNELS[channel]
    for key, expected in dict(BASELINE_INFO, CFBundleIdentifier=bundle_id,
                              CFBundleDisplayName=name, SpecDownChannel=channel,
                              SpecDownPrimaryIcon=primary).items():
        equal(info.get(key), expected, key)
    for key, expected in (("CFBundleShortVersionString", version), ("CFBundleVersion", build)):
        value = info.get(key)
        require(isinstance(value, str) and re.fullmatch(r"\d+(?:\.\d+){0,2}", value),
                "{} must be a resolved numeric version string".format(key))
        if expected is not None:
            equal(value, expected, key)


def verify_icons(info, primary):
    for key in ("CFBundleIcons", "CFBundleIcons~ipad"):
        icons = info.get(key, {})
        require(isinstance(icons, dict), "{} must be a dictionary".format(key))
        equal(icons.get("CFBundlePrimaryIcon", {}).get("CFBundleIconName"), primary,
              key + ".CFBundlePrimaryIcon.CFBundleIconName")
        alternates = icons.get("CFBundleAlternateIcons", {})
        require(isinstance(alternates, dict), key + " alternates must be a dictionary")
        equal(sorted(alternates), sorted(ICONS - {primary}), key + " alternate names")
        for name, entry in alternates.items():
            equal(entry.get("CFBundleIconName"), name, key + "." + name)


def file_manifest(directory):
    directory = Path(directory)
    require(directory.is_dir(), "Missing web directory: {}".format(directory))
    result = {}
    for path in sorted(directory.rglob("*")):
        require(not path.is_symlink(), "Web comparison does not follow symlinks: {}".format(path))
        if path.is_file():
            digest = hashlib.sha256()
            with path.open("rb") as stream:
                for block in iter(lambda: stream.read(1024 * 1024), b""):
                    digest.update(block)
            result[path.relative_to(directory).as_posix()] = digest.hexdigest()
    require("index.html" in result, "Web directory lacks index.html: {}".format(directory))
    return result


def verify_entitlements(path, bundle_id):
    """Inspect only a caller-supplied plist; this is not signature verification."""
    entitlements = read_plist(path)
    require(not entitlements.get("com.apple.security.application-groups"),
            "Shared application groups are not part of the channel contract")
    application_id = entitlements.get("application-identifier")
    if application_id is not None:
        require(isinstance(application_id, str)
                and re.fullmatch(r"[A-Z0-9]+\." + re.escape(bundle_id), application_id),
                "Entitlement application-identifier does not match this channel")
    groups = entitlements.get("keychain-access-groups", [])
    require(isinstance(groups, list) and all(group == application_id for group in groups)
            and (not groups or application_id is not None),
            "Only this app's own application-identifier may appear in keychain-access-groups")
    return {"path": str(Path(path).resolve()), "scope": "supplied plist only; signature not inspected"}


def verify_app(path, channel, version=None, build=None, web=None, entitlements=None):
    path = Path(path).resolve()
    info = read_plist(path / "Info.plist")
    verify_info(info, channel, version, build)
    require(str(info.get("MinimumOSVersion")) in ("16.0", "16.0.0"),
            "MinimumOSVersion must retain the iOS 16.0 baseline")
    equal(info.get("UIDeviceFamily"), [1, 2], "UIDeviceFamily")
    verify_icons(info, CHANNELS[channel][2])
    result = {"app": str(path), "channel": channel, "bundle_id": info["CFBundleIdentifier"],
              "version": info["CFBundleShortVersionString"], "build": info["CFBundleVersion"],
              "primary_icon": info["SpecDownPrimaryIcon"], "alternate_icons_per_family": 7,
              "entitlements": "not inspected; unsigned Info.plist cannot prove entitlements"}
    if web is not None:
        expected, actual = file_manifest(web), file_manifest(path / "dist")
        equal(sorted(actual), sorted(expected), "Bundled web file names")
        changed = [name for name in expected if actual[name] != expected[name]]
        require(not changed, "Bundled web bytes differ: {}".format(", ".join(changed)))
        result["matching_web_files"] = len(expected)
    if entitlements is not None:
        result["entitlements"] = verify_entitlements(entitlements, info["CFBundleIdentifier"])
    return result


class Settings:
    """Resolve this project's explicit variable syntax, failing on unknown inputs."""

    def __init__(self, project, target, directory):
        self.values = dict(project)
        for key, value in target.items():
            previous = self.values.get(key, "")
            if isinstance(value, str):
                previous = " ".join(previous) if isinstance(previous, list) else str(previous)
                value = value.replace("$(inherited)", previous).replace("${inherited}", previous)
            self.values[key] = value
        self.values.update(SRCROOT=str(directory), PROJECT_DIR=str(directory), TARGET_NAME="SpecDown")
        # No partial evaluation of xcconfig conditions or Info.plist preprocessing.
        require(not any("[" in key for key in self.values),
                "Conditional build settings require separate effective-settings validation")
        require(not any(key.startswith("INFOPLIST_KEY_") for key in self.values),
                "INFOPLIST_KEY overrides require separate compiled-plist validation")
        for key in ("GENERATE_INFOPLIST_FILE", "INFOPLIST_PREPROCESS"):
            require(self.values.get(key, "NO") == "NO", key + " must remain disabled")
        require(not self.values.get("INFOPLIST_OTHER_PREPROCESSOR_FLAGS"),
                "Info.plist preprocessing flags are unsupported")

    def expand(self, value, stack=()):
        if isinstance(value, list):
            return [self.expand(item, stack) for item in value]
        if isinstance(value, dict):
            return {key: self.expand(item, stack) for key, item in value.items()}
        if not isinstance(value, str):
            return value

        def replace(match):
            name = match.group(1) or match.group(2)
            require(name not in stack and len(stack) < 30, "Cyclic build setting: " + name)
            require(name in self.values, "Unresolved build setting: " + name)
            resolved = self.expand(self.values[name], stack + (name,))
            require(isinstance(resolved, str), "Expected scalar build setting: " + name)
            return resolved

        value = VARIABLE.sub(replace, value)
        require("$(" not in value and "${" not in value, "Unresolved build setting syntax")
        return value

    def get(self, key):
        require(key in self.values, "Missing build setting: " + key)
        return self.expand(self.values[key], (key,))


def configurations(objects, owner):
    config_list = objects[owner["buildConfigurationList"]]
    require(config_list.get("isa") == "XCConfigurationList", "Invalid configuration list")
    result = {}
    for ref in config_list["buildConfigurations"]:
        config = objects[ref]
        require(config.get("isa") == "XCBuildConfiguration", "Invalid build configuration")
        require("baseConfigurationReference" not in config,
                "External xcconfig requires separate effective-settings validation")
        name = config["name"]
        require(name not in result, "Duplicate build configuration: " + name)
        result[name] = config["buildSettings"]
    expected = {prefix + kind for _, _, _, prefix in CHANNELS.values() for kind in ("Debug", "Release")}
    equal(sorted(result), sorted(expected), "Build configuration names")
    return result


def verify_scheme(project, name, prefix, target_id):
    path = project / "xcshareddata" / "xcschemes" / (name + ".xcscheme")
    scheme = ET.parse(path).getroot()
    equal(scheme.tag, "Scheme", str(path))
    for action, kind in (("LaunchAction", "Debug"), ("TestAction", "Debug"),
                         ("AnalyzeAction", "Debug"), ("ProfileAction", "Release"),
                         ("ArchiveAction", "Release")):
        nodes = scheme.findall(action)
        require(len(nodes) == 1, name + " requires exactly one " + action)
        equal(nodes[0].get("buildConfiguration"), prefix + kind, name + " " + action)
    entries = scheme.findall("BuildAction/BuildActionEntries/BuildActionEntry")
    require(len(entries) == 1, name + " must build exactly the SpecDown target")
    for use in ("Testing", "Running", "Profiling", "Archiving", "Analyzing"):
        equal(entries[0].get("buildFor" + use), "YES", name + " buildFor" + use)
    for parent in ("BuildAction/BuildActionEntries/BuildActionEntry",
                   "LaunchAction/BuildableProductRunnable", "ProfileAction/BuildableProductRunnable"):
        require(len(scheme.findall(parent + "/BuildableReference")) == 1,
                name + " lacks its target reference: " + parent)
    for ref in scheme.iter("BuildableReference"):
        equal(ref.get("BlueprintIdentifier"), target_id, name + " target reference")
        equal(ref.get("ReferencedContainer"), "container:" + project.name, name + " project reference")
    # Scripted scheme actions could change artifacts after the settings check.
    require(not list(scheme.iter("ExecutionAction")), name + " has unsupported scheme execution actions")


def verify_project(path, version=None, build=None):
    path = Path(path).resolve()
    converted = subprocess.run(["plutil", "-convert", "json", "-o", "-", str(path / "project.pbxproj")],
                               check=True, capture_output=True, text=True)
    project = json.loads(converted.stdout)
    objects = project["objects"]
    root = objects[project["rootObject"]]
    equal(root.get("isa"), "PBXProject", "Project root")
    targets = [(ref, objects[ref]) for ref in root["targets"]
               if objects[ref].get("isa") == "PBXNativeTarget"]
    require(len(targets) == 1 and targets[0][1].get("name") == "SpecDown",
            "Expected one native SpecDown target")
    target_id, target = targets[0]
    equal(target.get("productType"), "com.apple.product-type.application", "Target type")
    project_configs, target_configs = configurations(objects, root), configurations(objects, target)
    rows = []
    for channel, (bundle_id, name, primary, prefix) in CHANNELS.items():
        verify_scheme(path, name, prefix, target_id)
        for kind in ("Debug", "Release"):
            config = prefix + kind
            settings = Settings(project_configs[config], target_configs[config], path.parent)
            equal(settings.get("PRODUCT_BUNDLE_IDENTIFIER"), bundle_id, config + " bundle ID")
            equal(settings.get("ASSETCATALOG_COMPILER_APPICON_NAME"), primary, config + " primary icon")
            alternates = settings.get("ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES")
            alternates = alternates.split() if isinstance(alternates, str) else alternates
            equal(sorted(alternates), sorted(ICONS - {primary}), config + " alternate icons")
            equal(settings.get("IPHONEOS_DEPLOYMENT_TARGET"), "16.0", config + " deployment target")
            equal(settings.get("TARGETED_DEVICE_FAMILY"), "1,2", config + " device families")
            template = read_plist(path.parent / settings.get("INFOPLIST_FILE"))
            required = set(BASELINE_INFO) | {"CFBundleIdentifier", "CFBundleDisplayName", "SpecDownChannel",
                                           "SpecDownPrimaryIcon", "CFBundleShortVersionString", "CFBundleVersion"}
            info = settings.expand({key: template.get(key) for key in required})
            verify_info(info, channel, version, build)
            equal(info["CFBundleShortVersionString"], settings.get("MARKETING_VERSION"), config + " version")
            equal(info["CFBundleVersion"], settings.get("CURRENT_PROJECT_VERSION"), config + " build")
            rows.append({"configuration": config, "channel": channel, "bundle_id": bundle_id,
                         "primary_icon": primary, "version": info["CFBundleShortVersionString"],
                         "build": info["CFBundleVersion"]})
    return {"project": str(path), "configurations": rows, "shared_schemes": 3,
            "scope": "generated settings and schemes; invocation overrides and signatures not inspected"}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--app", type=Path, help="already-built .app bundle")
    source.add_argument("--project", type=Path, help="generated .xcodeproj (all channels checked)")
    parser.add_argument("--channel", choices=CHANNELS)
    parser.add_argument("--version", help="optional exact marketing version")
    parser.add_argument("--build", help="optional exact build number")
    parser.add_argument("--web", type=Path, help="compare every file with app/dist")
    parser.add_argument("--entitlements", type=Path, help="inspect an explicit entitlement plist; no signature lookup")
    args = parser.parse_args(argv)
    if args.app and not args.channel:
        parser.error("--app requires --channel")
    if args.project and any((args.channel, args.web, args.entitlements)):
        parser.error("--channel, --web and --entitlements apply only to --app")
    try:
        if args.app:
            result = verify_app(args.app, args.channel, args.version, args.build, args.web, args.entitlements)
        else:
            result = verify_project(args.project, args.version, args.build)
        print(json.dumps(dict(result, verified=True), indent=2))
        return 0
    except (VerificationError, OSError, ValueError, KeyError, TypeError, AttributeError,
            plistlib.InvalidFileException, ET.ParseError, subprocess.CalledProcessError) as error:
        print("iOS channel verification failed: {}".format(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
