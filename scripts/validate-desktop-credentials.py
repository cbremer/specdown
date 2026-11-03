#!/usr/bin/env python3
"""One protected, no-publication check of existing desktop credentials.

Only run with real credentials on an approved GitHub-hosted macOS job. Public
certificate fingerprints are pinned to the retained direct-desktop 0.0.232 app.
No credential contents, subprocess diagnostics, or notarization history are
logged or uploaded. Unit tests supply synthetic inputs and a fake command runner.
"""

import argparse
import base64
import hashlib
import os
from pathlib import Path, PurePosixPath
import platform
import re
import secrets
import shutil
import signal
import subprocess
import tempfile
import threading


SECRET_NAMES = (
    "MAC_CERT_P12", "MAC_CERT_PASSWORD", "APPLE_ID",
    "APPLE_APP_SPECIFIC_PASSWORD", "APPLE_TEAM_ID",
)
EXPECTED_TEAM = "582YQWPT9G"
EXPECTED_CERT_SHA256 = "3E9546741A6FF820AE629E684F70433E20CEB6BDD561812A9F3BE7EBC506A82B"
# codesign requires this public SHA-1 lookup selector; SHA-256 remains the trust
# pin before and after signing. Verified from the same retained public leaf.
EXPECTED_CODESIGN_SELECTOR = "348BDE654F13CAACABB81B4F68AC2D785251400F"
INTERMEDIATE_SHA256 = "F16CD3C54C7F83CEA4BF1A3E6A0819C8AAA8E4A1528FD144715F350643D2DF3A"
INTERMEDIATE_FILE = Path(__file__).with_name("certificates") / "DeveloperIDG2CA.cer"
MAX_P12_BYTES = 49152
MAX_OUTPUT_BYTES = 131072


class ValidationError(Exception):
    """A fixed, non-sensitive stage message safe for the job log."""


def flag(value, name):
    if value not in ("true", "false"):
        raise ValidationError(f"Invalid boolean configuration: {name}")
    return value == "true"


def check_scope(env):
    require = flag(env.get("REQUIRE_ENVIRONMENT_ONLY"), "scope policy")
    available = [name for name in SECRET_NAMES
                 if flag(env.get("HAS_" + name), "secret presence")]
    if require and available:
        raise ValidationError("Signing credentials remain available outside the protected environment")
    return "Broad-scope absence verified" if not available else "Initial migration check: broad copies retained"


def read_inputs(env):
    values = {}
    for name in SECRET_NAMES:
        value = env.get(name)
        if not isinstance(value, str) or not value or "\0" in value:
            raise ValidationError("Signing configuration is incomplete or invalid")
        limit = 65536 if name == "MAC_CERT_P12" else 4096
        if len(value) > limit:
            raise ValidationError("Signing configuration exceeds the supported bounds")
        if name != "MAC_CERT_P12" and any(ord(c) < 32 or ord(c) == 127 for c in value):
            raise ValidationError("Signing configuration contains unsupported control characters")
        values[name] = value
    if values["APPLE_TEAM_ID"] != EXPECTED_TEAM:
        raise ValidationError("The configured team does not match the retained release identity")
    if not re.fullmatch(r"[^\s@]+@[^\s@]+", values["APPLE_ID"]):
        raise ValidationError("The configured Apple account is not a supported account identifier")
    if any(values[name].startswith("-") for name in ("APPLE_ID", "APPLE_APP_SPECIFIC_PASSWORD")):
        raise ValidationError("The configured Apple credentials contain an unsupported option-like value")
    encoded = values["MAC_CERT_P12"]
    if ":" in encoded or encoded.startswith(("/", "~", ".")):
        raise ValidationError("The certificate must be the existing Base64 PKCS12 value, not a URL or path")
    try:
        p12 = base64.b64decode("".join(encoded.split()), validate=True)
    except (ValueError, UnicodeEncodeError):
        raise ValidationError("The certificate is not valid Base64 PKCS12 input") from None
    if not p12 or len(p12) > MAX_P12_BYTES or p12[0] != 0x30:
        raise ValidationError("The certificate is not supported bounded PKCS12 input")
    return values, p12, flag(env.get("CHECK_NOTARIZATION", "false"), "notarization check")


