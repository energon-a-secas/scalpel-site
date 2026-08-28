---
name: fieldnote
description: Use when a debugging session ends and the fix deserves a written trail, turning the terminal history and the diff into a dated field note. Triggers on "write up this fix", "leave a note about the bug", "record what we found", "make a field note". It collects the evidence first (the failing command, the output, the change), then writes the note around it, so the claim and the proof travel together. Not for changelogs, commit messages, or documentation of features that never broke; those have their own homes.
---

# fieldnote: the bug gets a paper trail

A fix without a note is a fix the next person re-derives from scratch. This skill turns the session that found a bug into a dated note that leads with the evidence.

## Collect the evidence

1. Run the collector to capture the failing command and its output:

```bash
bash scripts/collect.sh > /tmp/fieldnote-evidence.txt
```

2. Take the diff of the fix itself, not the whole branch.
3. Name the one input that reproduces the failure.

## Write the note

Follow the shape in [reference/rules.md](reference/rules.md): symptom first, then the wrong theory that cost the most time, then the cause, then the fix, each with its evidence inline.

## What to keep, what to cut

Most of a debugging session is noise. A dead end earns a line only when someone else would plausibly walk into it; a detour nobody would repeat is cut. When in doubt, keep the wrong theory and cut the tooling mishaps.

## Invariants

- Evidence before narrative: every claim quotes the command or the diff that backs it.
- Dates are absolute, never "yesterday".
- The note names the reproducing input or says plainly that none was found.
