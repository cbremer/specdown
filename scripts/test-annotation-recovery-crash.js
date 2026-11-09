// Actual editor crash boundaries in stock Electron with disposable profiles.
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const executable =
  process.env.RECOVERY_ELECTRON ||
  '/private/tmp/specdown-icons-electron45/runtime/Electron.app/Contents/MacOS/Electron';
const child = path.join(__dirname, 'test-annotation-recovery-crash-child.js');
const results = [];
for (const boundary of ['prepared', 'committed', 'discarded']) {
  const profile = fs.mkdtempSync(
    path.join(os.tmpdir(), 'specdown-synthetic-crash-')
  );
  fs.writeFileSync(path.join(profile, 'synthetic-probe'), 'recovery');
  const killed = spawnSync(executable, [child, profile, boundary], {
    encoding: 'utf8',
    timeout: 30000,
  });
  if (killed.signal !== 'SIGKILL')
    throw new Error(
      `Expected actual process kill at ${boundary}: ${killed.status} ${killed.signal} ${killed.stderr} ${killed.stdout}`
    );
  const resumed = spawnSync(
    executable,
    [child, profile, boundary === 'discarded' ? 'resume-discarded' : 'resume'],
    {
      encoding: 'utf8',
      timeout: 30000,
    }
  );
  if (resumed.status !== 0)
    throw new Error(`Resume failed: ${resumed.stderr} ${resumed.stdout}`);
  results.push({
    boundary,
    signal: killed.signal,
    profile,
    result: JSON.parse(
      fs.readFileSync(path.join(profile, 'result.json'), 'utf8')
    ),
  });
}
console.log(JSON.stringify(results, null, 2));
