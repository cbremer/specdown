const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const nativeRequire = createRequire(__filename);
const builderPath = nativeRequire.resolve(
  'app-builder-lib/out/util/electronGet'
);
const { buildElectronArtifactConfig } = nativeRequire(builderPath);
// Use the downloader actually resolved by the packager, not Electron's separate
// install-time downloader. Only external transport is replaced below.
const { downloadArtifact } = createRequire(builderPath)('@electron/get');
const manifest = require('../../package.json');

const fixture = Buffer.from('SpecDown Electron integrity fixture\n');
const fixtureHash = crypto.createHash('sha256').update(fixture).digest('hex');

async function main() {
  const [platform, arch, damaged] = process.argv.slice(2);
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'specdown-integrity-')
  );
  async function configuredDownload(platformName, arch, payload = fixture) {
    const config = await buildElectronArtifactConfig({
      version: manifest.devDependencies.electron,
      artifactName: 'electron',
      platformName,
      arch,
      cacheDir: directory,
      electronDownload: manifest.build.electronDownload,
    });
    const name = `electron-v${manifest.devDependencies.electron}-${platformName}-${arch}.zip`;
    // Substitute the small fixture's digest only when this exact release asset
    // has a valid pin. Missing pins (including after a version bump) retain the
    // real failure path. Release archives are verified separately during QA.
    if (/^[a-f0-9]{64}$/.test(config.checksums?.[name])) {
      config.checksums = { ...config.checksums, [name]: fixtureHash };
    }
    config.downloader = {
      async download(url, destination) {
        if (new URL(url).pathname.endsWith('/SHASUMS256.txt')) {
          throw new Error('Checksum-list endpoint unavailable');
        }
        await fs.writeFile(destination, payload);
      },
    };
    return config;
  }

  try {
    const config = await configuredDownload(
      platform,
      arch,
      damaged ? Buffer.from('damaged archive') : fixture
    );
    const archive = await downloadArtifact(config);
    if (!(await fs.readFile(archive)).equals(fixture))
      throw new Error('Downloaded content changed');
    config.downloader.download = async () => {
      throw new Error('External downloads unavailable');
    };
    if ((await downloadArtifact(config)) !== archive)
      throw new Error('Cache was not reused');
    console.log('Archive and cache verified');
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
