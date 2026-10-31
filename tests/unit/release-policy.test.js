const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const {
  releaseVersion,
  releaseTag,
  resolveRelease,
  classifyVersionCommit,
} = require('../../scripts/release-policy');
const {
  verifyReleaseEnvironment,
} = require('../../scripts/verify-release-environment');

describe('release input validation', () => {
  it('accepts canonical numeric versions and tags', () => {
    expect(releaseVersion('0.0.228')).toBe('0.0.228');
    expect(releaseTag('v10.20.30')).toBe('v10.20.30');
  });

  it.each([
    '',
    '01.2.3',
    '1.2',
    '1.2.3-beta',
    '1.2.3\n',
    '1.2.3\r',
    '1.2.3\u2028',
    '1.2.3\nsha=malicious',
    '1.2.3;echo unsafe',
    '$(echo unsafe)',
    '--help',
    '1.2.3^{commit}',
  ])('rejects noncanonical or executable input %j', (value) => {
    expect(() => releaseVersion(value)).toThrow();
    expect(() => releaseTag(`v${value}`)).toThrow();
  });
});

describe('release provenance against actual git history', () => {
  let directory;
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: directory,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  const write = (name, content) => {
    const destination = path.join(directory, name);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, content);
  };
  const writeJSON = (name, content) => write(name, JSON.stringify(content));
  const readJSON = (name) =>
    JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
  const commit = (message) => {
    git('add', '.');
    git('commit', '-qm', message);
    return git('rev-parse', 'HEAD');
  };
  const bump = () => {
    const manifest = readJSON('package.json');
    manifest.version = '0.0.229';
    writeJSON('package.json', manifest);
    const lock = readJSON('package-lock.json');
    lock.version = lock.packages[''].version = '0.0.229';
    writeJSON('package-lock.json', lock);
    write('markdown-viewer/src/main.js', "const APP_VERSION = '0.0.229';\n");
    write(
      'CHANGELOG.md',
      '# Changelog\n\n## v0.0.229 — 2026-10-31\n\n- Security fixes\n\n## v0.0.228 — 2026-10-30\n\n- Previous release\n'
    );
  };

  beforeEach(() => {
    directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'specdown-release-test-')
    );
    git('init', '-q', '-b', 'main');
    git('config', 'user.name', 'Release Policy Test');
    git('config', 'user.email', 'release-policy@example.invalid');
    git('config', 'commit.gpgsign', 'false');
    writeJSON('package.json', { name: 'specdown', version: '0.0.228' });
    writeJSON('package-lock.json', {
      version: '0.0.228',
      packages: { '': { version: '0.0.228' } },
    });
    write('markdown-viewer/src/main.js', "const APP_VERSION = '0.0.228';\n");
    write(
      'CHANGELOG.md',
      '# Changelog\n\n## v0.0.228 — 2026-10-30\n\n- Previous release\n'
    );
    commit('baseline');
    git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  });

  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

  it('prepares ordinary source changes and releases a strict version-only follow-up', () => {
    write('desktop/main.js', 'module.exports = {};\n');
    commit('fix: normal source change');
    expect(classifyVersionCommit(directory)).toBe('prepare');
    bump();
    commit('chore: version proposal');
    expect(classifyVersionCommit(directory)).toBe('release');
  });

  it.each(['source', 'manifest', 'lock', 'renderer', 'history', 'skip'])(
    'refuses a version proposal containing %s changes',
    (kind) => {
      bump();
      if (kind === 'source')
        write('desktop/main.js', 'unexpected source change');
      if (kind === 'manifest') {
        const manifest = readJSON('package.json');
        manifest.scripts = { postinstall: 'echo unexpected' };
        writeJSON('package.json', manifest);
      }
      if (kind === 'lock') {
        const lock = readJSON('package-lock.json');
        lock.packages.unexpected = { version: '1.0.0' };
        writeJSON('package-lock.json', lock);
      }
      if (kind === 'renderer') {
        write(
          'markdown-viewer/src/main.js',
          "const APP_VERSION = '0.0.229';\nunsafe();\n"
        );
      }
      if (kind === 'history')
        write('CHANGELOG.md', '## v0.0.229 — 2026-10-31\n');
      if (kind === 'skip')
        writeJSON('package.json', { name: 'specdown', version: '0.0.230' });
      commit('looks like a version bump');
      expect(() => classifyVersionCommit(directory)).toThrow();
    }
  );

  it('resolves only an existing tag whose version matches reviewed main history', () => {
    git('tag', 'v0.0.228');
    expect(resolveRelease('v0.0.228', directory)).toEqual({
      tag: 'v0.0.228',
      sha: git('rev-parse', 'HEAD'),
      version: '0.0.228',
    });
    git('tag', 'v9.9.9');
    expect(() => resolveRelease('v9.9.9', directory)).toThrow(/does not match/);
    expect(() => resolveRelease('v0.0.227', directory)).toThrow();
  });

  it('rejects a correctly versioned tag on an unreviewed branch', () => {
    git('switch', '-qc', 'unreviewed');
    bump();
    commit('unreviewed release');
    git('tag', 'v0.0.229');
    expect(() => resolveRelease('v0.0.229', directory)).toThrow();
  });
});

