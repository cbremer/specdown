// MAS-only build hooks. No certificate discovery, signing or profile-source access.
// app-builder-lib 26.18.1 runs afterSign before creating the MAS installer, and
// awaits artifactBuildCompleted before publishing/announcing that artifact.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const APP_ID = 'com.mosaicpando.specdown';
const APP_NAME = 'SpecDown.app';
const PROFILE = 'Contents/embedded.provisionprofile';

function requireCondition(condition, message) {
  if (!condition) throw new Error(`MAS permissions: ${message}`);
}

function within(root, filename) {
  const relative = path.relative(root, filename);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== '..' &&
      !path.isAbsolute(relative))
  );
}

function realDirectory(filename) {
  requireCondition(
    fs.lstatSync(filename).isDirectory(),
    `expected real directory: ${filename}`
  );
  return fs.realpathSync(filename);
}

// Never chmod an input profile or follow an embedded link to one. O_NOFOLLOW
// closes the final-component race; nlink=1 rejects aliases to private sources.
function normalizeEmbeddedProfile(app, allowMissing = false) {
  const root = realDirectory(app);
  const contents = realDirectory(path.join(root, 'Contents'));
  requireCondition(
    contents === path.join(root, 'Contents'),
    'Contents must not redirect'
  );
  const embedded = path.join(contents, 'embedded.provisionprofile');
  let fd;
  try {
    fd = fs.openSync(embedded, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  } catch (error) {
    if (allowMissing && error.code === 'ENOENT')
      return { profile: 'absent-local-unprovisioned' };
    throw error;
  }
  try {
    const before = fs.fstatSync(fd);
    requireCondition(
      before.isFile() && before.nlink === 1,
      'embedded profile must be a singly linked regular file'
    );
    fs.fchmodSync(fd, 0o644);
    const after = fs.fstatSync(fd);
    const current = fs.lstatSync(embedded);
    requireCondition(
      after.mode % 0o10000 === 0o644 &&
        current.ino === after.ino &&
        current.dev === after.dev &&
        current.nlink === 1,
      'embedded profile changed during normalization'
    );
    return {
      profile: PROFILE,
      previousMode: before.mode & 0o7777,
      mode: 0o644,
    };
  } finally {
    fs.closeSync(fd);
  }
}

function checkMode(mode, kind, name) {
  if (kind === 'link') return;
  const required = kind === 'directory' ? 0o555 : 0o444;
  requireCondition(
    (mode & required) === required,
    `not publicly readable/traversable: ${name}`
  );
  requireCondition(
    (mode & 0o7022) === 0,
    `special or group/world-write permissions: ${name}`
  );
}

function validateAppPermissions(app) {
  const root = realDirectory(app);
  const counts = { files: 0, directories: 0, links: 0 };
  function visit(filename) {
    const info = fs.lstatSync(filename);
    const relative = path.relative(root, filename) || '.';
    if (info.isSymbolicLink()) {
      const target = fs.readlinkSync(filename);
      requireCondition(
        !path.isAbsolute(target),
        `absolute bundle link: ${relative}`
      );
      requireCondition(
        within(root, fs.realpathSync(filename)),
        `escaping bundle link: ${relative}`
      );
      counts.links++;
    } else if (info.isDirectory()) {
      checkMode(info.mode, 'directory', relative);
      counts.directories++;
      for (const child of fs.readdirSync(filename))
        visit(path.join(filename, child));
    } else {
      requireCondition(info.isFile(), `unsupported bundle object: ${relative}`);
      checkMode(info.mode, 'file', relative);
      counts.files++;
    }
  }
  visit(root);
  return counts;
}

function run(command, args) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    env: { PATH: '/usr/bin:/bin', LC_ALL: 'C' },
  });
}

function afterSign(context) {
  if (context.electronPlatformName !== 'mas') return;
  requireCondition(
    context.packager.config.appId === APP_ID,
    'unexpected MAS app identifier'
  );
  requireCondition(
    `${context.packager.appInfo.productFilename}.app` === APP_NAME,
    'unexpected MAS product name'
  );
  const app = path.join(context.appOutDir, APP_NAME);
  const targets = context.targets.map((target) => target.name);
  const allowMissing =
    targets.length === 1 &&
    targets[0] === 'mas-dev' &&
    context.packager.config.masDev?.preAutoEntitlements === false;
  const profile = normalizeEmbeddedProfile(app, allowMissing);
  const bundle = validateAppPermissions(app);
  // Modes do not change signed content, but fail closed if verification disagrees.
  run('/usr/bin/codesign', ['--verify', '--deep', '--strict', app]);
  console.log(
    `MAS embedded-profile/public-permission guard passed: ${JSON.stringify({ profile, bundle })}`
  );
}

