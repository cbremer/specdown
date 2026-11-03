#!/usr/bin/env python3
"""Offline artifact/CLI regression tests for verify-ios-channel.py (stdlib only)."""

import copy
import json
from pathlib import Path
import plistlib
import subprocess
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET


SCRIPT = Path(__file__).with_name("verify-ios-channel.py")
ARTWORK = ["AppIcon", "AppIcon-flat", "AppIcon-glass", "AppIcon-ceramic",
           "AppIcon-metallic", "AppIcon-layered", "AppIcon-minimal", "AppIcon-light"]
CASES = [
    ("production", "", "SpecDown", "com.mosaicpando.specdown", "AppIcon"),
    ("development", "Dev ", "SpecDown Dev", "com.mosaicpando.specdown.dev", "AppIcon-flat"),
    ("beta", "Beta ", "SpecDown Beta", "com.mosaicpando.specdown.beta", "AppIcon-light"),
]


def write_plist(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(plistlib.dumps(value))


def app_info(case):
    channel, _, name, bundle_id, primary = case
    icons = {"CFBundlePrimaryIcon": {"CFBundleIconName": primary},
             "CFBundleAlternateIcons": {icon: {"CFBundleIconName": icon}
                                        for icon in ARTWORK if icon != primary}}
    return {
        "CFBundleIdentifier": bundle_id, "CFBundleDisplayName": name,
        "SpecDownChannel": channel, "SpecDownPrimaryIcon": primary,
        "CFBundleShortVersionString": "2.3.4", "CFBundleVersion": "901",
        "MinimumOSVersion": "16.0", "UIDeviceFamily": [1, 2],
        "CFBundlePackageType": "APPL", "LSRequiresIPhoneOS": True,
        "LSSupportsOpeningDocumentsInPlace": True,
        "CFBundleIcons": icons, "CFBundleIcons~ipad": copy.deepcopy(icons),
        "NSAppTransportSecurity": {"NSAllowsArbitraryLoads": False,
                                   "NSAllowsArbitraryLoadsInWebContent": False},
        "CFBundleDocumentTypes": [{"CFBundleTypeName": "Markdown Document",
                                   "CFBundleTypeRole": "Viewer", "LSHandlerRank": "Alternate",
                                   "LSItemContentTypes": ["net.daringfireball.markdown", "public.plain-text"]}],
        "UTImportedTypeDeclarations": [{"UTTypeIdentifier": "net.daringfireball.markdown",
                                        "UTTypeDescription": "Markdown Document",
                                        "UTTypeConformsTo": ["public.plain-text"],
                                        "UTTypeTagSpecification": {
                                            "public.filename-extension": ["md", "markdown"],
                                            "public.mime-type": ["text/markdown"]}}],
    }


class ChannelArtifactTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="specdown-channel-test-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.app = self.root / "Specdown.app"
        self.info = app_info(CASES[0])
        write_plist(self.app / "Info.plist", self.info)
        self.project = self.root / "SpecDown.xcodeproj"
        self.schemes = self.project / "xcshareddata" / "xcschemes"
        self.schemes.mkdir(parents=True)
        self.objects = {
            "PROJECT": {"isa": "PBXProject", "targets": ["APP"], "buildConfigurationList": "PROJECT_CONFIGS"},
            "APP": {"isa": "PBXNativeTarget", "name": "SpecDown", "productType": "com.apple.product-type.application",
                    "buildConfigurationList": "APP_CONFIGS"},
            "PROJECT_CONFIGS": {"isa": "XCConfigurationList", "buildConfigurations": []},
            "APP_CONFIGS": {"isa": "XCConfigurationList", "buildConfigurations": []},
        }
        for channel, prefix, name, bundle_id, primary in CASES:
            for kind in ("Debug", "Release"):
                config = prefix + kind
                self.objects["PROJECT_CONFIGS"]["buildConfigurations"].append("P_" + config)
                self.objects["APP_CONFIGS"]["buildConfigurations"].append(config)
                self.objects["P_" + config] = {"isa": "XCBuildConfiguration", "name": config,
                                                "buildSettings": {"IPHONEOS_DEPLOYMENT_TARGET": "16.0"}}
                self.objects[config] = {"isa": "XCBuildConfiguration", "name": config, "buildSettings": {
                    "PRODUCT_BUNDLE_IDENTIFIER": bundle_id,
                    "DISPLAY": name, "CHANNEL": channel, "MARKETING_VERSION": "2.3.4", "CURRENT_PROJECT_VERSION": "901",
                    "INFOPLIST_FILE": "SpecDown/Info.plist", "TARGETED_DEVICE_FAMILY": "1,2",
                    "ASSETCATALOG_COMPILER_APPICON_NAME": primary,
                    "ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES": " ".join(icon for icon in ARTWORK if icon != primary),
                }}
            scheme = ET.Element("Scheme")
            entries = ET.SubElement(ET.SubElement(scheme, "BuildAction"), "BuildActionEntries")
            entry = ET.SubElement(entries, "BuildActionEntry", {
                "buildFor" + use: "YES" for use in ("Testing", "Running", "Profiling", "Archiving", "Analyzing")})
            reference = {"BlueprintIdentifier": "APP", "ReferencedContainer": "container:SpecDown.xcodeproj"}
            ET.SubElement(entry, "BuildableReference", reference)
            for action, kind in (("LaunchAction", "Debug"), ("TestAction", "Debug"), ("AnalyzeAction", "Debug"),
                                 ("ProfileAction", "Release"), ("ArchiveAction", "Release")):
                node = ET.SubElement(scheme, action, buildConfiguration=prefix + kind)
                if action in ("LaunchAction", "ProfileAction"):
                    ET.SubElement(ET.SubElement(node, "BuildableProductRunnable"), "BuildableReference", reference)
            ET.ElementTree(scheme).write(self.schemes / (name + ".xcscheme"))
        self.save_project()
        template = app_info(CASES[0])
        for key, setting in {"CFBundleIdentifier": "PRODUCT_BUNDLE_IDENTIFIER", "CFBundleDisplayName": "DISPLAY",
                             "SpecDownChannel": "CHANNEL", "SpecDownPrimaryIcon": "ASSETCATALOG_COMPILER_APPICON_NAME",
                             "CFBundleShortVersionString": "MARKETING_VERSION", "CFBundleVersion": "CURRENT_PROJECT_VERSION"}.items():
            template[key] = "$(" + setting + ")"
        for key in ("CFBundleIcons", "CFBundleIcons~ipad", "MinimumOSVersion", "UIDeviceFamily"):
            del template[key]
        write_plist(self.root / "SpecDown" / "Info.plist", template)

    def save_project(self):
        write_plist(self.project / "project.pbxproj", {"rootObject": "PROJECT", "objects": self.objects})

    def run_cli(self, *args, error=None):
        result = subprocess.run([sys.executable, str(SCRIPT), *map(str, args)], capture_output=True, text=True)
        if error:
            self.assertNotEqual(result.returncode, 0, result.stdout)
            self.assertIn(error, result.stderr)
        else:
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertTrue(json.loads(result.stdout)["verified"])
        return result

    def check_app(self, channel="production", error=None, extra=()):
        write_plist(self.app / "Info.plist", self.info)
        return self.run_cli("--app", self.app, "--channel", channel, *extra, error=error)

    def test_all_compiled_channel_identities_and_version_override(self):
        for case in CASES:
            with self.subTest(channel=case[0]):
                self.info = app_info(case)
                self.check_app(case[0], extra=("--version", "2.3.4", "--build", "901"))

    def test_wrong_production_id_fails_despite_beta_or_dev_label(self):
        for case in CASES[1:]:
            with self.subTest(channel=case[0]):
                self.info = app_info(case)
                self.info["CFBundleIdentifier"] = "com.mosaicpando.specdown"
                self.check_app(case[0], error="CFBundleIdentifier")

    def test_wrong_channel_and_display_name_fail(self):
        for key in ("SpecDownChannel", "CFBundleDisplayName"):
            with self.subTest(key=key):
                self.info = app_info(CASES[0])
                self.info[key] = "development"
                self.check_app(error=key)

    def test_primary_and_phone_ipad_alternates_are_independently_checked(self):
        for family in ("CFBundleIcons", "CFBundleIcons~ipad"):
            with self.subTest(family=family):
                self.info = app_info(CASES[2])
                self.info[family]["CFBundlePrimaryIcon"]["CFBundleIconName"] = "AppIcon"
                self.check_app("beta", error="CFBundlePrimaryIcon")
                self.info = app_info(CASES[1])
                del self.info[family]["CFBundleAlternateIcons"]["AppIcon"]
                self.check_app("development", error="alternate names")
                self.info = app_info(CASES[0])
                self.info[family]["CFBundleAlternateIcons"]["AppIcon-light"]["CFBundleIconName"] = "AppIcon-flat"
                self.check_app(error="AppIcon-light")

    def test_ats_and_document_contract_changes_fail(self):
        mutations = [
            ("NSAppTransportSecurity", {"NSAllowsArbitraryLoads": True, "NSAllowsArbitraryLoadsInWebContent": False}),
            ("CFBundleDocumentTypes", []), ("UTImportedTypeDeclarations", []),
            ("LSSupportsOpeningDocumentsInPlace", False), ("LSRequiresIPhoneOS", 1),
            ("UIDeviceFamily", [1]), ("MinimumOSVersion", "18.0"),
        ]
        for key, value in mutations:
            with self.subTest(key=key):
                self.info = app_info(CASES[0])
                self.info[key] = value
                self.check_app(error=key)

    def test_version_is_not_hardcoded_but_explicit_mismatch_fails(self):
        self.check_app()
        self.check_app(extra=("--version", "1.0.1"), error="CFBundleShortVersionString")
        self.check_app(extra=("--build", "228"), error="CFBundleVersion")

    def test_web_comparison_checks_names_and_bytes(self):
        web = self.root / "web"
        web.mkdir()
        (web / "index.html").write_text("viewer")
        (self.app / "dist").mkdir()
        (self.app / "dist" / "index.html").write_text("viewer")
        self.check_app(extra=("--web", web))
        (self.app / "dist" / "index.html").write_text("stale viewer")
        self.check_app(extra=("--web", web), error="Bundled web bytes differ")
        (self.app / "dist" / "extra.js").write_text("unexpected")
        self.check_app(extra=("--web", web), error="Bundled web file names")

    def test_no_entitlement_claim_without_explicit_file(self):
        result = self.check_app()
        self.assertIn("not inspected", json.loads(result.stdout)["entitlements"])
        entitlement_file = self.root / "supplied.entitlements"
        own = "TEAM123.com.mosaicpando.specdown"
        write_plist(entitlement_file, {"application-identifier": own, "keychain-access-groups": [own]})
        self.check_app(extra=("--entitlements", entitlement_file))
        write_plist(entitlement_file, {"com.apple.security.application-groups": ["group.shared"]})
        self.check_app(extra=("--entitlements", entitlement_file), error="Shared application groups")
        write_plist(entitlement_file, {"application-identifier": own, "keychain-access-groups": [own + ".beta"]})
        self.check_app(extra=("--entitlements", entitlement_file), error="keychain-access-groups")

    def add_hosted_test_target(self):
        self.objects["PROJECT"]["targets"].append("TEST")
        self.objects["TEST"] = {
            "isa": "PBXNativeTarget", "name": "SpecDownTests",
            "productType": "com.apple.product-type.bundle.unit-test",
            "buildConfigurationList": "TEST_CONFIGS", "dependencies": ["TEST_APP_DEP"],
        }
        self.objects["TEST_APP_DEP"] = {"isa": "PBXTargetDependency", "target": "APP"}
        self.objects["TEST_CONFIGS"] = {"isa": "XCConfigurationList", "buildConfigurations": []}
        for channel, prefix, _, _, _ in CASES:
            for kind in ("Debug", "Release"):
                config = prefix + kind
                ref = "TEST_" + config
                self.objects["TEST_CONFIGS"]["buildConfigurations"].append(ref)
                self.objects[ref] = {"isa": "XCBuildConfiguration", "name": config, "buildSettings": {
                    "PRODUCT_BUNDLE_IDENTIFIER": "com.mosaicpando.specdown.synthetic-tests",
                    "GENERATE_INFOPLIST_FILE": "YES",
                    "TEST_HOST": "$(BUILT_PRODUCTS_DIR)/Specdown.app/Specdown",
                    "BUNDLE_LOADER": "$(TEST_HOST)",
                }}
        self.save_project()

    def test_known_hosted_unit_test_bundle_preserves_all_app_channel_checks(self):
        self.add_hosted_test_target()
        self.run_cli("--project", self.project, "--version", "2.3.4", "--build", "901")
        self.objects["Beta Release"]["buildSettings"]["PRODUCT_BUNDLE_IDENTIFIER"] = "com.mosaicpando.specdown"
        self.save_project()
        self.run_cli("--project", self.project, error="Beta Release bundle ID")

    def test_unknown_native_aggregate_and_extra_app_targets_fail_closed(self):
        for isa, name, product in [
            ("PBXNativeTarget", "UnexpectedTests", "com.apple.product-type.bundle.unit-test"),
            ("PBXNativeTarget", "OtherApp", "com.apple.product-type.application"),
            ("PBXAggregateTarget", "UnexpectedAggregate", None),
        ]:
            with self.subTest(name=name):
                self.objects["PROJECT"]["targets"] = ["APP", "OTHER"]
                self.objects["OTHER"] = {"isa": isa, "name": name}
                if product is not None:
                    self.objects["OTHER"]["productType"] = product
                self.save_project()
                self.run_cli("--project", self.project, error="Unknown project target")

    def test_test_target_name_cannot_hide_an_application(self):
        self.add_hosted_test_target()
        self.objects["TEST"]["productType"] = "com.apple.product-type.application"
        self.save_project()
        self.run_cli("--project", self.project, error="unit-test bundle")

    def test_duplicate_test_target_and_wrong_host_dependency_fail(self):
        self.add_hosted_test_target()
        self.objects["PROJECT"]["targets"].append("TEST")
        self.save_project()
        self.run_cli("--project", self.project, error="Duplicate project target")
        self.objects["PROJECT"]["targets"].pop()
        self.objects["TEST_APP_DEP"]["target"] = "OTHER"
        self.save_project()
        self.run_cli("--project", self.project, error="host dependency")

    def test_test_bundle_identity_and_host_cannot_replace_production(self):
        self.add_hosted_test_target()
        settings = self.objects["TEST_Dev Debug"]["buildSettings"]
        original = copy.deepcopy(settings)
        for key, value, error in [
            ("PRODUCT_BUNDLE_IDENTIFIER", "com.mosaicpando.specdown", "test bundle ID"),
            ("TEST_HOST", "$(BUILT_PRODUCTS_DIR)/Other.app/Other", "test host"),
            ("BUNDLE_LOADER", "$(OTHER)", "test bundle loader"),
        ]:
            with self.subTest(key=key):
                settings.clear()
                settings.update(original)
                settings[key] = value
                self.save_project()
                self.run_cli("--project", self.project, error=error)

    def test_application_cannot_start_depending_on_test_bundle(self):
        self.add_hosted_test_target()
        self.objects["APP"]["dependencies"] = ["TEST_APP_DEP"]
        self.save_project()
        self.run_cli("--project", self.project, error="application dependencies")

    def test_all_six_generated_configurations_and_three_schemes(self):
        self.run_cli("--project", self.project, "--version", "2.3.4", "--build", "901")

    def test_beta_archive_accidentally_using_production_release_fails(self):
        path = self.schemes / "SpecDown Beta.xcscheme"
        tree = ET.parse(path)
        tree.find("ArchiveAction").set("buildConfiguration", "Release")
        tree.write(path)
        self.run_cli("--project", self.project, error="SpecDown Beta ArchiveAction")

    def test_dev_scheme_running_production_debug_fails(self):
        path = self.schemes / "SpecDown Dev.xcscheme"
        tree = ET.parse(path)
        tree.find("LaunchAction").set("buildConfiguration", "Debug")
        tree.write(path)
        self.run_cli("--project", self.project, error="SpecDown Dev LaunchAction")

    def test_schemes_cannot_point_at_another_target(self):
        path = self.schemes / "SpecDown Beta.xcscheme"
        tree = ET.parse(path)
        tree.find("LaunchAction/BuildableProductRunnable/BuildableReference").set("BlueprintIdentifier", "OTHER")
        tree.write(path)
        self.run_cli("--project", self.project, error="target reference")

    def test_beta_config_cannot_silently_keep_production_id(self):
        self.objects["Beta Release"]["buildSettings"]["PRODUCT_BUNDLE_IDENTIFIER"] = "com.mosaicpando.specdown"
        self.save_project()
        self.run_cli("--project", self.project, error="Beta Release bundle ID")

    def test_config_primary_and_alternates_must_match_channel(self):
        self.objects["Dev Debug"]["buildSettings"]["ASSETCATALOG_COMPILER_APPICON_NAME"] = "AppIcon"
        self.save_project()
        self.run_cli("--project", self.project, error="Dev Debug primary icon")
        self.objects["Dev Debug"]["buildSettings"]["ASSETCATALOG_COMPILER_APPICON_NAME"] = "AppIcon-flat"
        self.objects["Dev Debug"]["buildSettings"]["ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES"] += " AppIcon-flat"
        self.save_project()
        self.run_cli("--project", self.project, error="Dev Debug alternate icons")

    def test_missing_config_or_scheme_fails(self):
        self.objects["APP_CONFIGS"]["buildConfigurations"].remove("Beta Release")
        self.save_project()
        self.run_cli("--project", self.project, error="Build configuration names")
        self.objects["APP_CONFIGS"]["buildConfigurations"].append("Beta Release")
        self.save_project()
        (self.schemes / "SpecDown.xcscheme").unlink()
        self.run_cli("--project", self.project, error="SpecDown.xcscheme")

    def test_unresolved_cyclic_or_conditional_identity_settings_fail_closed(self):
        settings = self.objects["Dev Debug"]["buildSettings"]
        for value, error in (("$(UNDEFINED)", "Unresolved build setting"),
                             ("$(PRODUCT_BUNDLE_IDENTIFIER)", "Cyclic build setting")):
            with self.subTest(value=value):
                settings["PRODUCT_BUNDLE_IDENTIFIER"] = value
                self.save_project()
                self.run_cli("--project", self.project, error=error)
        settings["PRODUCT_BUNDLE_IDENTIFIER"] = "com.mosaicpando.specdown.dev"
        settings["PRODUCT_BUNDLE_IDENTIFIER[sdk=iphoneos*]"] = "com.mosaicpando.specdown"
        self.save_project()
        self.run_cli("--project", self.project, error="Conditional build settings")

    def test_external_xcconfig_and_plist_overrides_do_not_get_ignored(self):
        self.objects["Beta Release"]["baseConfigurationReference"] = "OVERRIDE"
        self.save_project()
        self.run_cli("--project", self.project, error="External xcconfig")
        del self.objects["Beta Release"]["baseConfigurationReference"]
        self.objects["Beta Release"]["buildSettings"]["INFOPLIST_KEY_CFBundleIdentifier"] = "com.mosaicpando.specdown"
        self.save_project()
        self.run_cli("--project", self.project, error="INFOPLIST_KEY overrides")


if __name__ == "__main__":
    unittest.main(verbosity=2)