def hosted_context(env):
    if (platform.system() != "Darwin" or env.get("GITHUB_ACTIONS") != "true"
            or env.get("RUNNER_ENVIRONMENT") != "github-hosted"
            or env.get("GITHUB_REPOSITORY") != "cbremer/specdown"
            or env.get("GITHUB_EVENT_NAME") != "workflow_dispatch"
            or env.get("GITHUB_REF") != "refs/heads/main"):
        raise ValidationError("Credential validation requires the approved main-only hosted macOS workflow")
    if env.get("ACTIONS_STEP_DEBUG", "false").lower() != "false" or env.get("RUNNER_DEBUG", "") != "":
        raise ValidationError("Credential validation cannot run with step debug enabled")
    runner_temp = Path(env.get("RUNNER_TEMP", ""))
    if not runner_temp.is_absolute() or runner_temp.is_symlink() or not runner_temp.is_dir():
        raise ValidationError("The hosted runner temporary directory is unavailable")
    return runner_temp


class Commands:
    """Discard diagnostics and bound captured metadata without exposing argv."""

    def __init__(self, env):
        self.env = {key: env[key] for key in ("HOME", "TMPDIR", "DEVELOPER_DIR") if key in env}
        self.env["PATH"] = "/usr/bin:/bin:/usr/sbin:/sbin"

    def __call__(self, stage, args, capture=False, timeout=60, codesign_diagnostics=False):
        if capture and codesign_diagnostics:
            raise ValidationError("Unsupported simultaneous metadata and signing diagnostic capture")
        process = None
        stream = None
        reader = None
        output = []
        read_errors = []

        def stop_group():
            # The leader may already have exited while a child holds stdout.
            # start_new_session makes this only the helper's own process group.
            if process is not None:
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass

        try:
            process = subprocess.Popen(
                args, stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE if capture else subprocess.DEVNULL,
                stderr=subprocess.PIPE if codesign_diagnostics else subprocess.DEVNULL,
                env=self.env, start_new_session=True,
            )
            stream = process.stderr if codesign_diagnostics else process.stdout
            if capture or codesign_diagnostics:
                def read_bounded():
                    try:
                        output.append(stream.read(MAX_OUTPUT_BYTES + 1))
                        if len(output[0]) > MAX_OUTPUT_BYTES:
                            stop_group()
                    except Exception:
                        # Thread tracebacks can contain paths/argv; never emit one.
                        read_errors.append(True)
                reader = threading.Thread(target=read_bounded, daemon=True)
                reader.start()
            code = process.wait(timeout=timeout)
            stop_group()
            if reader:
                reader.join(timeout=2)
                if reader.is_alive() or read_errors or not output or len(output[0]) > MAX_OUTPUT_BYTES:
                    raise ValidationError(f"{stage} did not return bounded metadata")
            if code != 0:
                if codesign_diagnostics:
                    raise ValidationError(f"{stage} failed: {codesign_failure_category(code, output[0])}; details suppressed")
                raise ValidationError(f"{stage} failed; credential details were suppressed")
            return output[0] if capture else b""
        except (OSError, subprocess.SubprocessError):
            raise ValidationError(f"{stage} failed or timed out; credential details were suppressed") from None
        finally:
            if process is not None:
                cleanup_failed = False
                try:
                    stop_group()
                except Exception:
                    cleanup_failed = True
                try:
                    # wait is immediate for an already-reaped leader. Always
                    # attempt it, even if group termination could not be verified.
                    process.wait(timeout=5)
                except Exception:
                    cleanup_failed = True
                reader_settled = reader is None
                if reader:
                    try:
                        reader.join(timeout=2)
                    except Exception:
                        cleanup_failed = True
                    try:
                        reader_settled = not reader.is_alive()
                    except Exception:
                        cleanup_failed = True
                    if not reader_settled:
                        cleanup_failed = True
                # BufferedReader.close can wait on a read lock. Never call it
                # until the reader has settled, even on an exceptional path.
                if stream and reader_settled:
                    try:
                        stream.close()
                    except Exception:
                        cleanup_failed = True
                if cleanup_failed:
                    raise ValidationError(f"{stage} cleanup could not be verified; discard this hosted runner") from None


def keychain_state(command):
    # Metadata queries only. The hosted probe restores the original search list.
    return (
        command("Keychain search-list snapshot", ["/usr/bin/security", "list-keychains", "-d", "user"], True),
        command("Default-keychain snapshot", ["/usr/bin/security", "default-keychain", "-d", "user"], True),
    )


def codesign_failure_category(code, diagnostic):
    """Map bounded private diagnostics to fixed labels; never return their text."""
    message = diagnostic.lower()
    if code == 2:
        return "argument-configuration"
    if b"unable to build chain" in message or b"cssmerr_tp_not_trusted" in message:
        return "certificate-chain"
    if b"user interaction is not allowed" in message or b"errsecinteractionnotallowed" in message:
        return "keychain-interaction"
    if b"codesign_allocate" in message:
        return "allocation-tool"
    if b"errsecinternalcomponent" in message:
        return "signing-service"
    return "unclassified-signing-failure"