function validateBom(text) {
  const records = [];
  const seen = new Set();
  for (const line of text.trimEnd().split('\n')) {
    const fields = line.split('\t');
    requireCondition(fields.length >= 3, 'malformed BOM record');
    const [name, modeText, owner] = fields;
    requireCondition(!seen.has(name), `duplicate BOM path: ${name}`);
    seen.add(name);
    requireCondition(
      owner === '0/0',
      `installer owner must be root:wheel: ${name}`
    );
    requireCondition(/^[0-7]+$/.test(modeText), `invalid BOM mode: ${name}`);
    const mode = Number.parseInt(modeText, 8);
    if (name === '.' && mode === 0) continue;
    requireCondition(
      name.startsWith('./') && !name.includes('\\') && !/[\r\0]/.test(name),
      'invalid BOM path'
    );
    const relative = name.slice(2);
    requireCondition(
      relative
        .split('/')
        .every((piece) => piece && piece !== '.' && piece !== '..'),
      `unsafe BOM path: ${name}`
    );
    requireCondition(
      relative === `._${APP_NAME}` ||
        relative === APP_NAME ||
        relative.startsWith(`${APP_NAME}/`),
      `unexpected installer payload: ${name}`
    );
    const type = mode & 0o170000;
    const kind =
      type === 0o040000
        ? 'directory'
        : type === 0o100000
          ? 'file'
          : type === 0o120000
            ? 'link'
            : null;
    requireCondition(kind, `unsupported BOM object: ${name}`);
    checkMode(mode, kind, name);
    // AppleDouble companions inherit their subject's type/mode, but carry no
    // link target. Real symlinks must stay within the installed app.
    if (kind === 'link' && !path.posix.basename(relative).startsWith('._')) {
      const target = fields[5];
      requireCondition(
        typeof target === 'string' &&
          target.length > 0 &&
          !path.posix.isAbsolute(target),
        `invalid BOM link: ${name}`
      );
      const resolved = path.posix.normalize(
        path.posix.join(path.posix.dirname(relative), target)
      );
      requireCondition(
        resolved.startsWith(`${APP_NAME}/`),
        `escaping BOM link: ${name}`
      );
    }
    if (
      relative === `${APP_NAME}/${PROFILE}` ||
      relative === `${APP_NAME}/Contents/._embedded.provisionprofile`
    ) {
      requireCondition(
        mode === 0o100644,
        `embedded public profile must be 0644: ${name}`
      );
    }
    records.push({ name, mode, kind });
  }
  requireCondition(seen.has('.'), 'missing BOM root');
  requireCondition(
    records.some(
      (item) => item.name === `./${APP_NAME}` && item.kind === 'directory'
    ),
    'missing app root'
  );
  requireCondition(
    records.some(
      (item) =>
        item.name === `./${APP_NAME}/${PROFILE}` && item.mode === 0o100644
    ),
    'missing embedded public profile'
  );
  return {
    records: seen.size,
    files: records.filter((item) => item.kind === 'file').length,
    links: records.filter((item) => item.kind === 'link').length,
  };
}

function validateInstaller(pkg) {
  requireCondition(
    path.extname(pkg) === '.pkg' && fs.lstatSync(pkg).isFile(),
    'expected a real .pkg file'
  );
  const temp = fs.mkdtempSync(
    path.join(path.dirname(path.resolve(pkg)), '.mas-permission-check-')
  );
  try {
    const expanded = path.join(temp, 'expanded');
    run('/usr/sbin/pkgutil', ['--expand', path.resolve(pkg), expanded]);
    // productbuild --component produces exactly one component for this app.
    // Fail closed on other shapes instead of accidentally checking one BOM only.
    const component = `${APP_ID}.pkg`;
    requireCondition(
      JSON.stringify(fs.readdirSync(expanded).sort()) ===
        JSON.stringify(['Distribution', component].sort()),
      'unexpected installer components'
    );
    const directory = path.join(expanded, component);
    realDirectory(directory);
    requireCondition(
      JSON.stringify(fs.readdirSync(directory).sort()) ===
        JSON.stringify(['Bom', 'PackageInfo', 'Payload'].sort()),
      'unexpected component files or installer scripts'
    );
    for (const name of ['Bom', 'PackageInfo', 'Payload']) {
      requireCondition(
        fs.lstatSync(path.join(directory, name)).isFile(),
        `invalid component ${name}`
      );
    }
    const info = fs.readFileSync(path.join(directory, 'PackageInfo'), 'utf8');
    requireCondition(
      /<pkg-info\b[^>]*\binstall-location="\/Applications"/.test(info) &&
        /<pkg-info\b[^>]*\bidentifier="com\.mosaicpando\.specdown"/.test(info),
      'unexpected install location or identity'
    );
    const result = validateBom(
      run('/usr/bin/lsbom', [path.join(directory, 'Bom')])
    );
    return result;
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

function artifactBuildCompleted(event) {
  if (path.extname(event.file) !== '.pkg') return;
  requireCondition(
    event.packager.config.appId === APP_ID,
    'unexpected installer app identifier'
  );
  const result = validateInstaller(event.file);
  console.log(
    `MAS installer ownership/public-permission guard passed: ${JSON.stringify(result)}`
  );
}

if (require.main === module) {
  requireCondition(
    process.argv.length === 3,
    'usage: node scripts/mas-package-permissions.js <installer.pkg>'
  );
  console.log(JSON.stringify(validateInstaller(process.argv[2]), null, 2));
}

module.exports = {
  afterSign,
  artifactBuildCompleted,
  normalizeEmbeddedProfile,
  validateAppPermissions,
  validateBom,
  validateInstaller,
};
