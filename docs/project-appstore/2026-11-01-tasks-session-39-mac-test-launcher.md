# Session 39: Mac Store test launcher correction

Date: November 1, 2026. Status: **Launcher corrected and reviewed; exact-launch and running-instance guard checks passed.**

Chris reported a prompt about locating a QA Markdown file after following the launcher instructions. Read-only process inspection found the historical Session 37 app running as PID 92192, without the isolated `--user-data-dir` argument. The precise UI text could not be observed: automatic approval review blocked attaching by app path because the method might launch an unisolated copy. No old profile contents were read or changed by the agent. The source's Locate action is the normal request to renew permission for a remembered document; this does not establish which document or grant caused the reported prompt.

The original launcher called `open -a`, which relies on LaunchServices while multiple archived bundles share the Store App ID. Its successful exact-path behavior had not been tested; prior runtime passes used direct executable launches. The observed wrong running app does not by itself prove which action selected it.

The launcher now executes the exact corrected app binary with the explicit QA profile. It refuses to run if any SpecDown main process is already open or the process check fails. It does not terminate apps, change profiles, remove history or touch the separate Specdown Desktop app. The original launcher is backed up adjacent to the corrected command. Shell syntax and independent launcher review pass. Chris confirmed the older app was closed. Running the revised command started only the corrected executable with the complete explicit QA argument; process arguments were verified before UI inspection. The command runs in the foreground, so keep its Terminal window open while testing. The process guard is not an atomic lock against simultaneous external launches; launch one copy at a time.

The signed app and reviewed source are unchanged at `eed62c9`; no rebuild, signing or upload is needed for this launcher correction. Evidence: `ios/DerivedData/mas-local-startup-20261101/launcher-repair.json`.

## Verified follow-up

The corrected app is left running. Its native UI reports the corrected bundle URL, shows a restored document, and has no visible Locate/permission prompt. The current document is owner content; its text is not copied into local evidence, changed, or replaced with a fixture. The earlier synthetic sample restoration evidence remains historical and is not mislabeled as this launch.

A second invocation of the reviewed command while the app was running refused with the intended message. The same sole PID and exact arguments remained unchanged. No duplicate app launched. Exact process, UI-boolean and guard evidence are `launcher-corrected-process.json`, `launcher-ui-result.json`, and `launcher-guard-verification.json`.

Automatic approval review had initially blocked ambiguous app-path attachment. After Chris closed the old app and the exact corrected process/profile were verified, attachment succeeded. That earlier inspection block is resolved; no request to broaden permissions or access the older profile is pending.
