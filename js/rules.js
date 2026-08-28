// ── Rules ────────────────────────────────────────────────────
// Every check Scalpel performs, each traced to a named rule in the
// fleet's skill-authoring guide (neorgon-forge/docs/authoring.md),
// the forge CLAUDE.md, or a fleet skill that carries the rule.
// A caveat with no source behind it is an opinion, so none ship here.
// Pure module: no DOM, runs unchanged under Node for the tests.

import { parseFrontmatter, scanStructure, sectionListItems, extractRefs } from './parse.js';

export const SEVERITIES = ['blocker', 'warning', 'nit'];

/** Rule registry. `sev` is the default severity; a check may escalate. */
export const RULES = {
  'no-frontmatter': { dim: 'router', sev: 'blocker', title: 'No frontmatter block',
    desc: 'SKILL.md must open with a --- delimited YAML block carrying name and description.',
    source: 'authoring.md, Frontmatter' },
  'no-description': { dim: 'router', sev: 'blocker', title: 'No description',
    desc: 'The description is the only thing loaded until the skill fires; without one the skill is unreachable.',
    source: 'authoring.md, The description is the router' },
  'no-name': { dim: 'router', sev: 'warning', title: 'No name field',
    desc: 'Frontmatter must carry a name, and it must match the directory.',
    source: 'authoring.md, Frontmatter' },
  'name-mismatch': { dim: 'router', sev: 'blocker', title: 'Name does not match the folder',
    desc: 'The most common mechanical error; validate.sh fails on it.',
    source: 'authoring.md, Frontmatter' },
  'desc-short': { dim: 'router', sev: 'warning', title: 'Description below routing length',
    desc: 'Aim for 300 to 900 characters. Under ~120 there is nothing to route on (blocker); under 300 the routing is thin (warning).',
    source: 'authoring.md, The description is the router' },
  'desc-long': { dim: 'router', sev: 'nit', title: 'Description above the aim',
    desc: 'Over 900 characters is past the aim (nit); over ~1400 the signal dilutes (warning).',
    source: 'authoring.md, The description is the router' },
  'no-when': { dim: 'router', sev: 'warning', title: 'Does not say when to use it',
    desc: 'Part 1 of the four-part description: the situation, in the words a user would type.',
    source: 'authoring.md, The description is the router' },
  'no-triggers': { dim: 'router', sev: 'warning', title: 'No trigger phrases',
    desc: 'Part 3: literal quoted phrases. A description without them loses to any skill that lists what people actually type.',
    source: 'authoring.md, The description is the router' },
  'no-boundary': { dim: 'router', sev: 'warning', title: 'No boundary clause',
    desc: 'Part 4: "Not for X (use Y)". The boundary is what stops neighbouring skills fighting over the same request.',
    source: 'authoring.md, The description is the router' },
  'triggers-on-user-invoked': { dim: 'router', sev: 'nit', title: 'Trigger phrases on a user-invoked skill',
    desc: 'A skill with disable-model-invocation wants a human-facing description of one or two sentences; trigger phrases route nothing.',
    source: 'forge CLAUDE.md, Invocation' },

  'no-headings': { dim: 'body', sev: 'warning', title: 'No section headings',
    desc: 'The body needs structure: procedure, judgment, invariants.',
    source: 'authoring.md, Body structure' },
  'no-opening': { dim: 'body', sev: 'warning', title: 'No opening statement',
    desc: 'Open with two sentences: what it does, and the failure mode it prevents. The second is why the skill exists.',
    source: 'authoring.md, Body structure' },
  'no-steps': { dim: 'body', sev: 'warning', title: 'No numbered procedure',
    desc: 'Numbered steps, concrete enough to follow without interpretation.',
    source: 'authoring.md, Body structure' },
  'no-judgment': { dim: 'body', sev: 'nit', title: 'No judgment section',
    desc: 'At least one section that is not steps: a trade-off table, a keep-versus-cut list. Detection is heuristic, so this stays a nit.',
    source: 'authoring.md, Body structure' },
  'no-invariants': { dim: 'body', sev: 'warning', title: 'No Invariants section',
    desc: 'Three to five non-negotiables as imperatives; the things you would call out in review.',
    source: 'authoring.md, Body structure' },
  'invariants-bloat': { dim: 'body', sev: 'nit', title: 'Invariants list too long',
    desc: 'Three to five is the rule; a list of twelve is a list nobody reads. Ten or more escalates to a warning.',
    source: 'authoring.md, Body structure' },
  'too-long': { dim: 'body', sev: 'warning', title: 'SKILL.md too long',
    desc: 'Keep it under ~500 lines and move detail into reference/. Past ~1200 lines the body spends the context the tiers exist to save (blocker).',
    source: 'authoring.md, Body structure + Progressive disclosure' },
  'em-dash': { dim: 'body', sev: 'warning', title: 'Em dashes',
    desc: 'The fleet bans them in skills, docs and comments; the loudest AI tell in shipped prose.',
    source: 'forge CLAUDE.md, Prose; voicecheck reference/voice-defaults.md' },
  'en-dash-prose': { dim: 'body', sev: 'nit', title: 'En dash used as prose punctuation',
    desc: 'A spaced en dash is prose punctuation and reads as the same tell; a numeric range like 300-900 is glyph use and is fine.',
    source: 'voicecheck reference/voice-defaults.md, Blocker rules' },
  'filler-words': { dim: 'body', sev: 'warning', title: 'Banned filler words',
    desc: 'powerful, seamless, leverage, robust, utilize, unlock, effortless and friends. Salesy filler, banned fleet-wide.',
    source: 'voicecheck reference/voice-defaults.md, Blocker rules' },
  'abs-paths': { dim: 'body', sev: 'blocker', title: 'User-specific absolute paths',
    desc: 'validate.sh greps every skill for /Users/... paths; skills are public and run against many machines. Anchor on the cwd.',
    source: 'authoring.md, Scripts' },
  'api-keys': { dim: 'body', sev: 'blocker', title: 'Credential-shaped strings',
    desc: 'validate.sh greps for API keys because a public repo cannot un-leak one by deleting it later.',
    source: 'authoring.md, Scripts' },

  'missing-ref': { dim: 'files', sev: 'blocker', title: 'Referenced file missing',
    desc: 'SKILL.md points at a file the skill does not carry; validate.sh flags dead references.',
    source: 'authoring.md, Progressive disclosure' },
  'orphan-reference': { dim: 'files', sev: 'warning', title: 'Reference file never referenced',
    desc: 'An unreferenced reference file never gets read; point at it from SKILL.md or delete it.',
    source: 'authoring.md, Progressive disclosure' },
  'orphan-script': { dim: 'files', sev: 'warning', title: 'Script never called',
    desc: 'A script SKILL.md never mentions never runs. Python modules imported by a sibling script are the sanctioned exception.',
    source: 'authoring.md, Scripts' },
  'no-shebang': { dim: 'files', sev: 'warning', title: 'Script without a shebang',
    desc: 'House convention is #!/usr/bin/env bash on the first line.',
    source: 'authoring.md, Scripts' },
  'set-e': { dim: 'files', sev: 'nit', title: 'set -e in a diagnostic script',
    desc: 'The convention is set -uo pipefail, not -e: collectors should report every problem, not exit on the first.',
    source: 'authoring.md, Scripts' },
  'no-set-flags': { dim: 'files', sev: 'nit', title: 'Bash script without set flags',
    desc: 'Missing set -uo pipefail; unset variables then expand to empty strings silently.',
    source: 'authoring.md, Scripts' },
  'not-executable': { dim: 'files', sev: 'warning', title: 'Script not executable',
    desc: 'chmod +x is checked by validate.sh; the zip’s unix mode bits are the evidence here. Python modules imported by a sibling are exempt.',
    source: 'authoring.md, Scripts' },
  'huge-reference': { dim: 'files', sev: 'warning', title: 'Reference file is huge',
    desc: 'reference/ is the occasionally-loaded tier; a file this size costs a large slice of context every time it is read. Putting a file in the wrong tier is the main way a skill gets expensive.',
    source: 'authoring.md, Progressive disclosure' },
};

