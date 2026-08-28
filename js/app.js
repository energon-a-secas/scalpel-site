// ── Entry point ──────────────────────────────────────────────
// Wires the modules together; nothing else lives here.

import { state, loadSaved } from './state.js';
import { render, renderRubric } from './render.js';
import { bindEvents } from './events.js';

function init() {
  loadSaved(state);
  renderRubric();
  render(state);
  bindEvents(state);
}

init();