def search_list_paths(raw):
    if len(raw) > 32768:
        raise ValidationError("The existing keychain search list exceeds supported bounds")
    try:
        lines = [line.strip() for line in raw.decode("utf-8").splitlines() if line.strip()]
        if len(lines) > 32:
            raise ValueError()
        if any(not line.startswith('"') or not line.endswith('"') for line in lines):
            raise ValueError()
        # security emits literal paths wrapped in quotes, not JSON/shell escapes.
        paths = [line[1:-1] for line in lines]
        if any(not 1 <= len(value) <= 4096 or '"' in value
               or any(ord(c) < 32 or ord(c) == 127 for c in value)
               or value.startswith("//")
               or not PurePosixPath(value).is_absolute()
               or str(PurePosixPath(value)) != value
               or ".." in value.split("/") for value in paths):
            raise ValueError()
        if len(paths) != len(set(paths)):
            raise ValueError()
    except (ValueError, TypeError, UnicodeError):
        raise ValidationError("The existing keychain search list is not supported bounded path metadata") from None
    return paths


def public_intermediate():
    if INTERMEDIATE_FILE.is_symlink() or not INTERMEDIATE_FILE.is_file() or INTERMEDIATE_FILE.stat().st_size > 8192:
        raise ValidationError("The pinned public intermediate certificate is unavailable")
    certificate = INTERMEDIATE_FILE.read_bytes()
    if hashlib.sha256(certificate).hexdigest().upper() != INTERMEDIATE_SHA256:
        raise ValidationError("The public intermediate certificate does not match its reviewed fingerprint")
    return certificate


def public_certificates(pem):
    pattern = rb"-----BEGIN CERTIFICATE-----\s*(.*?)\s*-----END CERTIFICATE-----"
    blocks = re.findall(pattern, pem, re.S)
    if not 1 <= len(blocks) <= 8 or re.sub(pattern, b"", pem, flags=re.S).strip():
        raise ValidationError("Imported certificate inventory is outside the supported bounds")
    try:
        return [base64.b64decode(re.sub(rb"\s", b"", block), validate=True) for block in blocks]
    except ValueError:
        raise ValidationError("Imported certificate metadata is invalid") from None


def expected_leaf(pem):
    matches = [der for der in public_certificates(pem)
               if hashlib.sha256(der).hexdigest().upper() == EXPECTED_CERT_SHA256]
    if len(matches) != 1:
        raise ValidationError("The imported certificate does not match the retained Developer ID identity")
    return matches[0]


