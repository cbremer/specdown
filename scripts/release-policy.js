// Release inputs are data. Keep this module independent of npm dependencies.
const { execFileSync } = require('child_process');
const fs = require('fs');
const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const RELEASE_FILES = [
  'CHANGELOG.md',
  'markdown-viewer/src/main.js',
  'package-lock.json',
  'package.json',
];
function releaseVersion(value) {
  if (
    typeof value !== 'string' ||
    value !== value.trim() ||
    !VERSION_PATTERN.test(value)
  )
    throw new Error('Expected a numeric major.minor.patch version');
  return value;
}
function releaseTag(value) {
  if (typeof value !== 'string' || value[0] !== 'v')
    throw new Error('Expected a v-prefixed release tag');
  releaseVersion(value.slice(1));
  return value;
}
function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}
function resolveRelease(tag, cwd = process.cwd()) {
  releaseTag(tag);
  const sha = git(['rev-parse', '--verify', `refs/tags/${tag}^{commit}`], cwd);
  git(['merge-base', '--is-ancestor', sha, 'origin/main'], cwd);
  const version = JSON.parse(git(['show', `${sha}:package.json`], cwd)).version;
  if (`v${releaseVersion(version)}` !== tag)
    throw new Error('Tag does not match the packaged version');
  return { tag, sha, version };
}
function classifyVersionCommit(cwd = process.cwd()) {
  const before = JSON.parse(git(['show', 'HEAD^:package.json'], cwd));
  const after = JSON.parse(git(['show', 'HEAD:package.json'], cwd));
  releaseVersion(before.version);
  releaseVersion(after.version);
  if (before.version === after.version) return 'prepare';
  const parts = before.version.split('.').map(Number);
  parts[2] += 1;
  if (parts.join('.') !== after.version)
    throw new Error('Release commit must increment exactly one patch');
  const changed = git(['diff', '--name-only', 'HEAD^', 'HEAD'], cwd)
    .split('\n')
    .sort();
  if (changed.some((name) => !RELEASE_FILES.includes(name)))
    throw new Error('Version commit contains non-release files');
  const previousVersion = before.version;
  before.version = after.version;
  if (JSON.stringify(before) !== JSON.stringify(after))
    throw new Error('Version commit changes package metadata');
  const oldLock = JSON.parse(git(['show', 'HEAD^:package-lock.json'], cwd));
  const newLock = JSON.parse(git(['show', 'HEAD:package-lock.json'], cwd));
  oldLock.version = after.version;
  oldLock.packages[''].version = after.version;
  if (JSON.stringify(oldLock) !== JSON.stringify(newLock))
    throw new Error('Version commit changes dependencies');
  const oldMain = git(['show', 'HEAD^:markdown-viewer/src/main.js'], cwd);
  const newMain = git(['show', 'HEAD:markdown-viewer/src/main.js'], cwd);
  if (
    oldMain.replace(
      `const APP_VERSION = '${previousVersion}';`,
      `const APP_VERSION = '${after.version}';`
    ) !== newMain
  )
    throw new Error('Version commit changes application code');
  const oldLog = git(['show', 'HEAD^:CHANGELOG.md'], cwd);
  const newLog = git(['show', 'HEAD:CHANGELOG.md'], cwd);
  if (
    !newLog.includes(oldLog.replace(/^# Changelog\s*/, '')) ||
    !newLog.includes(`## v${after.version} — `)
  )
    throw new Error('Version commit does not preserve release history');
  return 'release';
}
module.exports = {
  releaseVersion,
  releaseTag,
  resolveRelease,
  classifyVersionCommit,
  RELEASE_FILES,
};
if (require.main === module) {
  const command = process.argv[2];
  let values;
  if (command === 'resolve') values = resolveRelease(process.env.RELEASE_TAG);
  else if (command === 'classify') values = { action: classifyVersionCommit() };
  else throw new Error('Unknown release-policy command');
  for (const [key, value] of Object.entries(values)) {
    if (process.env.GITHUB_OUTPUT)
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
    else process.stdout.write(`${key}=${value}\n`);
  }
}
