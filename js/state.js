// ── State management ─────────────────────────────────────────
// Shared mutable state. Only the last analysis summary persists to
// localStorage (key scalpel-v1); the skill content itself never does.

const STORAGE_KEY = 'scalpel-v1';

export const state = {
  analysis: null,     // full result of rules.analyze(), this session only
  lastSummary: null,  // { name, source, at, grades, counts }, persisted
};

/** Load the saved summary from localStorage. */
export function loadSaved(s) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') s.lastSummary = parsed.lastSummary || null;
    }
  } catch { /* ignore corrupted data */ }
}

/** Persist the summary only. */
export function save(s) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lastSummary: s.lastSummary }));
  } catch { /* quota exceeded or private browsing */ }
}