const FILLER_RE = /\b(powerful|seamless(?:ly)?|leverag(?:e|es|ing)|robust|utili[sz]e[sd]?|unlock|unleash|supercharge|revolutioni[sz]e|game-changing|cutting-edge|effortless(?:ly)?|delve|tapestry|testament)\b/gi;
const KEY_RES = [
  /\bsk-ant-[A-Za-z0-9-]{12,}/, /\bsk-[A-Za-z0-9]{24,}/, /\bAKIA[0-9A-Z]{16}\b/,
  /\bghp_[A-Za-z0-9]{20,}/, /\bxox[baprs]-[A-Za-z0-9-]{10,}/,
];
const ABS_RE = /(?:^|[^\w])(\/Users\/[\w.-]+|\/home\/[\w.-]+|[A-Z]:\\Users\\[\w.-]+)/;
const WHEN_RE = /\buse\s+(when|before|after|at|during|for|whenever|this|it)\b|\bwhen\s+(the user|asked|you|a )/i;

function excerpt(line, n) {
  const t = line.trim();
  return `line ${n}: ${t.length > 90 ? `${t.slice(0, 90)}…` : t}`;
}

function isTrue(v) { return v === true || v === 'true'; }

/** @returns {{findings:Array, notes:string[], skipped:Array, stats:Object, name:string|null}} */
export function analyze(skill) {
  const findings = [];
  const notes = [];
  const skipped = [];
  const add = (id, detail, evidence, sev) =>
    findings.push({ id, dim: RULES[id].dim, severity: sev || RULES[id].sev, title: RULES[id].title, detail, evidence: evidence || [] });
  const skip = (title, why) => skipped.push({ title, why });

  const text = skill.text || '';
  const fm = parseFrontmatter(text);
  const name = fm.data.name || null;
  const desc = fm.data.description || '';
  const userInvoked = isTrue(fm.data['disable-model-invocation']);
  const struct = scanStructure(text, fm.bodyStart);
  const totalLines = struct.lines.length;

  // ── Router ──
  if (!fm.present) {
    add('no-frontmatter', fm.unterminated
      ? 'The opening --- is never closed, so no frontmatter parses.'
      : 'The file does not open with a --- delimited frontmatter block.');
  } else {
    if (!name) add('no-name', 'Add name: matching the directory exactly.');
    if (!desc) {
      add('no-description', 'A skill without a description is indistinguishable from a skill that does not exist.');
    } else if (userInvoked) {
      notes.push('Router checks relaxed: disable-model-invocation is set, so this description is human-facing, not a router (forge CLAUDE.md, Invocation).');
      if (/triggers\s+on/i.test(desc)) add('triggers-on-user-invoked', 'The description lists trigger phrases, but the model never routes to this skill.');
      if (desc.length > 1400) add('desc-long', `${desc.length} characters for a human-facing line; one or two sentences is the shape.`, [], 'warning');
    } else {
      if (desc.length < 120) {
        add('desc-short', `${desc.length} characters. Under ~120 there is nothing to route on.`, [], 'blocker');
      } else if (desc.length < 300) {
        add('desc-short', `${desc.length} characters, below the 300 to 900 aim; the routing is thin.`);
      }
      if (desc.length > 1400) add('desc-long', `${desc.length} characters; over ~1400 the signal dilutes.`, [], 'warning');
      else if (desc.length > 900) add('desc-long', `${desc.length} characters, above the 300 to 900 aim. Still routes, worth a trim.`);
      if (desc.length >= 120) {
        if (!WHEN_RE.test(desc)) add('no-when', 'Say the situation first: "Use when ...", in the words a user would type.');
        const quoted = (desc.match(/'[^']{3,80}'/g) || []).length;
        if (!/triggers\s+on/i.test(desc) && quoted < 2) add('no-triggers', 'Add literal phrases: Triggers on: \'...\', \'...\'.');
        if (!/\bnot\s+for\b/i.test(desc)) add('no-boundary', 'Name the neighbours: "Not for X (use Y)".');
      }
    }
    if (name && skill.folderName && name !== skill.folderName) {
      add('name-mismatch', `Frontmatter says "${name}" but the folder is "${skill.folderName}".`);
    }
    if (name && !skill.folderName) skip('Name matches folder', skill.source === 'paste' ? 'Pasted SKILL.md carries no folder to compare against.' : 'SKILL.md sits at the zip root, so there is no folder name.');
  }

  // ── Body ──
  if (fm.present) {
    if (struct.headings.filter((h) => h.level >= 2).length === 0) add('no-headings', 'The body has no ## sections at all.');
    if (!struct.intro) add('no-opening', 'No prose before the first section: open with what it does and the failure mode it prevents.');
    if (!struct.numberedSteps) add('no-steps', 'No numbered list or Step headings found in the body.');
    if (!(struct.tableLines >= 2 || struct.headings.some((h) => /\b(vs|versus|trade-?offs?|when to|keep|cut|or\b)/i.test(h.text)))) {
      add('no-judgment', 'No table or trade-off section detected; steps alone are what a plain prompt already does.');
    }
    const inv = sectionListItems(struct, /invariant/i);
    if (!inv) add('no-invariants', 'No ## Invariants section.');
    else if (inv.count >= 10) add('invariants-bloat', `${inv.count} items. A list of twelve is a list nobody reads.`, [], 'warning');
    else if (inv.count > 5) add('invariants-bloat', `${inv.count} items, above the three-to-five rule.`);
  }
  if (totalLines > 1200) add('too-long', `${totalLines} lines. At this size the skill spends the context the tiers exist to save.`, [], 'blocker');
  else if (totalLines > 500) add('too-long', `${totalLines} lines; the guide keeps SKILL.md under ~500 and moves detail into reference/.`);

  const emLines = [];
  const enLines = [];
  const fillerLines = [];
  for (let i = 0; i < struct.lines.length; i++) {
    const line = struct.lines[i];
    if (line.includes('\u2014')) emLines.push(excerpt(line, i + 1));
    if (!struct.inFence[i] && / \u2013 /.test(line)) enLines.push(excerpt(line, i + 1));
    if (!struct.inFence[i]) {
      FILLER_RE.lastIndex = 0;
      const m = line.match(FILLER_RE);
      if (m) fillerLines.push(`line ${i + 1}: ${[...new Set(m.map((w) => w.toLowerCase()))].join(', ')}`);
    }
  }
  if (emLines.length) add('em-dash', `${emLines.length} em dash${emLines.length === 1 ? '' : 'es'} in SKILL.md.`, emLines.slice(0, 8));
  if (enLines.length) add('en-dash-prose', 'Spaced en dashes read as the same tell; ranges like 300-900 are fine.', enLines.slice(0, 5));
  if (fillerLines.length) add('filler-words', 'Salesy filler, banned fleet-wide.', fillerLines.slice(0, 8));

  const textFiles = [{ path: 'SKILL.md', text }, ...skill.files.filter((f) => f.path !== 'SKILL.md' && f.text)];
  const absEv = [];
  const keyEv = [];
  for (const f of textFiles) {
    const flines = f.text.split('\n');
    for (let i = 0; i < flines.length; i++) {
      const am = flines[i].match(ABS_RE);
      if (am) absEv.push(`${f.path}, ${excerpt(flines[i], i + 1)}`);
      if (KEY_RES.some((re) => re.test(flines[i]))) keyEv.push(`${f.path}, line ${i + 1}`);
    }
  }
  if (absEv.length) add('abs-paths', 'These paths exist on one machine only, and a public repo cannot retract them.', absEv.slice(0, 6));
  if (keyEv.length) add('api-keys', 'Rotate the credential; deleting the line in a later commit does not un-leak it.', keyEv.slice(0, 6));

  // ── Files ──
  analyzeFiles(skill, name, add, skip, notes);

  return {
    name, folderName: skill.folderName, source: skill.source, findings, notes, skipped,
    files: skill.files.map((f) => ({ path: f.path, size: f.size, mode: f.mode })),
    stats: { lines: totalLines, descChars: desc.length, files: skill.files.length,
      scripts: skill.files.filter((f) => f.path.startsWith('scripts/')).length,
      refs: skill.files.filter((f) => f.path.startsWith('reference/')).length },
  };
}

function analyzeFiles(skill, name, add, skip, notes) {
  if (skill.source === 'paste') {
    skip('Scripts and references', 'A pasted SKILL.md carries no files: referenced-file, orphan, shebang, size and executable-bit checks all need the zip.');
    return;
  }
  const refs = extractRefs(skill.text, [name, skill.folderName]);
  const paths = new Set(skill.files.map((f) => f.path));
  const scripts = skill.files.filter((f) => f.path.startsWith('scripts/'));
  const refFiles = skill.files.filter((f) => f.path.startsWith('reference/'));

  const missing = [...refs.local.keys()].filter((p) => !paths.has(p));
  if (missing.length) {
    add('missing-ref', 'SKILL.md references these, but the archive does not carry them.',
      missing.map((p) => `${p} (mentioned on line ${refs.local.get(p).join(', ')})`));
  }
  if (refs.cross.size) {
    notes.push(`Cross-skill references (allowed, resolved at install, not verifiable from this archive): ${[...refs.cross.keys()].join(', ')}.`);
  }

  const isMentioned = (p) => refs.local.has(p) || skill.text.includes(p) || skill.text.includes(p.split('/').pop());
  const isPyModule = (f) => f.path.endsWith('.py') && f.text && !f.text.startsWith('#!')
    && scripts.some((s) => s !== f && s.text && new RegExp(`\\bimport\\s+${f.path.split('/').pop().replace(/\.py$/, '')}\\b`).test(s.text));

  const orphanRefs = refFiles.filter((f) => !isMentioned(f.path));
  if (orphanRefs.length) add('orphan-reference', 'Nothing in SKILL.md points at these, so they never get read.', orphanRefs.map((f) => f.path));

  const orphanScripts = scripts.filter((f) => !isMentioned(f.path) && !isPyModule(f));
  if (orphanScripts.length) add('orphan-script', 'SKILL.md never calls these.', orphanScripts.map((f) => f.path));

  const noShebang = scripts.filter((f) => f.text !== null && !f.text.startsWith('#!') && !isPyModule(f));
  if (noShebang.length) add('no-shebang', 'First line should be #!/usr/bin/env bash (or the interpreter the script needs).', noShebang.map((f) => f.path));

  for (const f of scripts) {
    if (!f.text || !/\.(sh|bash)$/.test(f.path)) continue;
    if (/^\s*set\s+-[a-z]*e/m.test(f.text)) add('set-e', `${f.path} exits on the first failure; a collector should report them all.`, [f.path]);
    else if (!/^\s*set\s+-/m.test(f.text)) add('no-set-flags', `${f.path} sets no shell flags.`, [f.path]);
  }

  const withMode = scripts.filter((f) => f.mode !== null);
  if (scripts.length && !withMode.length) {
    skip('Executable bits', 'The zip carries no unix mode bits (not made on a unix host), so there is no evidence either way.');
  } else {
    const notExec = withMode.filter((f) => (f.mode & 0o111) === 0 && !isPyModule(f));
    if (notExec.length) {
      add('not-executable', 'The zip’s central directory records no execute bit; chmod +x before shipping.',
        notExec.map((f) => `${f.path} (mode ${(f.mode & 0o7777).toString(8).padStart(4, '0')})`));
    }
  }

  for (const f of refFiles) {
    if (f.size > 40 * 1024) {
      add('huge-reference', `${f.path} weighs in at roughly ${Math.round(f.size / 1024)} KB (~${Math.round(f.size / 4 / 1000)}k tokens) every time it is read.`, [f.path]);
    }
  }
}
