// Record paths from this packaging run only. The app is complete after signing,
// notarization (when configured), and any installer targets have finished.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const products = [];
const artifacts = new Map();

exports.afterPack = (context) => {
  if (
    process.env.CI ||
    !['darwin', 'mas'].includes(context.electronPlatformName)
  )
    return;
  const { packager, arch, appOutDir } = context;
  if (!artifacts.has(packager)) {
    const files = new Map();
    artifacts.set(packager, files);
    packager.info.onArtifactCreated((event) => {
      if (event.packager === packager && event.file)
        files.set(event.file, event.arch);
    });
  }
  products.push({
    packager,
    arch,
    app: path.join(appOutDir, packager.appInfo.productFilename + '.app'),
  });
};

exports.afterAllArtifactBuild = (result) => {
  try {
    for (const { packager, arch, app } of products) {
      // Universal packaging removes the intermediate x64 and arm64 slices.
      if (!fs.existsSync(app) && /-(x64|arm64)-temp$/.test(path.dirname(app)))
        continue;
      const args = [path.join(__dirname, 'retain-build.py'), app];
      for (const [file, fileArch] of artifacts.get(packager)) {
        // The MAS builder reports x64 for its .pkg event on every architecture.
        // It writes that installer directly alongside its matching app.
        const adjacentInstaller =
          path.extname(file) === '.pkg' &&
          path.dirname(file) === path.dirname(app);
        if (
          result.artifactPaths.includes(file) &&
          (adjacentInstaller || fileArch == null || fileArch === arch)
        ) {
          args.push('--extra', file);
        }
      }
      execFileSync('python3', args, { stdio: 'inherit' });
    }
  } finally {
    products.length = 0;
    artifacts.clear();
  }
  return [];
};
