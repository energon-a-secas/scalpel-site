// ── Bundled examples ─────────────────────────────────────────
// Two skills that run through the same pipeline as a dropped zip:
// virtual file entries with unix modes. The broken one carries its
// em and en dashes as unicode escapes so this source file
// stays clean of the characters the analyzer flags.

const GOOD_SKILL = `---
name: shipnote
description: "Use when a change has merged and someone outside the repo has to hear about it: a release note, a changelog entry, or the two lines that go in the announcement channel. Reads the merged diff and the issue thread so the note reports what shipped rather than what was planned. Triggers on: 'write the release note', 'changelog entry for this', 'announce this change'. Not for a full post about the work (use writeup) or a deck (use debrief)."
argument-hint: "[project-dir]"
user-invocable: true
license: MIT
---

# shipnote: the note that matches the diff

Turns a merged change into a release note a reader can trust. The failure mode it
prevents: notes written from memory describe the plan, and the plan is exactly what
the diff quietly abandoned.

## Step 1: Collect the facts

\`\`\`bash
bash scripts/collect.sh <project-dir>
\`\`\`

The script prints the merged diff summary and the issue titles it closed. Never
write the note before reading its output.

## Step 2: Pick the register

| Audience | Lead with | Cut |
|---|---|---|
| Users | what changed for them | file names |
| Engineers | the surface that moved | adjectives |
| Ops | flags, defaults, rollback | everything else |

## Step 3: Draft and check

1. One sentence per shipped change, past tense.
2. Name the flag or setting whenever behaviour changed.
3. Read the finished note against the diff summary once more.

Formats and worked examples live in \`reference/formats.md\`; read it when the
target format is not plain markdown.

## Invariants

- Every claim in the note appears in the diff summary.
- Behaviour changes name their flag or default.
- No adjectives the reader cannot verify from the diff.
- The note ships in the same change as the code when the repo allows it.
`;

const GOOD_SCRIPT = `#!/usr/bin/env bash
# Collect the merged diff summary and the issue titles it closed, so the
# note reports what shipped rather than what was planned.
set -uo pipefail
dir="\${1:-.}"
cd "$dir" || exit 1
echo "== last merge =="
git log --oneline -1
echo "== diff summary =="
git diff --stat HEAD~1..HEAD
echo "== commit body =="
git log -1 --pretty=%B
`;

const GOOD_REFERENCE = `# Note formats

## Changelog entry

One line, past tense, category prefix: \`Fixed:\`, \`Added:\`, \`Changed:\`.

## Announcement channel

Two sentences. First what changed for the reader, then where to look.

## Release page

The changelog lines, grouped by category, with the version and date on top.
`;

export const EXAMPLE_GOOD = {
  label: 'shipnote (well-formed)',
  entries: [
    { path: 'shipnote/SKILL.md', text: GOOD_SKILL, mode: 0o644 },
    { path: 'shipnote/scripts/collect.sh', text: GOOD_SCRIPT, mode: 0o755 },
    { path: 'shipnote/reference/formats.md', text: GOOD_REFERENCE, mode: 0o644 },
  ],
};

const BROKEN_SKILL = `---
name: deckmaker
description: "Creates presentations from your work."
user-invocable: true
---

# deck-maker \u2014 seamless decks in one pass

Run \`scripts/gather.sh\` to collect the facts, then let the tool do the rest
\u2014 it is a robust pipeline that turns any repo into a deck.

Copy the starter template from /Users/alex/templates/deck.yaml before the first
run. The result \u2013 every time \u2013 lands wherever the script decides.

## Output

The deck appears next to the repo when the run finishes.
`;

const BROKEN_ORPHAN = `set -e
echo "gathering"
ls
`;

export const EXAMPLE_BROKEN = {
  label: 'deck-maker (broken)',
  entries: [
    { path: 'deck-maker/SKILL.md', text: BROKEN_SKILL, mode: 0o644 },
    { path: 'deck-maker/scripts/orphan.sh', text: BROKEN_ORPHAN, mode: 0o644 },
  ],
};
