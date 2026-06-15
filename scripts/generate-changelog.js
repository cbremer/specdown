#!/usr/bin/env node

/**
 * Changelog generator.
 *
 * Pure formatting helpers (exported, unit-tested) plus a small CLI that the
 * release pipeline calls:
 *
 *   node scripts/generate-changelog.js            # prepend the new version's
 *                                                 # section to CHANGELOG.md,
 *                                                 # derived from git history
 *                                                 # since the previous tag.
 *   node scripts/generate-changelog.js --latest   # print the top (most recent)
 *                                                 # section of CHANGELOG.md
 *                                                 # (used for the GitHub Release
 *                                                 # body).
 *
 * Commit subjects are grouped by Conventional-Commit type when present
 * (`feat:`, `fix:`, `docs(scope):`, `feat!:` …); when none of the commits use
 * that convention the section is just a flat bullet list of the subjects, which
 * suits this repo's descriptive commit style.
 */

const CC_TYPE_LABELS = {
  feat: 'Features',
  fix: 'Bug Fixes',
  perf: 'Performance',
  refactor: 'Refactoring',
  docs: 'Documentation',
  test: 'Tests',
  build: 'Build System',
  ci: 'CI',
  chore: 'Chores',
  style: 'Styles',
  revert: 'Reverts',
};

// Section order in the rendered changelog.
const CC_TYPE_ORDER = [
  'feat', 'fix', 'perf', 'refactor', 'docs',
  'test', 'build', 'ci', 'chore', 'style', 'revert',
];

/**
 * Parse a Conventional-Commit subject line.
 * @param {string} subject
 * @returns {{ type: string, scope: string, breaking: boolean, description: string } | null}
 */
function parseCommitSubject(subject) {
  const m = /^(\w+)(\([^)]*\))?(!)?:\s+(.*)$/.exec(String(subject || '').trim());
  if (!m) return null;
  return {
    type: m[1].toLowerCase(),
    scope: m[2] ? m[2].slice(1, -1) : '',
    breaking: Boolean(m[3]),
    description: m[4].trim(),
  };
}

/**
 * Commit subjects that should never appear in release notes (automated bumps,
 * merge commits).
 * @param {string} subject
 */
function isReleaseNoise(subject) {
  const s = String(subject || '');
  return /\[version bump\]/i.test(s) || /^Merge (pull request|branch|remote)/i.test(s);
}

/** @param {{ subject: string, cc: ReturnType<typeof parseCommitSubject> }} entry */
function renderEntry(entry) {
  if (entry.cc) {
    const scope = entry.cc.scope ? `**${entry.cc.scope}:** ` : '';
    return `- ${scope}${entry.cc.description}`;
  }
  return `- ${entry.subject}`;
}

/**
 * Build a single changelog section (markdown) for a version from commit
 * subjects.
 * @param {string[]} commits
 * @param {string} version
 * @param {string} date ISO date (YYYY-MM-DD)
 * @returns {string}
 */
function formatSection(commits, version, date) {
  const clean = (commits || [])
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .filter((s) => !isReleaseNoise(s));

  const lines = [`## v${version} — ${date}`, ''];

  if (clean.length === 0) {
    lines.push('- No notable changes.', '');
    return lines.join('\n');
  }

  const entries = clean.map((subject) => ({ subject, cc: parseCommitSubject(subject) }));
  const anyConventional = entries.some((e) => e.cc && CC_TYPE_LABELS[e.cc.type]);

  // Descriptive (non-conventional) history: a flat list reads best.
  if (!anyConventional) {
    for (const e of entries) lines.push(renderEntry(e));
    lines.push('');
    return lines.join('\n');
  }

  // Conventional history: group by type, breaking changes first.
  const breaking = entries.filter((e) => e.cc && e.cc.breaking);
  if (breaking.length) {
    lines.push('### ⚠ Breaking Changes', '');
    for (const e of breaking) lines.push(renderEntry(e));
    lines.push('');
  }

  /** @type {Record<string, typeof entries>} */
  const groups = {};
  const other = [];
  for (const e of entries) {
    if (e.cc && CC_TYPE_LABELS[e.cc.type]) {
      (groups[e.cc.type] = groups[e.cc.type] || []).push(e);
    } else {
      other.push(e);
    }
  }

  for (const type of CC_TYPE_ORDER) {
    if (!groups[type]) continue;
    lines.push(`### ${CC_TYPE_LABELS[type]}`, '');
    for (const e of groups[type]) lines.push(renderEntry(e));
    lines.push('');
  }

  if (other.length) {
    lines.push('### Other Changes', '');
    for (const e of other) lines.push(renderEntry(e));
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Prepend a new version section to an existing CHANGELOG, preserving the
 * `# Changelog` title, any preamble before the first version, and prior
 * versions below the new one.
 * @param {string} existing
 * @param {string} section
 * @returns {string}
 */
function prependSection(existing, section) {
  const title = '# Changelog';
  let preamble = '';
  let body = '';

  if (existing && existing.trim()) {
    const withoutTitle = existing.replace(/^#\s*Changelog[^\n]*\n?/i, '');
    const idx = withoutTitle.indexOf('\n## ');
    if (idx === -1) {
      preamble = withoutTitle.trim();
    } else {
      preamble = withoutTitle.slice(0, idx).trim();
      body = withoutTitle.slice(idx + 1).trim();
    }
  }

  let out = `${title}\n\n`;
  if (preamble) out += `${preamble}\n\n`;
  out += `${section.trim()}\n`;
  if (body) out += `\n${body}\n`;
  return out;
}

/**
 * Extract the most-recent version section (the first `## …` block) from a
 * CHANGELOG string. Used to populate the GitHub Release body.
 * @param {string} changelog
 * @returns {string}
 */
function extractLatestSection(changelog) {
  const text = String(changelog || '');
  const start = text.indexOf('\n## ');
  if (start === -1) return '';
  const rest = text.slice(start + 1);
  const next = rest.indexOf('\n## ');
  return (next === -1 ? rest : rest.slice(0, next)).trim();
}

module.exports = {
  parseCommitSubject,
  isReleaseNoise,
  formatSection,
  prependSection,
  extractLatestSection,
};

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
if (require.main === module) {
  const fs = require('fs');
  const path = require('path');
  const { execSync } = require('child_process');

  const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
  const readChangelog = () =>
    fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, 'utf8') : '';

  if (process.argv.includes('--latest')) {
    process.stdout.write(`${extractLatestSection(readChangelog())}\n`);
  } else {
    const version = require('../package.json').version;
    const date = new Date().toISOString().slice(0, 10);

    // Commits since the previous tag (the new version's tag isn't created yet
    // when this runs in the bump job). No tags yet → fall back to all history.
    let range = '';
    try {
      const prevTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
      if (prevTag) range = `${prevTag}..HEAD`;
    } catch {
      range = '';
    }

    const cmd = `git log ${range} --no-merges --pretty=%s`.replace(/\s+/g, ' ').trim();
    const log = execSync(cmd, { encoding: 'utf8' });
    const commits = log.split('\n').map((s) => s.trim()).filter(Boolean);

    const section = formatSection(commits, version, date);
    fs.writeFileSync(changelogPath, prependSection(readChangelog(), section));
    process.stderr.write(`Updated CHANGELOG.md for v${version} (${commits.length} commits)\n`);
  }
}
