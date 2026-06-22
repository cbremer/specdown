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
 * (`feat:`, `fix:`, `docs(scope):`, `feat!:` …). This repo writes *descriptive*
 * subjects ("Fix diagram controls…", "Add desktop auto-update"), so when a
 * subject isn't a conventional commit its leading verb is mapped to a type via
 * `inferType` — so the grouped changelog lights up without anyone having to
 * adopt the `type:` prefix. Subjects whose verb is ambiguous fall to "Other
 * Changes"; only when nothing can be categorized at all does the section fall
 * back to a flat bullet list.
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

// High-confidence leading-verb → type mappings for descriptive subjects. Kept
// conservative on purpose: an ambiguous verb (e.g. "Update", "Remove", "Tweak")
// is left uncategorized so it lands in "Other Changes" rather than being
// mislabeled. Each pattern is anchored to the start of the subject.
const INFERENCE_RULES = [
  [/^(add|adds|added|introduce[sd]?|implement[sed]*|support[sed]*|enable[sd]?|new)\b/i, 'feat'],
  [/^(fix|fixe[sd]|resolve[sd]?|correct[sed]*|prevent[sed]*|stop[sed]*|repair[sed]*|patch(e[sd])?)\b/i, 'fix'],
  [/^(refactor(e[sd])?|simplif(y|ies|ied)|rename[sd]?|reorganize[sd]?|extract[sed]*|consolidate[sd]?)\b/i, 'refactor'],
  [/^(doc|docs|document[sed]*)\b/i, 'docs'],
  [/^(test|tests|spec)\b/i, 'test'],
  [/^(optimi[sz]e[sd]?|perf)\b/i, 'perf'],
  [/^(bump|upgrade[sd]?|pin(ned|s)?)\b/i, 'build'],
  [/^(ci|workflow|pipeline)\b/i, 'ci'],
  [/^(style|format[sed]*|lint|prettier)\b/i, 'style'],
];

/**
 * Infer a Conventional-Commit type from a descriptive subject's leading verb.
 * @param {string} subject
 * @returns {string} a CC type key, or '' when none matches confidently.
 */
function inferType(subject) {
  const s = String(subject || '').trim();
  for (const [re, type] of INFERENCE_RULES) {
    if (re.test(s)) return type;
  }
  return '';
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

  // Each entry's type is its explicit Conventional-Commit type when present,
  // otherwise an inferred type from the descriptive subject's leading verb.
  const entries = clean.map((subject) => {
    const cc = parseCommitSubject(subject);
    const type = cc && CC_TYPE_LABELS[cc.type] ? cc.type : inferType(subject);
    return { subject, cc, type };
  });
  const anyCategorized = entries.some((e) => CC_TYPE_LABELS[e.type]);

  // Nothing could be categorized (explicit or inferred): a flat list reads best.
  if (!anyCategorized) {
    for (const e of entries) lines.push(renderEntry(e));
    lines.push('');
    return lines.join('\n');
  }

  // Group by type, breaking changes (explicit `!`) first.
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
    if (CC_TYPE_LABELS[e.type]) {
      (groups[e.type] = groups[e.type] || []).push(e);
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
  inferType,
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
