// ── Parsing ──────────────────────────────────────────────────
// Turns raw input (zip entries, bundled example files, or a pasted
// SKILL.md) into one skill model, then pulls the structure out of the
// markdown: frontmatter, headings, code fences, referenced paths.
// Pure module: no DOM, runs unchanged under Node for the tests.

const JUNK = /(^|\/)(__MACOSX\/|\.DS_Store$|\.git\/|\.gitignore$)/;

/** Decode bytes as UTF-8 text; returns null for binary content. */
export function decodeText(bytes) {
  if (!bytes) return null;
  const probe = bytes.subarray(0, Math.min(bytes.length, 8192));
  for (let i = 0; i < probe.length; i++) if (probe[i] === 0) return null;
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Build the skill model from a list of file entries (zip output or a
 * bundled example). Finds the shallowest SKILL.md and treats its
 * directory as the skill root; junk entries (__MACOSX, .DS_Store) are
 * dropped before root detection so a macOS zip does not confuse it.
 *
 * @param {Array<{path:string, bytes?:Uint8Array, text?:string, mode?:number|null}>} entries
 * @returns {{source:string, folderName:string|null, files:Array, text:string}}
 */
export function buildSkill(entries) {
  const clean = entries.filter((e) => !JUNK.test(e.path));
  const cands = clean.filter((e) => e.path === 'SKILL.md' || e.path.endsWith('/SKILL.md'));
  if (cands.length === 0) {
    throw new Error('No SKILL.md in the archive. Zip the skill folder itself, with SKILL.md at its top level.');
  }
  cands.sort((a, b) => a.path.length - b.path.length);
  const rootPath = cands[0].path;
  const prefix = rootPath.slice(0, rootPath.length - 'SKILL.md'.length);
  const folderName = prefix ? (prefix.replace(/\/$/, '').split('/').pop() || null) : null;

  const files = [];
  for (const e of clean) {
    if (!e.path.startsWith(prefix)) continue;
    const rel = e.path.slice(prefix.length);
    if (!rel || rel.endsWith('/')) continue;
    const text = e.text !== undefined ? e.text : decodeText(e.bytes);
    const size = e.text !== undefined
      ? new TextEncoder().encode(e.text).length
      : (e.bytes ? e.bytes.length : 0);
    files.push({ path: rel, size, mode: e.mode ?? null, text });
  }
  const skillFile = files.find((f) => f.path === 'SKILL.md');
  return { source: 'zip', folderName, files, text: skillFile.text || '' };
}

/** Build the model from a pasted SKILL.md alone: no files, no folder. */
export function buildFromPaste(text) {
  return { source: 'paste', folderName: null, files: [], text: String(text || '') };
}

function joinValue(parts) {
  let v = parts.join(' ').trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v;
}

/**
 * Minimal YAML-subset frontmatter parser: `key: value` scalars with
 * folded continuation lines, which covers every skill in the fleet.
 * @returns {{present:boolean, data:Object, bodyStart:number, unterminated?:boolean}}
 */
export function parseFrontmatter(text) {
  const lines = text.split('\n');
  if (!lines.length || lines[0].trim() !== '---') return { present: false, data: {}, bodyStart: 0 };
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') { end = i; break; }
  }
  if (end < 0) return { present: false, data: {}, bodyStart: 0, unterminated: true };

  const data = {};
  let key = null;
  let parts = [];
  const flush = () => { if (key) data[key] = joinValue(parts); };
  for (let i = 1; i < end; i++) {
    const line = lines[i];
    const m = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (m) {
      flush();
      key = m[1];
      parts = [m[2].trim()];
    } else if (key && /^\s+\S/.test(line)) {
      parts.push(line.trim());
    }
  }
  flush();
  return { present: true, data, bodyStart: end + 1 };
}

/**
 * Structural scan of the whole file. Line numbers are 1-based over the
 * full text (frontmatter included) so evidence points at real lines.
 */
