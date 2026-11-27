// electron-builder runs afterPack on each Intel/Apple silicon slice before
// universal merge and before signing. Contents/Helpers is nested code, so
// osx-sign discovers the executable and signs it with entitlementsInherit.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { Arch } = require('builder-util/out/arch');
const retain = require('./retain-electron-build');

const root = path.join(__dirname, '..');

function buildReader(arch, output) {
  const target = { arm64: 'arm64', x64: 'x86_64' }[arch];
  if (!target) throw new Error('Unsupported Mac reader architecture.');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const sdk = execFileSync('xcrun', ['--sdk', 'macosx', '--show-sdk-path'], {
    encoding: 'utf8',
  }).trim();
  // Older supported Macs can still narrate when Foundation Models is absent.
  // Older build SDKs compile the shared source's canImport fallback.
  const weakModel = fs.existsSync(
    path.join(sdk, 'System/Library/Frameworks/FoundationModels.framework')
  )
    ? ['-Xlinker', '-weak_framework', '-Xlinker', 'FoundationModels']
    : [];
  execFileSync(
    'xcrun',
    [
      '--sdk',
      'macosx',
      'swiftc',
      '-sdk',
      sdk,
      ...weakModel,
      '-swift-version',
      '5',
      '-parse-as-library',
      '-O',
      '-target',
      target + '-apple-macos13.0',
      path.join(root, 'ios/SpecDown/AppleIntelligenceServices.swift'),
      path.join(root, 'desktop/native/reader/ReaderHelper.swift'),
      '-o',
      output,
    ],
    { stdio: 'inherit' }
  );
}

exports.afterPack = (context) => {
  if (
    ['darwin', 'mas'].includes(context.electronPlatformName) &&
    context.arch !== Arch.universal
  ) {
    const contents = path.join(
      context.appOutDir,
      context.packager.appInfo.productFilename + '.app',
      'Contents'
    );
    buildReader(
      Arch[context.arch],
      path.join(contents, 'Helpers', 'SpecDownReader')
    );
  }
  retain.afterPack(context);
};

if (require.main === module && process.platform === 'darwin') {
  buildReader(process.arch, path.join(root, 'dist/native/SpecDownReader'));
}
