// ── Event handlers ───────────────────────────────────────────
// All listeners live here; the HTML carries no inline onclick.

import { $, showToast, copyText, downloadText } from './utils.js';
import { readZip } from './zip.js';
import { buildSkill, buildFromPaste } from './parse.js';
import { analyze } from './rules.js';
import { toMarkdown, summarize } from './report.js';
import { EXAMPLE_GOOD, EXAMPLE_BROKEN } from './examples.js';
import { save } from './state.js';
import { render } from './render.js';

let appState = null;

function commit(analysis) {
  appState.analysis = analysis;
  appState.lastSummary = summarize(analysis);
  save(appState);
  render(appState);
  $('reportSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function dissect(model) {
  try {
    commit(analyze(model));
  } catch (err) {
    showToast(err.message || 'That could not be analyzed');
  }
}

async function handleZipFile(file) {
  if (!file) return;
  if (!/\.zip$/i.test(file.name)) {
    showToast('Drop a .zip of the skill folder');
    return;
  }
  try {
    const buffer = await file.arrayBuffer();
    const entries = await readZip(buffer);
    dissect(buildSkill(entries));
  } catch (err) {
    showToast(err.message || 'That zip could not be read');
  }
}

function handlePaste() {
  const text = $('pasteBox').value.trim();
  if (!text) {
    showToast('Paste a SKILL.md first, frontmatter included');
    return;
  }
  dissect(buildFromPaste(text));
}

function loadExample(example) {
  dissect(buildSkill(example.entries));
}

function resetView() {
  appState.analysis = null;
  $('pasteBox').value = '';
  $('zipInput').value = '';
  render(appState);
  $('inputSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Report action buttons are re-rendered per analysis, so delegate. */
function onDocumentClick(e) {
  const t = e.target.closest('button, a');
  if (!t || !appState) return;
  if (t.id === 'copyReportBtn' && appState.analysis) {
    copyText(toMarkdown(appState.analysis)).then((ok) => showToast(ok ? 'Report copied as markdown' : 'Copy failed'));
  } else if (t.id === 'downloadReportBtn' && appState.analysis) {
    const name = appState.analysis.name || appState.analysis.folderName || 'skill';
    downloadText(`scalpel-report-${name}.md`, toMarkdown(appState.analysis));
  } else if (t.id === 'newAnalysisBtn') {
    resetView();
  }
}

function bindDropZone() {
  const zone = $('dropZone');
  const input = $('zipInput');
  zone.addEventListener('click', () => input.click());
  zone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });
  input.addEventListener('change', () => handleZipFile(input.files[0]));
  ['dragenter', 'dragover'].forEach((ev) => zone.addEventListener(ev, (e) => {
    e.preventDefault();
    zone.classList.add('drop-zone--over');
  }));
  ['dragleave', 'drop'].forEach((ev) => zone.addEventListener(ev, (e) => {
    e.preventDefault();
    zone.classList.remove('drop-zone--over');
  }));
  zone.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files?.[0];
    handleZipFile(file);
  });
  // A file dropped outside the zone should not navigate the page away.
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => e.preventDefault());
}

/** Bind all event listeners. Call once from app.js after render. */
export function bindEvents(s) {
  appState = s;
  bindDropZone();
  $('dissectBtn').addEventListener('click', handlePaste);
  $('pasteBox').addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handlePaste();
  });
  $('exampleGoodBtn').addEventListener('click', () => loadExample(EXAMPLE_GOOD));
  $('exampleBrokenBtn').addEventListener('click', () => loadExample(EXAMPLE_BROKEN));
  $('exampleBtn')?.addEventListener('click', () => loadExample(EXAMPLE_GOOD));
  document.addEventListener('click', onDocumentClick);
}