export function scanStructure(text, bodyStart) {
  const lines = text.split('\n');
  const inFence = new Array(lines.length).fill(false);
  let fenced = false;
  for (let i = 0; i < lines.length; i++) {
    const isMarker = /^\s*(```|~~~)/.test(lines[i]);
    if (isMarker) { inFence[i] = true; fenced = !fenced; continue; }
    inFence[i] = fenced;
  }

  const headings = [];
  let numberedSteps = false;
  let tableLines = 0;
  for (let i = bodyStart; i < lines.length; i++) {
    if (inFence[i]) continue;
    const h = lines[i].match(/^(#{1,6})\s+(.*)$/);
    if (h) { headings.push({ level: h[1].length, text: h[2].trim(), line: i + 1 }); continue; }
    if (/^\s{0,3}\d+[.)]\s+\S/.test(lines[i])) numberedSteps = true;
    if (/^\s*\|.+\|/.test(lines[i])) tableLines++;
  }
  if (!numberedSteps) numberedSteps = headings.some((h) => /^step\b/i.test(h.text));

  // Prose before the first level-2 heading (skipping the H1 title).
  let intro = false;
  for (let i = bodyStart; i < lines.length; i++) {
    if (inFence[i]) continue;
    const t = lines[i].trim();
    if (!t) continue;
    if (/^#\s/.test(t)) continue;
    if (/^#{2,6}\s/.test(t)) break;
    if (!/^[-*|>]/.test(t)) { intro = true; break; }
  }

  return { lines, inFence, headings, numberedSteps, tableLines, intro };
}

/** Count list items in the section under the first heading matching re. */
export function sectionListItems(struct, re) {
  const { lines, inFence, headings } = struct;
  const head = headings.find((h) => re.test(h.text));
  if (!head) return null;
  const next = headings.find((h) => h.line > head.line && h.level <= head.level);
  const endLine = next ? next.line - 1 : lines.length;
  let count = 0;
  for (let i = head.line; i < endLine; i++) {
    if (inFence[i]) continue;
    if (/^\s*(?:[-*]|\d+[.)])\s+\S/.test(lines[i])) count++;
  }
  return { heading: head, count };
}

const CROSS_RE = /skills\/([\w-]+)\/((?:scripts|reference)\/[\w][\w./-]*)/g;
const LOCAL_RE = /(?:^|[\s"'`([=,:])((?:\.\/)?(?:scripts|reference)\/[\w][\w./-]*\.[A-Za-z0-9]+)/g;

/**
 * Extract referenced paths from SKILL.md. Local refs are paths inside
 * the skill; cross refs point into sibling skills (allowed by the
 * authoring guide, but not verifiable from this archive). A cross ref
 * into the skill's own name resolves to a local path.
 * @returns {{local:Map<string,number[]>, cross:Map<string,{skill:string,lines:number[]}>}}
 */
export function extractRefs(text, selfNames) {
  const self = new Set((selfNames || []).filter(Boolean));
  const local = new Map();
  const cross = new Map();
  const add = (map, k, line, extra) => {
    if (!map.has(k)) map.set(k, extra ? { ...extra, lines: [] } : []);
    const bucket = extra ? map.get(k).lines : map.get(k);
    if (!bucket.includes(line)) bucket.push(line);
  };
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    let m;
    CROSS_RE.lastIndex = 0;
    while ((m = CROSS_RE.exec(lines[i])) !== null) {
      const path = m[2].replace(/[).,:;]+$/, '');
      if (self.has(m[1])) add(local, path, i + 1);
      else add(cross, `skills/${m[1]}/${path}`, i + 1, { skill: m[1] });
    }
    LOCAL_RE.lastIndex = 0;
    while ((m = LOCAL_RE.exec(lines[i])) !== null) {
      const path = m[1].replace(/^\.\//, '').replace(/[).,:;]+$/, '');
      add(local, path, i + 1);
    }
  }
  return { local, cross };
}
