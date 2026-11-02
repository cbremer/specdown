// Shared security contract: synthetic inputs only; no owner profiles or signing.
function embeddedProfileContract(createEnvironment) {
  let fs, path, os, guard, execFileSync;
  let root, app, profile, input;
  beforeEach(() => {
    ({ fs, path, os, guard, execFileSync } = createEnvironment());
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'specdown-profile-test-'));
    app = path.join(root, 'SpecDown.app');
    fs.mkdirSync(path.join(app, 'Contents'), { recursive: true, mode: 0o755 });
    profile = path.join(app, 'Contents/embedded.provisionprofile');
    input = path.join(root, 'private-source.provisionprofile');
    fs.writeFileSync(input, 'SYNTHETIC PUBLIC PROFILE', { mode: 0o600 });
    fs.copyFileSync(input, profile);
    fs.chmodSync(profile, 0o600);
    execFileSync.mockReset();
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('changes only the embedded copy to 0644, preserving private source bytes and mode', () => {
    const old = fs.readFileSync(input);
    expect(guard.normalizeEmbeddedProfile(app)).toMatchObject({
      previousMode: 0o600,
      mode: 0o644,
    });
    expect(fs.statSync(profile).mode & 0o7777).toBe(0o644);
    expect(fs.readFileSync(profile)).toEqual(old);
    expect(fs.statSync(input).mode & 0o7777).toBe(0o600);
    expect(fs.readFileSync(input)).toEqual(old);
    expect(guard.normalizeEmbeddedProfile(app).previousMode).toBe(0o644);
  });

  it.each(['symlink', 'hardlink'])(
    'rejects a %s to the private source without chmodding it',
    (kind) => {
      const old = fs.readFileSync(input);
      fs.unlinkSync(profile);
      (kind === 'symlink' ? fs.symlinkSync : fs.linkSync)(input, profile);
      expect(() => guard.normalizeEmbeddedProfile(app)).toThrow();
      expect(fs.statSync(input).mode & 0o7777).toBe(0o600);
      expect(fs.readFileSync(input)).toEqual(old);
    }
  );

  it('rejects replacement of the profile pathname while its descriptor is open', () => {
    const chmod = fs.fchmodSync.bind(fs);
    const spy = jest.spyOn(fs, 'fchmodSync').mockImplementation((fd, mode) => {
      chmod(fd, mode);
      fs.unlinkSync(profile);
      fs.writeFileSync(profile, 'REPLACEMENT', { mode: 0o644 });
    });
    try {
      expect(() => guard.normalizeEmbeddedProfile(app)).toThrow(
        'changed during normalization'
      );
      expect(fs.statSync(input).mode & 0o7777).toBe(0o600);
      expect(fs.readFileSync(input, 'utf8')).toBe('SYNTHETIC PUBLIC PROFILE');
    } finally {
      spy.mockRestore();
    }
  });

  it('rejects a linked Contents directory', () => {
    fs.renameSync(path.join(app, 'Contents'), path.join(root, 'outside'));
    fs.symlinkSync(path.join(root, 'outside'), path.join(app, 'Contents'));
    expect(() => guard.normalizeEmbeddedProfile(app)).toThrow('real directory');
    expect(
      fs.statSync(path.join(root, 'outside/embedded.provisionprofile')).mode &
        0o7777
    ).toBe(0o600);
  });

  it('requires the profile except for explicit local unprovisioned mode', () => {
    fs.unlinkSync(profile);
    expect(() => guard.normalizeEmbeddedProfile(app)).toThrow();
    expect(guard.normalizeEmbeddedProfile(app, true).profile).toBe(
      'absent-local-unprovisioned'
    );
  });

  it('checks every other bundle file rather than silently changing its mode', () => {
    guard.normalizeEmbeddedProfile(app);
    fs.writeFileSync(path.join(app, 'Contents/private-resource'), 'fixture', {
      mode: 0o600,
    });
    expect(() => guard.validateAppPermissions(app)).toThrow('not publicly');
    expect(
      fs.statSync(path.join(app, 'Contents/private-resource')).mode & 0o7777
    ).toBe(0o600);
  });

  it('accepts internal links, rejects links outside the bundle and nontraversable directories', () => {
    guard.normalizeEmbeddedProfile(app);
    const alias = path.join(app, 'Contents/alias');
    fs.symlinkSync('embedded.provisionprofile', alias);
    expect(guard.validateAppPermissions(app).links).toBe(1);
    fs.unlinkSync(alias);
    fs.symlinkSync('../../private-source.provisionprofile', alias);
    expect(() => guard.validateAppPermissions(app)).toThrow('escaping');
    fs.unlinkSync(alias);
    fs.chmodSync(path.join(app, 'Contents'), 0o744);
    expect(() => guard.validateAppPermissions(app)).toThrow('not publicly');
  });

  function context(target = 'mas') {
    return {
      electronPlatformName: 'mas',
      appOutDir: root,
      targets: [{ name: target }],
      packager: {
        config: { appId: 'com.mosaicpando.specdown', masDev: {} },
        appInfo: { productFilename: 'SpecDown' },
      },
    };
  }

  it('runs read-only strict signature verification after normalization and fails if it fails', () => {
    execFileSync.mockImplementation((command, args) => {
      expect(command).toBe('/usr/bin/codesign');
      expect(args).toEqual(['--verify', '--deep', '--strict', app]);
      expect(fs.statSync(profile).mode & 0o7777).toBe(0o644);
      throw new Error('signature verification failed');
    });
    expect(() => guard.afterSign(context())).toThrow(
      'signature verification failed'
    );
    expect(execFileSync).toHaveBeenCalledTimes(1);
  });

  it('does not touch direct builds, and permits missing profiles only on explicit local mas-dev', () => {
    guard.afterSign({ electronPlatformName: 'darwin' });
    expect(execFileSync).not.toHaveBeenCalled();
    expect(fs.statSync(profile).mode & 0o7777).toBe(0o600);
    fs.unlinkSync(profile);
    const local = context('mas-dev');
    local.packager.config.masDev.preAutoEntitlements = false;
    expect(() => guard.afterSign(local)).not.toThrow();
    const store = context();
    store.packager.config.masDev.preAutoEntitlements = false;
    expect(() => guard.afterSign(store)).toThrow();
  });
}

module.exports = { embeddedProfileContract };
