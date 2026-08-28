// Scalpel analysis-engine tests. Run: node tests/run.mjs
// Exercises the pure modules (parse, rules, report) against three fixtures:
// a synthetic but complete skill (fieldnote; the real ones live in a private repo), the bundled
// broken example, and a minimal paste-only SKILL.md.

import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSkill, buildFromPaste, parseFrontmatter, extractRefs } from '../js/parse.js';
import { analyze } from '../js/rules.js';
import { grades, counts, toMarkdown, verdict } from '../js/report.js';
import { EXAMPLE_GOOD, EXAMPLE_BROKEN } from '../js/examples.js';

const here = fileURLToPath(new URL('.', import.meta.url));

/** Read a fixture directory into the same entry shape a zip produces. */
function readDirEntries(root, prefix) {
  const entries = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else entries.push({
        path: `${prefix}/${relative(root, p)}`,
        text: readFileSync(p, 'utf-8'),
        mode: st.mode & 0o7777,
      });
    }
  };
  walk(root);
  return entries;
}

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`ok   ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}`);
    console.error(`     ${err.message}`);
    process.exitCode = 1;
  }
}

const ids = (a) => a.findings.map((f) => f.id);
const sevOf = (a, id) => a.findings.find((f) => f.id === id)?.severity;

// ── Fixture 1: a complete, well-formed skill (fieldnote) ─────
// Synthetic on purpose: the real fleet skills live in a private repo, and a
// fixture in a public repo must not carry their text.
const vcEntries = readDirEntries(join(here, 'fixtures/fieldnote'), 'fieldnote');
const vc = analyze(buildSkill(vcEntries));

test('fieldnote: name parsed and matches folder', () => {
  assert.equal(vc.name, 'fieldnote');
  assert.equal(vc.folderName, 'fieldnote');
  assert.ok(!ids(vc).includes('name-mismatch'));
});

test('fieldnote: no findings at all', () => {
  assert.deepEqual(vc.findings, [], `unexpected findings: ${JSON.stringify(vc.findings, null, 2)}`);
});

test('fieldnote: every referenced file resolves', () => {
  assert.ok(!ids(vc).includes('missing-ref'), `missing-ref fired: ${JSON.stringify(vc.findings)}`);
  const refs = extractRefs(readFileSync(join(here, 'fixtures/fieldnote/SKILL.md'), 'utf-8'), ['fieldnote']);
  assert.ok(refs.local.has('scripts/collect.sh'));
  assert.ok(refs.local.has('reference/rules.md'));
});

test('fieldnote: script executable bit is seen, no not-executable finding', () => {
  assert.ok(!ids(vc).includes('not-executable'));
  assert.ok(!ids(vc).includes('no-shebang'));
});

test('fieldnote: no em dashes, no filler words', () => {
  assert.ok(!ids(vc).includes('em-dash'));
  assert.ok(!ids(vc).includes('filler-words'));
});

// ── Fixture 2: the bundled broken example ────────────────────
const broken = analyze(buildSkill(EXAMPLE_BROKEN.entries));

test('broken: vague router line is a blocker', () => {
  assert.ok(ids(broken).includes('desc-short'));
  assert.equal(sevOf(broken, 'desc-short'), 'blocker');
});

test('broken: missing referenced script is a blocker', () => {
  assert.equal(sevOf(broken, 'missing-ref'), 'blocker');
  const f = broken.findings.find((x) => x.id === 'missing-ref');
  assert.ok(f.evidence.some((e) => e.includes('scripts/gather.sh')), JSON.stringify(f.evidence));
});

test('broken: em dashes flagged with line evidence', () => {
  const f = broken.findings.find((x) => x.id === 'em-dash');
  assert.ok(f, 'em-dash finding missing');
  assert.ok(f.evidence.length >= 2, JSON.stringify(f.evidence));
  assert.ok(f.evidence[0].startsWith('line '));
});

test('broken: name/folder mismatch, abs path, filler words, en dash', () => {
  assert.equal(sevOf(broken, 'name-mismatch'), 'blocker');
  assert.equal(sevOf(broken, 'abs-paths'), 'blocker');
  assert.ok(ids(broken).includes('filler-words'));
  assert.ok(ids(broken).includes('en-dash-prose'));
});

test('broken: orphan script with mode/shebang/set -e evidence', () => {
  assert.ok(ids(broken).includes('orphan-script'));
  assert.ok(ids(broken).includes('no-shebang'));
  assert.ok(ids(broken).includes('set-e'));
  const f = broken.findings.find((x) => x.id === 'not-executable');
  assert.ok(f, 'not-executable finding missing');
  assert.ok(f.evidence[0].includes('0644'), JSON.stringify(f.evidence));
});

test('broken: body-structure warnings and D grades where earned', () => {
  assert.ok(ids(broken).includes('no-steps'));
  assert.ok(ids(broken).includes('no-invariants'));
  const g = grades(broken);
  assert.equal(g.router, 'D');
  assert.equal(g.body, 'D'); // abs-path blocker lives in the body dimension
  assert.equal(g.files, 'D');
  assert.ok(verdict(broken).startsWith('Not ready'));
});

// ── Fixture 3: minimal paste-only SKILL.md ───────────────────
const paste = analyze(buildFromPaste(`---
name: tiny
description: "Use when a quick check of a paste-only skill is needed. It covers the minimal case."
---

# tiny

One line of body.
`));

test('paste: file checks are skipped, not failed', () => {
  assert.ok(paste.skipped.some((s) => s.title === 'Scripts and references'));
  assert.ok(paste.skipped.some((s) => s.title === 'Name matches folder'));
  assert.ok(!ids(paste).includes('missing-ref'));
  assert.ok(!ids(paste).includes('not-executable'));
});

test('paste: router findings still run', () => {
  assert.ok(ids(paste).includes('desc-short')); // 93 chars: under 120 is a blocker
  assert.equal(sevOf(paste, 'desc-short'), 'blocker');
  assert.equal(grades(paste).files, 'A'); // nothing checkable found nothing
});

test('paste: body structure findings still run', () => {
  assert.ok(ids(paste).includes('no-steps'));
  assert.ok(ids(paste).includes('no-invariants'));
});

// ── The bundled good example must be clean ───────────────────
const good = analyze(buildSkill(EXAMPLE_GOOD.entries));

test('bundled good example: zero findings, straight A grades', () => {
  assert.deepEqual(good.findings, [], JSON.stringify(good.findings, null, 2));
  assert.deepEqual(grades(good), { router: 'A', body: 'A', files: 'A' });
  assert.equal(verdict(good), 'Clean. Nothing to fix before it ships.');
});

// ── Parsing details ──────────────────────────────────────────
test('frontmatter: folded multi-line description joins', () => {
  const fm = parseFrontmatter('---\nname: x\ndescription: "line one\n  line two"\n---\nbody');
  assert.equal(fm.data.description, 'line one line two');
});

test('report: markdown export carries rules and severities', () => {
  const md = toMarkdown(broken);
  assert.ok(md.includes('## Blockers'));
  assert.ok(md.includes('Rule: authoring.md'));
  assert.ok(md.includes('Grades: Router D'));
});

test('counts: broken totals are consistent', () => {
  const c = counts(broken);
  assert.equal(c.blocker + c.warning + c.nit, broken.findings.length);
  assert.ok(c.blocker >= 4);
});

console.log(`\n${passed} tests passed${process.exitCode ? ', with failures above' : ''}`);