describe('independent release approval environment', () => {
  let saved;
  const protection = () => ({
    protection_rules: [
      {
        type: 'required_reviewers',
        prevent_self_review: true,
        reviewers: [{ id: 1 }],
      },
    ],
    can_admins_bypass: false,
    deployment_branch_policy: { custom_branch_policies: true },
  });
  const branches = () => ({
    total_count: 1,
    branch_policies: [{ name: 'main', type: 'branch' }],
  });
  const responses = (environment, policy = branches()) => {
    global.fetch.mockReset();
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => environment })
      .mockResolvedValueOnce({ ok: true, json: async () => policy });
  };

  beforeEach(() => {
    saved = { ...process.env };
    process.env.GITHUB_REPOSITORY = 'cbremer/specdown';
    process.env.GITHUB_API_URL = 'https://api.github.com';
    process.env.GH_TOKEN = 'test-only-token';
  });
  afterEach(() => {
    process.env = saved;
  });

  it('accepts independently approved, main-only deployment rules', async () => {
    responses(protection());
    await expect(
      verifyReleaseEnvironment('desktop-release')
    ).resolves.toBeUndefined();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it.each(['missing', 'self', 'bypass', 'branches'])(
    'fails closed for %s protection',
    async (kind) => {
      const environment = protection();
      if (kind === 'missing') environment.protection_rules = [];
      if (kind === 'self')
        environment.protection_rules[0].prevent_self_review = false;
      if (kind === 'bypass') environment.can_admins_bypass = true;
      if (kind === 'branches') environment.deployment_branch_policy = null;
      responses(environment);
      await expect(
        verifyReleaseEnvironment('desktop-release')
      ).rejects.toThrow();
    }
  );

  it.each([
    {
      total_count: 2,
      branch_policies: [
        { name: 'main', type: 'branch' },
        { name: '*', type: 'branch' },
      ],
    },
    { total_count: 1, branch_policies: [{ name: 'main', type: 'tag' }] },
    { total_count: 1, branch_policies: [{ name: '*', type: 'branch' }] },
  ])(
    'rejects branches or tags outside the main-only boundary',
    async (policy) => {
      responses(protection(), policy);
      await expect(
        verifyReleaseEnvironment('desktop-release')
      ).rejects.toThrow();
    }
  );

  it('does not treat an inaccessible environment as protected', async () => {
    global.fetch.mockReset().mockResolvedValue({ ok: false, status: 403 });
    await expect(verifyReleaseEnvironment('desktop-release')).rejects.toThrow(
      /403/
    );
  });
});

describe('workflow account boundaries', () => {
  const workflow = (name) =>
    fs.readFileSync(
      path.join(__dirname, '../../.github/workflows', name),
      'utf8'
    );

  it('keeps iOS release validation free of Apple account calls and credentials', () => {
    const source = workflow('ios-release.yml');
    expect(source).toContain('CODE_SIGNING_ALLOWED=NO');
    expect(source).toContain('set -euo pipefail');
    expect(source).not.toMatch(
      /secrets\.|allowProvisioningUpdates|authenticationKey|altool|exportArchive/
    );
  });

  it('handles desktop release tags as environment data', () => {
    const source = workflow('desktop.yml');
    expect(source).toContain('RELEASE_TAG: ${{ inputs.release-tag }}');
    expect(source).toContain('node scripts/release-policy.js resolve');
    expect(source).not.toMatch(/run: [^\n]*\$\{\{ inputs\.release-tag/);
    expect(source).toContain('verify-release-environment.js desktop-release');
  });
});
