#!/usr/bin/env python3
"""Synthetic-only tests; never calls macOS signing tools or uses real keys."""
import base64
import contextlib
import hashlib
import importlib.util
import io
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
from types import SimpleNamespace
import unittest
from unittest.mock import patch, Mock

SPEC = importlib.util.spec_from_file_location(
    "credential_validation", Path(__file__).with_name("validate-desktop-credentials.py")
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
PUBLIC_FIXTURE = b"0synthetic public certificate; not a real certificate or private key"
FIXTURE_FINGERPRINT = hashlib.sha256(PUBLIC_FIXTURE).hexdigest().upper()
FIXTURE_CODESIGN_SELECTOR = "1" * 40  # Synthetic lookup identifier; not a trust hash.
BASELINE_PATHS = ["/Users/runner/Library/Keychains/login.keychain-db", "/Library/Keychains/System.keychain"]


def search_snapshot(paths):
    return b"".join(('    "' + path + '"\n').encode() for path in paths)


class FakeCommands:
    def __init__(self, fail=None, wrong_leaf=False, wrong_identity=False,
                 wrong_signed_leaf=False, changed_state=False, original_paths=None,
                 intermediate_count=0, wrong_intermediate_import=False):
        self.calls = []
        self.fail = fail
        self.wrong_leaf = wrong_leaf
        self.wrong_identity = wrong_identity
        self.wrong_signed_leaf = wrong_signed_leaf
        self.changed_state = changed_state
        self.snapshot_count = 0
        self.paths = BASELINE_PATHS.copy() if original_paths is None else original_paths.copy()
        self.intermediate_count = intermediate_count
        self.wrong_intermediate_import = wrong_intermediate_import
        self.diagnostics = []

    def __call__(self, stage, args, capture=False, timeout=60, codesign_diagnostics=False):
        self.calls.append((stage, args, capture, timeout))
        if codesign_diagnostics:
            self.diagnostics.append(stage)
        if stage == self.fail and stage != "Temporary signing search list":
            raise MODULE.ValidationError(stage + " failed; credential details were suppressed")
        if stage == "Keychain search-list snapshot":
            self.snapshot_count += 1
            return b"changed" if self.changed_state and self.snapshot_count > 1 else search_snapshot(self.paths)
        if stage == "Default-keychain snapshot":
            return b"unchanged-default"
        if stage == "Temporary keychain creation":
            Path(args[-1]).write_bytes(b"synthetic keychain marker; no keys")
        if stage in ("Public certificate inventory", "Public chain inventory"):
            leaf = b"wrong public fixture" if self.wrong_leaf else PUBLIC_FIXTURE
            certificates = [leaf] + [MODULE.INTERMEDIATE_FILE.read_bytes()] * self.intermediate_count
            return b"".join(b"-----BEGIN CERTIFICATE-----\n" + base64.b64encode(cert) + b"\n-----END CERTIFICATE-----\n" for cert in certificates)
        if stage == "Pinned public intermediate import" and not self.wrong_intermediate_import:
            self.intermediate_count = 1
        if stage in ("Temporary signing search list", "Original search-list restoration"):
            self.paths = args[5:]
            if stage == self.fail:
                raise MODULE.ValidationError("Synthetic partial search-list mutation failed")
        if stage == "Private-key identity lookup":
            digest = "0" * 40 if self.wrong_identity else FIXTURE_CODESIGN_SELECTOR
            return f'  1) {digest} "Developer ID Application: Fixture ({MODULE.EXPECTED_TEAM})"\n1 valid identities found\n'.encode()
        if stage == "Signing probe certificate extraction":
            prefix = next(arg.split("=", 1)[1] for arg in args if arg.startswith("--extract-certificates="))
            Path(prefix + "0").write_bytes(b"wrong" if self.wrong_signed_leaf else PUBLIC_FIXTURE)
        if stage == "Temporary keychain deletion":
            Path(args[-1]).unlink()
        return b""


class CredentialTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.env = {
            "GITHUB_ACTIONS": "true", "RUNNER_ENVIRONMENT": "github-hosted",
            "GITHUB_REPOSITORY": "cbremer/specdown", "GITHUB_REF": "refs/heads/main",
            "GITHUB_EVENT_NAME": "workflow_dispatch", "RUNNER_TEMP": self.temp.name,
            "MAC_CERT_P12": base64.b64encode(b"0synthetic PKCS12 fixture").decode(),
            "MAC_CERT_PASSWORD": "synthetic-export-password",
            "APPLE_ID": "fixture@example.invalid",
            "APPLE_APP_SPECIFIC_PASSWORD": "synthetic-apple-password",
            "APPLE_TEAM_ID": MODULE.EXPECTED_TEAM, "CHECK_NOTARIZATION": "false",
        }
        self.platform = patch.object(MODULE.platform, "system", return_value="Darwin")
        self.fingerprint = patch.object(MODULE, "EXPECTED_CERT_SHA256", FIXTURE_FINGERPRINT)
        self.selector = patch.object(MODULE, "EXPECTED_CODESIGN_SELECTOR", FIXTURE_CODESIGN_SELECTOR)
        self.platform.start()
        self.fingerprint.start()
        self.selector.start()

    def tearDown(self):
        self.platform.stop()
        self.fingerprint.stop()
        self.selector.stop()
        self.temp.cleanup()

    def assert_clean(self):
        self.assertEqual(list(Path(self.temp.name).iterdir()), [])

    def test_complete_probe_uses_only_temp_keychain_and_cleans_up(self):
        command = FakeCommands()
        result = MODULE.validate(self.env, command)
        self.assertIn("private-key/certificate pair verified", result)
        stages = [c[0] for c in command.calls]
        self.assertIn("Existing-key signing probe", stages)
        self.assertNotIn("Read-only notarization authentication", stages)
        signing = next(c[1] for c in command.calls if c[0] == "Existing-key signing probe")
        self.assertIn("--timestamp=none", signing)
        self.assertIn("--keychain", signing)
        self.assertNotIn("--deep", signing)
        self.assertEqual(signing[signing.index("--sign") + 1], FIXTURE_CODESIGN_SELECTOR)
        self.assertEqual(command.diagnostics, ["Existing-key signing probe"])
        for _, args, _, _ in command.calls:
            self.assertNotIn("-A", args)
            self.assertNotIn("submit", args)
            self.assertFalse(args[0].endswith("credential-probe"))
            if args[1] == "default-keychain":
                self.assertNotIn("-s", args)
        mutations = [call for call in command.calls if "-s" in call[1] and "list-keychains" in call[1]]
        self.assertEqual([call[0] for call in mutations], ["Temporary signing search list", "Original search-list restoration"])
        self.assertEqual(mutations[0][1][6:], BASELINE_PATHS)
        self.assertEqual(mutations[1][1][5:], BASELINE_PATHS)
        self.assertLess(stages.index("Original search-list restoration"), stages.index("Temporary keychain deletion"))
        self.assertEqual(command.paths, BASELINE_PATHS)
        self.assert_clean()

    def test_notarization_is_one_explicit_read_only_attempt(self):
        command = FakeCommands()
        self.env["CHECK_NOTARIZATION"] = "true"
        result = MODULE.validate(self.env, command)
        calls = [c for c in command.calls if "notarytool" in c[1]]
        self.assertEqual(len(calls), 1)
        self.assertIn("history", calls[0][1])
        self.assertIn("--password=" + self.env["APPLE_APP_SPECIFIC_PASSWORD"], calls[0][1])
        self.assertIn("--apple-id=" + self.env["APPLE_ID"], calls[0][1])
        self.assertNotIn("--password", calls[0][1])
        self.assertFalse(calls[0][2])
        self.assertEqual(calls[0][3], 90)
        self.assertIn("one read-only", result)
        self.assert_clean()

    def test_search_list_parser_preserves_literal_paths_order_and_empty_list(self):
        paths = ["/Users/runner/Folder With Spaces/login.keychain-db", r"/Users/runner/literal\backslash.keychain"]
        self.assertEqual(MODULE.search_list_paths(search_snapshot(paths)), paths)
        self.assertEqual(MODULE.search_list_paths(b""), [])
        invalid = [b"relative.keychain", b'"relative.keychain"', b'"/tmp/a" "/tmp/b"',
                   b'"//host/keychain"', b'"///normalization"',
                   b'"/tmp/a\x00b"', b'"/tmp/a\tb"', b'"/tmp/a"b"', b'"/tmp/../other"',
                   b'"/tmp//other"', b'"/tmp/a"\n"/tmp/a"', b'"/tmp/\xff"', b"x" * 32769,
                   search_snapshot([f"/tmp/{i}" for i in range(33)]), search_snapshot(["/" + "x" * 4096])]
        for raw in invalid:
            with self.subTest(size=len(raw)):
                with self.assertRaises(MODULE.ValidationError):
                    MODULE.search_list_paths(raw)

    def test_empty_search_list_and_partial_mutation_restore_before_deletion(self):
        for fail in (None, "Temporary signing search list"):
            command = FakeCommands(original_paths=[], fail=fail)
            if fail:
                with self.assertRaises(MODULE.ValidationError):
                    MODULE.validate(self.env, command)
            else:
                MODULE.validate(self.env, command)
            stages = [call[0] for call in command.calls]
            self.assertLess(stages.index("Original search-list restoration"), stages.index("Temporary keychain deletion"))
            self.assertEqual(command.paths, [])
            restore = next(call[1] for call in command.calls if call[0] == "Original search-list restoration")
            self.assertEqual(restore, ["/usr/bin/security", "list-keychains", "-d", "user", "-s"])
            self.assert_clean()

    def test_bad_baseline_fails_before_any_keychain_mutation(self):
        command = FakeCommands(original_paths=["relative-path"])
        with self.assertRaises(MODULE.ValidationError):
            MODULE.validate(self.env, command)
        self.assertEqual([call[0] for call in command.calls], ["Keychain search-list snapshot", "Default-keychain snapshot"])
        self.assert_clean()

    def test_public_intermediate_is_pinned_reused_or_imported_without_trust(self):
        certificate = MODULE.public_intermediate()
        self.assertEqual(hashlib.sha256(certificate).hexdigest().upper(), MODULE.INTERMEDIATE_SHA256)
        for count in (0, 1):
            command = FakeCommands(intermediate_count=count)
            MODULE.validate(self.env, command)
            imports = [call[1] for call in command.calls if call[0] == "Pinned public intermediate import"]
            self.assertEqual(len(imports), 1 - count)
            if imports:
                self.assertEqual(imports[0][-2:], ["-t", "cert"])
                self.assertIn("-k", imports[0])
            for call in command.calls:
                self.assertNotIn("add-trusted-cert", call[1])
                self.assertNotIn("trust-settings-import", call[1])
            self.assert_clean()
        for command in (FakeCommands(intermediate_count=2), FakeCommands(wrong_intermediate_import=True)):
            with self.assertRaises(MODULE.ValidationError):
                MODULE.validate(self.env, command)
            self.assertNotIn("Temporary signing search list", [call[0] for call in command.calls])
            self.assert_clean()

    def test_wrong_public_asset_stops_before_credentials_are_imported(self):
        with tempfile.TemporaryDirectory() as directory:
            wrong = Path(directory) / "wrong.cer"
            for contents in (b"", b"untrusted public bytes", b"x" * 8193):
                wrong.write_bytes(contents)
                command = FakeCommands()
                with patch.object(MODULE, "INTERMEDIATE_FILE", wrong):
                    with self.assertRaises(MODULE.ValidationError):
                        MODULE.validate(self.env, command)
                self.assertEqual(command.calls, [])
                self.assert_clean()

    def test_codesign_categories_are_fixed_and_do_not_return_diagnostic_text(self):
        cases = [(2, b"sensitive", "argument-configuration"),
                 (1, b"Warning: unable to build chain to self-signed root for signer sensitive", "certificate-chain"),
                 (1, b"User interaction is not allowed sensitive", "keychain-interaction"),
                 (1, b"codesign_allocate: sensitive", "allocation-tool"),
                 (1, b"errSecInternalComponent sensitive", "signing-service"),
                 (1, b"sensitive unknown error", "unclassified-signing-failure")]
        for code, message, category in cases:
            self.assertEqual(MODULE.codesign_failure_category(code, message), category)

    def test_diagnostic_stream_is_closed_on_failure_timeout_overflow_and_success(self):
        for kind in ("failure", "timeout", "overflow", "success"):
            with self.subTest(kind=kind):
                payload = b"sensitive errSecInternalComponent" if kind != "overflow" else b"x" * (MODULE.MAX_OUTPUT_BYTES + 1)
                process = Mock(stdout=None, stderr=io.BytesIO(payload))
                process.wait.side_effect = [subprocess.TimeoutExpired(["tool", "sensitive"], 60) if kind == "timeout" else (1 if kind == "failure" else 0), 0]
                with patch.object(MODULE.subprocess, "Popen", return_value=process), \
                        patch.object(MODULE, "os", SimpleNamespace(killpg=Mock())), \
                        patch.object(MODULE, "signal", SimpleNamespace(SIGKILL=9)):
                    if kind == "success":
                        self.assertEqual(MODULE.Commands({})("Synthetic signing", ["tool"], codesign_diagnostics=True), b"")
                    else:
                        with self.assertRaises(MODULE.ValidationError) as error:
                            MODULE.Commands({})("Synthetic signing", ["tool"], codesign_diagnostics=True)
                        self.assertNotIn("sensitive", str(error.exception))
                self.assertTrue(process.stderr.closed)

    @unittest.skipUnless(os.name == "posix", "Diagnostic process-group execution is a hosted macOS/POSIX contract")
    def test_real_diagnostic_timeout_and_output_cap_are_bounded_and_close_stderr(self):
        real_popen = MODULE.subprocess.Popen
        for source in ("import sys,time; sys.stderr.write('sensitive'); sys.stderr.flush(); time.sleep(30)",
                       "import sys,time; sys.stderr.write('x'*300000); sys.stderr.flush(); time.sleep(30)"):
            processes = []

            def start(*args, **kwargs):
                process = real_popen(*args, **kwargs)
                processes.append(process)
                return process

            start_time = time.monotonic()
            with patch.object(MODULE.subprocess, "Popen", side_effect=start):
                with self.assertRaises(MODULE.ValidationError) as error:
                    MODULE.Commands({})("Synthetic signing", [sys.executable, "-c", source], timeout=0.25, codesign_diagnostics=True)
            self.assertNotIn("sensitive", str(error.exception))
            self.assertLess(time.monotonic() - start_time, 4)
            self.assertEqual(len(processes), 1)
            self.assertIsNotNone(processes[0].poll())
            self.assertTrue(processes[0].stderr.closed)

    def test_all_operational_failures_clean_up(self):
        stages = ["Temporary keychain creation", "Temporary keychain unlock",
                  "Temporary keychain timeout", "Existing identity import",
                  "Temporary signing ACL", "Public certificate inventory",
                  "Pinned public intermediate import", "Public chain inventory", "Temporary signing search list",
                  "Certificate validity", "Private-key identity lookup",
                  "Disposable signing probe compilation", "Existing-key signing probe",
                  "Signing probe verification", "Signing probe certificate extraction",
                  "Read-only notarization authentication"]
        self.env["CHECK_NOTARIZATION"] = "true"
        for stage in stages:
            with self.subTest(stage=stage):
                command = FakeCommands(fail=stage)
                with self.assertRaises(MODULE.ValidationError):
                    MODULE.validate(self.env, command)
                self.assert_clean()
                self.assertLessEqual(sum(c[0] == "Read-only notarization authentication" for c in command.calls), 1)

    def test_fingerprint_private_key_and_signed_certificate_are_separate_gates(self):
        for flag in ("wrong_leaf", "wrong_identity", "wrong_signed_leaf"):
            with self.subTest(flag=flag):
                command = FakeCommands(**{flag: True})
                with self.assertRaises(MODULE.ValidationError):
                    MODULE.validate(self.env, command)
                stages = [call[0] for call in command.calls]
                if flag in ("wrong_leaf", "wrong_identity"):
                    self.assertNotIn("Existing-key signing probe", stages)
                else:
                    self.assertIn("Signing probe certificate extraction", stages)
                self.assert_clean()

    def test_cleanup_failure_and_changed_keychain_configuration_fail_closed(self):
        for command in (FakeCommands(fail="Temporary keychain deletion"), FakeCommands(changed_state=True),
                        FakeCommands(fail="Original search-list restoration")):
            with self.assertRaisesRegex(MODULE.ValidationError, "cleanup could not be verified"):
                MODULE.validate(self.env, command)
            self.assert_clean()

    def test_rejects_non_hosted_non_main_non_manual_and_debug_execution(self):
        for key, value in (("GITHUB_ACTIONS", "false"), ("RUNNER_ENVIRONMENT", "self-hosted"),
                           ("GITHUB_REF", "refs/heads/feature"), ("GITHUB_EVENT_NAME", "pull_request"),
                           ("GITHUB_REPOSITORY", "other/repository"), ("ACTIONS_STEP_DEBUG", "true"),
                           ("RUNNER_DEBUG", "1"), ("RUNNER_DEBUG", "unexpected"),
                           ("ACTIONS_STEP_DEBUG", "unexpected")):
            with self.subTest(key=key):
                command = FakeCommands()
                with self.assertRaises(MODULE.ValidationError):
                    MODULE.validate({**self.env, key: value}, command)
                self.assertEqual(command.calls, [])
        with patch.object(MODULE.platform, "system", return_value="Linux"):
            with self.assertRaises(MODULE.ValidationError):
                MODULE.validate(self.env, FakeCommands())

    def test_input_rejection_never_reaches_keychain(self):
        cases = [("MAC_CERT_P12", "https://example.invalid/key.p12"),
                 ("MAC_CERT_P12", "/private/key.p12"), ("MAC_CERT_P12", "%%%"),
                 ("MAC_CERT_P12", "A" * 65537), ("MAC_CERT_P12", base64.b64encode(b"x").decode()),
                 ("MAC_CERT_PASSWORD", ""), ("MAC_CERT_PASSWORD", "secret\nvalue"),
                 ("APPLE_ID", "invalid"), ("APPLE_TEAM_ID", "OTHERTEAM0"),
                 ("APPLE_APP_SPECIFIC_PASSWORD", "--help"),
                 ("APPLE_ID", "-fixture@example.invalid"),
                 ("CHECK_NOTARIZATION", "yes")]
        for key, value in cases:
            with self.subTest(key=key, value_type=type(value).__name__):
                command = FakeCommands()
                with self.assertRaises(MODULE.ValidationError):
                    MODULE.validate({**self.env, key: value}, command)
                self.assertEqual(command.calls, [])
                self.assert_clean()

    def test_broad_scope_probe_is_strict_and_supports_initial_copy_stage(self):
        env = {"REQUIRE_ENVIRONMENT_ONLY": "true", **{"HAS_" + n: "false" for n in MODULE.SECRET_NAMES}}
        self.assertIn("absence verified", MODULE.check_scope(env))
        for name in MODULE.SECRET_NAMES:
            with self.subTest(name=name):
                bad = {**env, "HAS_" + name: "true"}
                with self.assertRaisesRegex(MODULE.ValidationError, "outside"):
                    MODULE.check_scope(bad)
                self.assertIn("retained", MODULE.check_scope({**bad, "REQUIRE_ENVIRONMENT_ONLY": "false"}))
                for invalid in (None, "", "TRUE", "secret-value"):
                    with self.assertRaises(MODULE.ValidationError):
                        MODULE.check_scope({**env, "HAS_" + name: invalid})

    def test_subprocess_errors_and_timeouts_never_expose_arguments(self):
        command = MODULE.Commands({"MAC_CERT_PASSWORD": "sensitive", "PATH": "untrusted", "HOME": self.temp.name})
        self.assertNotIn("MAC_CERT_PASSWORD", command.env)
        self.assertEqual(command.env["PATH"], "/usr/bin:/bin:/usr/sbin:/sbin")
        with patch.object(MODULE.subprocess, "Popen", side_effect=OSError("sensitive")):
            with self.assertRaises(MODULE.ValidationError) as context:
                command("Import", ["tool", "sensitive"])
        self.assertNotIn("sensitive", str(context.exception))
        process = Mock(stdout=None)
        process.wait.side_effect = subprocess.TimeoutExpired(["tool", "sensitive"], 60)
        process.poll.return_value = 1
        # Emulate Windows' absent POSIX symbols on every host. These mocks
        # exercise timeout cleanup without weakening the Darwin-only helper.
        with patch.object(MODULE, "os", SimpleNamespace()), patch.object(MODULE, "signal", SimpleNamespace()):
            with patch.object(MODULE.subprocess, "Popen", return_value=process), \
                    patch.object(MODULE.os, "killpg", create=True) as terminate_group, \
                    patch.object(MODULE.signal, "SIGKILL", 9, create=True):
                with self.assertRaises(MODULE.ValidationError) as context:
                    command("Import", ["tool", "sensitive"])
                terminate_group.assert_called_with(process.pid, 9)
        self.assertNotIn("sensitive", str(context.exception))

    def test_final_wait_failures_still_settle_reader_close_pipe_and_fail_redacted(self):
        real_thread = MODULE.threading.Thread
        for initial_failure in (False, True):
            for failure in (subprocess.TimeoutExpired(["tool", "sensitive"], 5), OSError("sensitive")):
                with self.subTest(initial_failure=initial_failure, cleanup_failure=type(failure).__name__):
                    ready = MODULE.threading.Event()
                    readers = []
                    process = Mock(stdout=Mock())
                    process.poll.return_value = None
                    process.stdout.read.side_effect = lambda _limit: ready.wait(2) and b"bounded metadata"

                    def wait(timeout):
                        if timeout == 60 and initial_failure:
                            raise subprocess.TimeoutExpired(["tool", "sensitive"], timeout)
                        ready.set()
                        if timeout == 5:
                            raise failure
                        return 0

                    def reader_thread(*args, **kwargs):
                        thread = real_thread(*args, **kwargs)
                        readers.append(thread)
                        return thread

                    process.wait.side_effect = wait
                    with patch.object(MODULE.subprocess, "Popen", return_value=process), \
                            patch.object(MODULE, "os", SimpleNamespace(killpg=Mock())), \
                            patch.object(MODULE, "signal", SimpleNamespace(SIGKILL=9)), \
                            patch.object(MODULE.threading, "Thread", side_effect=reader_thread):
                        with self.assertRaisesRegex(MODULE.ValidationError, "cleanup could not be verified") as context:
                            MODULE.Commands({})("Synthetic import", ["tool", "sensitive"], capture=True)
                        MODULE.os.killpg.assert_called_with(process.pid, 9)
                    self.assertNotIn("sensitive", str(context.exception))
                    self.assertEqual([call.kwargs["timeout"] for call in process.wait.call_args_list], [60, 5])
                    self.assertEqual(len(readers), 1)
                    self.assertTrue(readers[0].daemon)
                    self.assertFalse(readers[0].is_alive())
                    process.stdout.close.assert_called_once_with()

    def test_final_group_cleanup_failure_cannot_return_success(self):
        process = Mock(stdout=None)
        process.wait.return_value = 0
        terminate = Mock(side_effect=[None, OSError("sensitive")])
        with patch.object(MODULE.subprocess, "Popen", return_value=process), \
                patch.object(MODULE, "os", SimpleNamespace(killpg=terminate)), \
                patch.object(MODULE, "signal", SimpleNamespace(SIGKILL=9)):
            with self.assertRaisesRegex(MODULE.ValidationError, "cleanup could not be verified") as context:
                MODULE.Commands({})("Synthetic command", ["tool", "sensitive"])
        self.assertNotIn("sensitive", str(context.exception))
        self.assertEqual(process.wait.call_count, 2)
        self.assertEqual(terminate.call_count, 2)

    def test_unsettled_reader_is_not_closed_and_cleanup_failure_is_redacted(self):
        process = Mock(stdout=Mock())
        process.wait.return_value = 0
        reader = Mock()
        reader.is_alive.return_value = True
        with patch.object(MODULE.subprocess, "Popen", return_value=process), \
                patch.object(MODULE, "os", SimpleNamespace(killpg=Mock())), \
                patch.object(MODULE, "signal", SimpleNamespace(SIGKILL=9)), \
                patch.object(MODULE.threading, "Thread", return_value=reader):
            with self.assertRaisesRegex(MODULE.ValidationError, "cleanup could not be verified"):
                MODULE.Commands({})("Synthetic command", ["tool", "sensitive"], capture=True)
        self.assertEqual(reader.join.call_count, 2)
        for call in reader.join.call_args_list:
            self.assertEqual(call.kwargs, {"timeout": 2})
        process.stdout.close.assert_not_called()

    @unittest.skipUnless(os.name == "posix", "Process-group execution is a hosted macOS/POSIX contract")
    def test_real_synthetic_subprocess_timeout_and_output_cap_are_bounded(self):
        command = MODULE.Commands({})
        for source in ("import time; time.sleep(30)",
                       "import sys,time; sys.stdout.write('x'*300000); sys.stdout.flush(); time.sleep(30)"):
            with self.subTest(source_kind=source.split(';')[0]):
                start = time.monotonic()
                with self.assertRaises(MODULE.ValidationError):
                    command("Synthetic command", [sys.executable, "-c", source], True, timeout=0.25)
                self.assertLess(time.monotonic() - start, 4)

    @unittest.skipUnless(hasattr(os, "fork"), "Forked descendant regression is a macOS/POSIX contract")
    def test_exited_leader_with_descendant_stdout_does_not_hang(self):
        # Child holds inherited stdout after its leader exits. It writes a marker
        # if it survives cleanup; no host process or real credential is involved.
        marker = Path(self.temp.name) / "descendant-survived"
        source = (
            "import os,time,pathlib,sys\n"
            "if os.fork():\n"
            " os._exit(0)\n"
            "time.sleep(0.5)\n"
            "pathlib.Path(sys.argv[1]).write_text('survived')\n"
            "time.sleep(30)\n"
        )
        command = MODULE.Commands({})
        start = time.monotonic()
        self.assertEqual(command("Synthetic exited leader", [sys.executable, "-c", source, str(marker)], True, timeout=1), b"")
        self.assertLess(time.monotonic() - start, 4)
        time.sleep(0.7)
        self.assertFalse(marker.exists())

    def test_cli_redacts_unexpected_errors_and_restores_signal_handlers(self):
        output = io.StringIO()
        handlers = {sig: MODULE.signal.getsignal(sig) for sig in (MODULE.signal.SIGINT, MODULE.signal.SIGTERM)}
        with patch.object(MODULE, "validate", side_effect=RuntimeError("sensitive private value")):
            with contextlib.redirect_stdout(output):
                self.assertEqual(MODULE.main([], self.env), 1)
        self.assertNotIn("sensitive private value", output.getvalue())
        self.assertIn("suppressed", output.getvalue())
        for sig, handler in handlers.items():
            self.assertEqual(MODULE.signal.getsignal(sig), handler)


if __name__ == "__main__":
    unittest.main()
