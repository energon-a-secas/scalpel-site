<div align="center">

# Scalpel

Dissect a Claude skill from a zip or pasted SKILL.md: router quality, body structure, scripts and references, and the caveats to fix before it ships

[![Live][badge-site]][url-site]
[![HTML5][badge-html]][url-html]
[![CSS3][badge-css]][url-css]
[![JavaScript][badge-js]][url-js]
[![Claude Code][badge-claude]][url-claude]
[![License][badge-license]](LICENSE)

[badge-site]:    https://img.shields.io/badge/live_site-0063e5?style=for-the-badge&logo=googlechrome&logoColor=white
[badge-html]:    https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white
[badge-css]:     https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white
[badge-js]:      https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black
[badge-claude]:  https://img.shields.io/badge/Claude_Code-CC785C?style=for-the-badge&logo=anthropic&logoColor=white
[badge-license]: https://img.shields.io/badge/license-MIT-404040?style=for-the-badge

[url-site]:   https://scalpel.neorgon.com/
[url-html]:   #
[url-css]:    #
[url-js]:     #
[url-claude]: https://claude.ai/code

</div>

---

## Overview

Scalpel reads a Claude skill the way a reviewer should: drop a zip of the skill
folder (or paste the SKILL.md alone) and get a caveat report grouped by severity,
where every finding cites the authoring rule it comes from. It grades three
dimensions: the router (the frontmatter description that decides whether the
skill ever fires), the body (structure, length, prose tells), and the files
(dead references, orphan scripts, shebangs, executable bits read straight from
the zip's unix mode bits). Everything runs in the browser; no skill leaves the
page.

**Live:** scalpel.neorgon.com

---

## Features

- **Three inputs** -- drop or pick a .zip of the skill folder, paste a SKILL.md, or open a bundled example (one clean, one deliberately broken)
- **Router checks** -- description length against the 300 to 900 aim, when-to-use wording, trigger phrases, boundary clause, name/folder match
- **Body checks** -- opening statement, numbered steps, judgment section, Invariants list, overall length, em dashes and filler words, baked-in absolute paths, credential-shaped strings
- **File checks** -- referenced files that are missing, reference and script files nothing points at, shebangs, set flags, executable bits with mode evidence, oversized reference files
- **Cited findings** -- every caveat names its source in the fleet's skill-authoring guide; the on-page rubric renders from the same rule table the analyzer runs
- **Report export** -- copy or download the whole report as markdown

---

## Running locally

ES modules require an HTTP server (not `file://`):

```bash
make serve
```

Or manually:

```bash
python3 -m http.server 8870
```

Tests (pure analysis modules, no browser needed):

```bash
node tests/run.mjs
```

---

## Architecture

```
scalpel-site/
├── index.html          # HTML shell
├── css/
│   └── style.css       # All styles
├── js/
│   ├── app.js          # Entry point, imports and initializes
│   ├── state.js        # Shared state; only the last summary persists (scalpel-v1)
│   ├── zip.js          # In-browser zip reader (DecompressionStream, keeps unix mode bits)
│   ├── parse.js        # Frontmatter, markdown structure, referenced-path extraction
│   ├── rules.js        # The rule table and every check, each citing its source
│   ├── report.js       # Grades, verdicts, markdown export
│   ├── examples.js     # Bundled well-formed and broken example skills
│   ├── render.js       # DOM rendering (escape-first; skill content is untrusted)
│   ├── events.js       # Event handlers
│   └── utils.js        # Shared helpers
├── tests/
│   ├── run.mjs         # Node test runner for the pure modules
│   └── fixtures/       # A real fleet skill as the well-formed fixture
├── favicon.ico
├── energon-classic-logo.png
├── robots.txt
├── sitemap.xml
├── CNAME
├── Makefile
└── README.md
```

---

<div align="center">
<sub>Part of <a href="https://neorgon.com/">Neorgon</a></sub>
</div>
