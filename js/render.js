// ── DOM rendering ────────────────────────────────────────────
// Builds the report and the rubric. Every string that came from the
// analyzed skill goes through escHtml: skill content is untrusted text.

import { $, escHtml, fmtBytes, plural } from './utils.js';
import { RULES } from './rules.js';
import { DIMS, SEV_LABEL, grades, counts, verdict, bySeverity } from './report.js';

const SEV_ORDER = ['blocker', 'warning', 'nit'];

/** Main render: swaps between input-only and input+report views. */
export function render(s) {
  const section = $('reportSection');
  if (!s.analysis) {
    section.hidden = true;
  } else {
    section.hidden = false;
    $('reportBody').innerHTML = reportHtml(s.analysis);
  }
  renderLastSummary(s);
}

function renderLastSummary(s) {
  const el = $('lastSummary');
  if (!el) return;
  const last = s.lastSummary;
  if (!last || s.analysis) { el.hidden = true; return; }
  const g = last.grades || {};
  el.hidden = false;
  el.innerHTML = `Last dissection: <strong>${escHtml(last.name)}</strong>, `
    + `Router ${escHtml(g.router || '?')} / Body ${escHtml(g.body || '?')} / Files ${escHtml(g.files || '?')}`
    + ` (${escHtml((last.at || '').slice(0, 10))}). Stored in this browser only.`;
}

function gradeChip(letter, label) {
  return `<div class="grade-chip grade-${letter.toLowerCase()}" role="img" `
    + `aria-label="${escHtml(label)} grade ${letter}">`
    + `<span class="grade-letter">${letter}</span><span class="grade-label">${escHtml(label)}</span></div>`;
}

function sevBadge(sev) {
  return `<span class="sev-badge sev-${sev}">${SEV_LABEL[sev]}</span>`;
}

function findingHtml(f) {
  const ev = f.evidence.length
    ? `<ul class="finding-evidence">${f.evidence.map((e) => `<li>${escHtml(e)}</li>`).join('')}</ul>`
    : '';
  return `<article class="finding finding--${f.severity}">
    <div class="finding-head">${sevBadge(f.severity)}<h4>${escHtml(f.title)}</h4></div>
    <p class="finding-detail">${escHtml(f.detail)}</p>${ev}
    <p class="finding-rule">Rule: ${escHtml(RULES[f.id].source)}</p>
  </article>`;
}

function reportHtml(a) {
  const g = grades(a);
  const c = counts(a);
  const groups = bySeverity(a);
  const name = a.name || a.folderName || 'unnamed skill';
  const srcChip = a.source === 'paste'
    ? 'pasted SKILL.md'
    : `zip${a.folderName ? ` · ${a.folderName}/` : ''}`;
  const vClass = c.blocker ? 'blocker' : c.warning ? 'warning' : c.nit ? 'nit' : 'clean';

  let html = `<div class="card report-head">
    <div class="report-title-row">
      <h3 class="report-name">${escHtml(name)}</h3>
      <span class="source-chip">${escHtml(srcChip)}</span>
    </div>
    <p class="verdict verdict--${vClass}">${escHtml(verdict(a))}</p>
    <div class="grade-row">${DIMS.map((d) => gradeChip(g[d.id], d.label)).join('')}</div>
    <p class="count-line">${plural(c.blocker, 'blocker')} · ${plural(c.warning, 'warning')} · ${plural(c.nit, 'nit')}
      &nbsp;·&nbsp; ${plural(a.stats.lines, 'line')} of SKILL.md · ${plural(a.stats.descChars, 'description character')}${a.source === 'zip' ? ` · ${plural(a.stats.files, 'file')}` : ''}</p>
    <div class="toolbar">
      <button type="button" class="btn btn--secondary btn--sm" id="copyReportBtn">Copy report</button>
      <button type="button" class="btn btn--secondary btn--sm" id="downloadReportBtn">Download .md</button>
      <button type="button" class="btn btn--ghost btn--sm" id="newAnalysisBtn">New dissection</button>
    </div>
  </div>`;

  for (const sev of SEV_ORDER) {
    if (!groups[sev].length) continue;
    html += `<div class="sev-group">
      <h3 class="sev-group-title">${SEV_LABEL[sev]}s (${groups[sev].length})</h3>
      ${groups[sev].map(findingHtml).join('')}
    </div>`;
  }
  if (!a.findings.length) {
    html += '<div class="card finding--clean"><p>No findings. Every check that could run came back clean.</p></div>';
  }

  if (a.notes.length) {
    html += `<div class="report-aside"><h3>Notes</h3><ul>${a.notes.map((n) => `<li>${escHtml(n)}</li>`).join('')}</ul></div>`;
  }
  if (a.skipped.length) {
    html += `<div class="report-aside"><h3>Skipped checks</h3><ul>${a.skipped.map((sk) => `<li><strong>${escHtml(sk.title)}:</strong> ${escHtml(sk.why)}</li>`).join('')}</ul></div>`;
  }
  if (a.source === 'zip' && a.stats.files) {
    html += inventoryHtml(a);
  }
  return html;
}

function inventoryHtml(a) {
  const rows = a.files.map((f) => {
    const mode = f.mode === null ? 'no mode bits' : (f.mode & 0o7777).toString(8).padStart(4, '0');
    const exec = f.mode !== null && (f.mode & 0o111) ? ' <span class="exec-mark" title="executable">+x</span>' : '';
    return `<tr><td class="inv-path">${escHtml(f.path)}${exec}</td><td>${escHtml(fmtBytes(f.size))}</td><td class="inv-mode">${escHtml(mode)}</td></tr>`;
  }).join('');
  return `<details class="report-aside inventory">
    <summary>What the archive carries (${a.files.length} files)</summary>
    <div class="inv-scroll"><table class="inv-table">
      <thead><tr><th>Path</th><th>Size</th><th>Mode</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </details>`;
}

/** Static rubric list, generated from RULES so the page cannot drift from the code. */
export function renderRubric() {
  const el = $('rubricList');
  if (!el) return;
  let html = '';
  for (const d of DIMS) {
    const rules = Object.entries(RULES).filter(([, r]) => r.dim === d.id);
    html += `<div class="rubric-dim">
      <h3>${escHtml(d.label)}</h3>
      <ul class="rubric-rules">${rules.map(([id, r]) => `
        <li id="rule-${escHtml(id)}">
          <div class="rubric-rule-head">${sevBadge(r.sev)}<strong>${escHtml(r.title)}</strong></div>
          <p>${escHtml(r.desc)}</p>
          <p class="finding-rule">Source: ${escHtml(r.source)}</p>
        </li>`).join('')}</ul>
    </div>`;
  }
  el.innerHTML = html;
}