def validate(env, command=None):
    runner_temp = hosted_context(env)
    values, p12, check_notarization = read_inputs(env)
    intermediate = public_intermediate()
    command = command or Commands(env)
    baseline = keychain_state(command)
    original_paths = search_list_paths(baseline[0])
    work = Path(tempfile.mkdtemp(prefix="specdown-credential-check-", dir=runner_temp))
    keychain = work / "validation.keychain-db"
    keychain_password = secrets.token_urlsafe(32)  # Temporary container password; no new signing key.
    result = None
    restore_search_list = False
    try:
        cert_file = work / "existing.p12"
        cert_file.write_bytes(p12)
        cert_file.chmod(0o600)
        command("Temporary keychain creation", ["/usr/bin/security", "create-keychain", "-p", keychain_password, str(keychain)])
        command("Temporary keychain unlock", ["/usr/bin/security", "unlock-keychain", "-p", keychain_password, str(keychain)])
        command("Temporary keychain timeout", ["/usr/bin/security", "set-keychain-settings", "-lut", "600", str(keychain)])
        command("Existing identity import", ["/usr/bin/security", "import", str(cert_file), "-k", str(keychain), "-P", values["MAC_CERT_PASSWORD"], "-T", "/usr/bin/codesign"])
        command("Temporary signing ACL", ["/usr/bin/security", "set-key-partition-list", "-S", "apple-tool:,apple:", "-s", "-k", keychain_password, str(keychain)])
        inventory = command("Public certificate inventory", ["/usr/bin/security", "find-certificate", "-a", "-p", str(keychain)], True)
        leaf = expected_leaf(inventory)
        intermediates = [der for der in public_certificates(inventory)
                         if hashlib.sha256(der).hexdigest().upper() == INTERMEDIATE_SHA256]
        if len(intermediates) > 1:
            raise ValidationError("The temporary keychain contains duplicate public intermediates")
        if not intermediates:
            public_file = work / "public-intermediate.cer"
            public_file.write_bytes(intermediate)
            command("Pinned public intermediate import", ["/usr/bin/security", "import", str(public_file), "-k", str(keychain), "-t", "cert"])
            chain_inventory = command("Public chain inventory", ["/usr/bin/security", "find-certificate", "-a", "-p", str(keychain)], True)
            if expected_leaf(chain_inventory) != leaf or sum(der == intermediate for der in public_certificates(chain_inventory)) != 1:
                raise ValidationError("The temporary public certificate chain could not be verified")
        # Mark before mutation: a failed command may still have changed state.
        restore_search_list = True
        command("Temporary signing search list", ["/usr/bin/security", "list-keychains", "-d", "user", "-s", str(keychain), *original_paths])
        leaf_file = work / "public-leaf.der"
        leaf_file.write_bytes(leaf)
        command("Certificate validity", ["/usr/bin/openssl", "x509", "-inform", "DER", "-in", str(leaf_file), "-noout", "-checkend", "0"])
        identity = EXPECTED_CODESIGN_SELECTOR
        identities = command("Private-key identity lookup", ["/usr/bin/security", "find-identity", "-v", "-p", "codesigning", str(keychain)], True)
        if not re.search(rb"\b" + identity.encode() + rb'\s+"Developer ID Application: [^"\r\n]+ \(' + EXPECTED_TEAM.encode() + rb'\)"', identities):
            raise ValidationError("The expected Developer ID certificate has no usable matching private key")
        source = work / "probe.c"
        binary = work / "credential-probe"
        source.write_text("int main(void) { return 0; }\n")
        command("Disposable signing probe compilation", ["/usr/bin/xcrun", "clang", str(source), "-o", str(binary)])
        command("Existing-key signing probe", ["/usr/bin/codesign", "--force", "--sign", identity, "--keychain", str(keychain), "--timestamp=none", "--options", "runtime", str(binary)], codesign_diagnostics=True)
        command("Signing probe verification", ["/usr/bin/codesign", "--verify", "--strict", str(binary)])
        prefix = work / "probe-cert-"
        command("Signing probe certificate extraction", ["/usr/bin/codesign", "--display", "--extract-certificates=" + str(prefix), str(binary)])
        signed_leaf = Path(str(prefix) + "0")
        if signed_leaf.is_symlink() or not signed_leaf.is_file() or signed_leaf.stat().st_size > MAX_P12_BYTES:
            raise ValidationError("The signing probe did not expose a bounded public certificate")
        if hashlib.sha256(signed_leaf.read_bytes()).hexdigest().upper() != EXPECTED_CERT_SHA256:
            raise ValidationError("The signing probe used an unexpected certificate")
        if check_notarization:
            # One read-only request, no retry, upload, history output, or saved profile.
            command("Read-only notarization authentication", ["/usr/bin/xcrun", "notarytool", "history", "--apple-id=" + values["APPLE_ID"], "--password=" + values["APPLE_APP_SPECIFIC_PASSWORD"], "--team-id=" + values["APPLE_TEAM_ID"], "--output-format", "json"], timeout=90)
        result = "Existing Developer ID private-key/certificate pair verified; no app built or published"
        if check_notarization:
            result += "; one read-only notarization authentication check passed"
    finally:
        cleanup_failed = False
        if restore_search_list:
            try:
                command("Original search-list restoration", ["/usr/bin/security", "list-keychains", "-d", "user", "-s", *original_paths])
            except Exception:
                cleanup_failed = True
        try:
            if keychain.exists():
                command("Temporary keychain deletion", ["/usr/bin/security", "delete-keychain", str(keychain)])
        except Exception:
            cleanup_failed = True
        try:
            shutil.rmtree(work)
        except OSError:
            cleanup_failed = True
        try:
            if keychain_state(command) != baseline:
                cleanup_failed = True
        except Exception:
            cleanup_failed = True
        if cleanup_failed or work.exists():
            raise ValidationError("Temporary credential cleanup could not be verified; discard this hosted runner") from None
    return result


def main(argv=None, env=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scope-only", action="store_true")
    args = parser.parse_args(argv)
    env = os.environ if env is None else env
    previous = {}
    try:
        def interrupted(_signal, _frame):
            raise ValidationError("Credential validation was interrupted")
        for sig in (signal.SIGINT, signal.SIGTERM):
            previous[sig] = signal.signal(sig, interrupted)
        print(check_scope(env) if args.scope_only else validate(env))
        return 0
    except ValidationError as error:
        print(str(error))
        return 1
    except Exception:
        print("Credential validation failed; all credential details were suppressed")
        return 1
    finally:
        for sig, handler in previous.items():
            signal.signal(sig, handler)


if __name__ == "__main__":
    raise SystemExit(main())
