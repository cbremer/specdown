const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const yaml = require('js-yaml');

const workflow = yaml.load(
  fs.readFileSync(
    path.join(__dirname, '../../.github/workflows/desktop.yml'),
    'utf8'
  )
);
const payload = Buffer.from('SpecDown runtime download fixture\n');
const digest = crypto.createHash('sha256').update(payload).digest('hex');
const names = [
  'electron-v45.1.0-darwin-x64.zip',
  'electron-v45.1.0-darwin-arm64.zip',
  'electron-v45.1.0-win32-x64.zip',
  'electron-v45.1.0-linux-x64.zip',
];

describe('release runtime preparation', () => {
  let directory;
  let assets;
  let manifest;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'specdown-runtime-'));
    assets = names.map((name, index) => ({
      name,
      id: index + 1,
      size: payload.length,
      digest: `sha256:${digest}`,
    }));
    manifest = {
      devDependencies: { electron: '45.1.0' },
      build: {
        electronDownload: {
          checksums: Object.fromEntries(names.map((name) => [name, digest])),
        },
      },
    };
  });

  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

  function execute(platform, body = payload, downloadFails = false) {
    const step = workflow.jobs.build.steps.find(
      (s) => s.name === 'Download verified Electron runtime'
    );
    if (!step) throw new Error('Missing verified runtime download step');
    const source = step.run.match(/node <<'NODE'\n([\s\S]*?)\nNODE/)[1];
    fs.writeFileSync(
      path.join(directory, 'package.json'),
      JSON.stringify(manifest)
    );
    const transport = (program, args, options) => {
      if (program !== 'gh' || args[0] !== 'api')
        throw new Error('Unexpected transport');
      if (args[1] === 'repos/electron/electron/releases/tags/v45.1.0')
        return JSON.stringify({ assets });
      if (
        !/^repos\/electron\/electron\/releases\/assets\/\d+$/.test(args[1]) ||
        !args.includes('Accept: application/octet-stream')
      )
        throw new Error('Unexpected download endpoint');
      if (downloadFails) throw new Error('Vendor transport unavailable');
      fs.writeFileSync(options.stdio[1], body);
    };
    vm.runInNewContext(source, {
      require: (name) =>
        name === 'node:child_process'
          ? { execFileSync: transport }
          : require(name),
      process: {
        platform,
        env: {
          RUNNER_TEMP: directory,
          GITHUB_WORKSPACE: directory,
          GITHUB_ENV: path.join(directory, 'environment'),
        },
      },
      console: { log() {} },
    });
  }

  it.each([
    ['darwin', names.slice(0, 2)],
    ['win32', [names[2]]],
    ['linux', [names[3]]],
  ])(
    'prepares verified %s archives and publishes the build directory',
    (platform, expectedNames) => {
      execute(platform);
      const prepared = path.join(directory, 'specdown-electron-45.1.0');
      expect(fs.readdirSync(prepared).sort()).toEqual(
        [...expectedNames].sort()
      );
      for (const name of expectedNames)
        expect(fs.readFileSync(path.join(prepared, name))).toEqual(payload);
      expect(fs.readFileSync(path.join(directory, 'environment'), 'utf8')).toBe(
        `SPECDOWN_ELECTRON_DIST=${prepared}\n`
      );
    }
  );

  it('rejects corrupt bytes of the correct size without exposing a build input', () => {
    const damaged = Buffer.from(payload);
    damaged[0] ^= 1;
    expect(() => execute('win32', damaged)).toThrow(/verification failed/i);
    expect(fs.existsSync(path.join(directory, 'environment'))).toBe(false);
    expect(
      fs.existsSync(path.join(directory, 'specdown-electron-45.1.0', names[2]))
    ).toBe(false);
  });

  it('requires a pinned checksum for the requested release artifact', () => {
    delete manifest.build.electronDownload.checksums[names[2]];
    expect(() => execute('win32')).toThrow(/pinned checksum/i);
    expect(fs.existsSync(path.join(directory, 'environment'))).toBe(false);
  });

  it('rejects vendor metadata that disagrees with the reviewed pin', () => {
    assets[2].digest = `sha256:${'0'.repeat(64)}`;
    expect(() => execute('win32')).toThrow(/vendor checksum/i);
    expect(fs.existsSync(path.join(directory, 'environment'))).toBe(false);
  });

  it('does not expose a build directory after a transport failure', () => {
    expect(() => execute('win32', payload, true)).toThrow(
      /transport unavailable/i
    );
    expect(fs.existsSync(path.join(directory, 'environment'))).toBe(false);
  });
});
