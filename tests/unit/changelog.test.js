/**
 * Unit tests for the changelog generator's pure helpers
 * (scripts/generate-changelog.js). The CLI branch is guarded by
 * `require.main === module`, so importing the module here is side-effect-free.
 */

const {
  parseCommitSubject,
  inferType,
  isReleaseNoise,
  formatSection,
  prependSection,
  extractLatestSection,
} = require('../../scripts/generate-changelog');

describe('parseCommitSubject', () => {
  it('parses a plain conventional commit', () => {
    expect(parseCommitSubject('feat: add workspace mode')).toEqual({
      type: 'feat', scope: '', breaking: false, description: 'add workspace mode',
    });
  });

  it('parses scope and breaking marker', () => {
    expect(parseCommitSubject('fix(desktop)!: drop legacy IPC')).toEqual({
      type: 'fix', scope: 'desktop', breaking: true, description: 'drop legacy IPC',
    });
  });

  it('returns null for a non-conventional subject', () => {
    expect(parseCommitSubject('Workspace (folder) mode: browse a folder')).toBeNull();
  });
});

describe('isReleaseNoise', () => {
  it('flags version-bump and merge commits', () => {
    expect(isReleaseNoise('Bump version to v0.0.42 [version bump]')).toBe(true);
    expect(isReleaseNoise('Merge pull request #1 from x/y')).toBe(true);
  });

  it('keeps ordinary commits', () => {
    expect(isReleaseNoise('feat: add thing')).toBe(false);
  });
});

describe('inferType', () => {
  it('maps high-confidence leading verbs to types', () => {
    expect(inferType('Add desktop auto-update')).toBe('feat');
    expect(inferType('Fix diagram controls covering the diagram')).toBe('fix');
    expect(inferType('Refactor the bridge seam')).toBe('refactor');
    expect(inferType('Document the release pipeline')).toBe('docs');
    expect(inferType('Bump dompurify from 3.4.10 to 3.4.11')).toBe('build');
  });

  it('leaves ambiguous verbs uncategorized', () => {
    expect(inferType('Update the thing')).toBe('');
    expect(inferType('Remove dead code')).toBe('');
    expect(inferType('Tweak spacing')).toBe('');
  });
});

describe('formatSection', () => {
  it('groups descriptive commits by inferred type (Add→Features, Fix→Bug Fixes)', () => {
    const out = formatSection(['Add workspace mode', 'Fix a crash'], '0.1.0', '2026-06-15');
    expect(out).toContain('## v0.1.0 — 2026-06-15');
    expect(out).toContain('### Features');
    expect(out).toContain('- Add workspace mode');
    expect(out).toContain('### Bug Fixes');
    expect(out).toContain('- Fix a crash');
    // Inferred entries keep their full subject (no type prefix to strip).
    expect(out.indexOf('### Features')).toBeLessThan(out.indexOf('### Bug Fixes'));
  });

  it('puts uncategorizable descriptive commits under Other Changes', () => {
    const out = formatSection(['Add a feature', 'Tweak some spacing'], '0.1.0', '2026-06-15');
    expect(out).toContain('### Features');
    expect(out).toContain('- Add a feature');
    expect(out).toContain('### Other Changes');
    expect(out).toContain('- Tweak some spacing');
  });

  it('falls back to a flat list when nothing can be categorized', () => {
    const out = formatSection(['Tweak spacing', 'Whatever happened here'], '0.1.0', '2026-06-15');
    expect(out).toContain('- Tweak spacing');
    expect(out).toContain('- Whatever happened here');
    expect(out).not.toContain('###');
  });

  it('groups conventional commits by type, with scopes', () => {
    const out = formatSection(
      ['feat: a', 'fix(ui): b', 'docs: c'],
      '0.2.0', '2026-06-15'
    );
    expect(out).toContain('### Features');
    expect(out.indexOf('### Features')).toBeLessThan(out.indexOf('### Bug Fixes'));
    expect(out).toContain('- **ui:** b');
    expect(out).toContain('### Documentation');
  });

  it('surfaces breaking changes first', () => {
    const out = formatSection(['feat!: big change', 'fix: small'], '1.0.0', '2026-06-15');
    expect(out).toContain('### ⚠ Breaking Changes');
    expect(out.indexOf('Breaking Changes')).toBeLessThan(out.indexOf('### Bug Fixes'));
  });

  it('filters out version-bump and merge noise', () => {
    const out = formatSection(
      ['feat: real', 'Bump version to v0.0.1 [version bump]', 'Merge branch main'],
      '0.3.0', '2026-06-15'
    );
    expect(out).toContain('- real');
    expect(out).not.toContain('version bump');
    expect(out).not.toContain('Merge branch');
  });

  it('handles an empty commit set', () => {
    const out = formatSection([], '0.0.1', '2026-06-15');
    expect(out).toContain('- No notable changes.');
  });
});

describe('prependSection', () => {
  it('puts the new section above prior versions and keeps the title', () => {
    const existing = '# Changelog\n\n## v0.1.0 — 2026-01-01\n\n- old\n';
    const section = '## v0.2.0 — 2026-02-02\n\n- new\n';
    const out = prependSection(existing, section);

    expect(out.indexOf('# Changelog')).toBe(0);
    expect(out.indexOf('v0.2.0')).toBeLessThan(out.indexOf('v0.1.0'));
    expect(out).toContain('- old');
  });

  it('preserves a preamble (e.g. an HTML comment) between title and versions', () => {
    const existing = '# Changelog\n\n<!-- note -->\n';
    const out = prependSection(existing, '## v0.1.0 — 2026-01-01\n\n- first\n');
    expect(out.indexOf('<!-- note -->')).toBeLessThan(out.indexOf('## v0.1.0'));
  });

  it('works from an empty changelog', () => {
    const out = prependSection('', '## v0.1.0 — 2026-01-01\n\n- first\n');
    expect(out).toBe('# Changelog\n\n## v0.1.0 — 2026-01-01\n\n- first\n');
  });
});

describe('extractLatestSection', () => {
  it('returns the most recent version block only', () => {
    const changelog =
      '# Changelog\n\n## v0.2.0 — 2026-02-02\n\n- new\n\n## v0.1.0 — 2026-01-01\n\n- old\n';
    const latest = extractLatestSection(changelog);
    expect(latest).toContain('v0.2.0');
    expect(latest).toContain('- new');
    expect(latest).not.toContain('v0.1.0');
  });

  it('returns empty string when there are no versions', () => {
    expect(extractLatestSection('# Changelog\n\n<!-- nothing yet -->\n')).toBe('');
  });
});
