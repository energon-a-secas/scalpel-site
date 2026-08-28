// ── Zip reader ───────────────────────────────────────────────
// Reads a zip archive entirely in the browser. Walks the central directory,
// then inflates each entry through DecompressionStream('deflate-raw'), so
// there is no vendored inflate and no build step. Stored (method 0) and
// deflate (method 8) cover every zip a desktop or `zip -r` produces.
//
// Unix mode bits travel in the central directory's external attributes when
// the archive was made on a unix-like host; they are what lets the scripts
// rules say "not executable" with evidence instead of a guess.

const SIG_EOCD = 0x06054b50;
const SIG_CDIR = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

/**
 * @param {ArrayBuffer} buffer
 * @returns {Promise<Array<{path:string, bytes:Uint8Array, mode:number|null}>>}
 */
export async function readZip(buffer) {
  const dv = new DataView(buffer);
  const u8 = new Uint8Array(buffer);
  if (u8.length < 22) throw new Error('That file is too small to be a zip archive');

  let eocd = -1;
  const floor = Math.max(0, u8.length - 22 - 65535);
  for (let i = u8.length - 22; i >= floor; i--) {
    if (dv.getUint32(i, true) === SIG_EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a zip archive (no end-of-central-directory record found)');

  const count = dv.getUint16(eocd + 10, true);
  const cdOffset = dv.getUint32(eocd + 16, true);
  if (count === 0xffff || cdOffset === 0xffffffff) {
    throw new Error('ZIP64 archives are not supported. Re-zip the folder without zip64, or open the folder directly');
  }

  const td = new TextDecoder('utf-8');
  const entries = [];
  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    if (p + 46 > u8.length || dv.getUint32(p, true) !== SIG_CDIR) {
      throw new Error('Corrupt zip: central directory entry is not where the archive says it is');
    }
    const madeBy = dv.getUint16(p + 4, true);
    const flags = dv.getUint16(p + 8, true);
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const usize = dv.getUint32(p + 24, true);
    const nlen = dv.getUint16(p + 28, true);
    const elen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const ext = dv.getUint32(p + 38, true);
    const lho = dv.getUint32(p + 42, true);
    const name = td.decode(u8.subarray(p + 46, p + 46 + nlen));
    const host = madeBy >> 8; // 3 = unix, 19 = macOS
    const mode = host === 3 || host === 19 ? (ext >>> 16) & 0xffff : null;
    entries.push({ name, method, csize, usize, lho, mode, encrypted: !!(flags & 1) });
    p += 46 + nlen + elen + clen;
  }

  const files = [];
  for (const e of entries) {
    if (e.name.endsWith('/')) continue;
    if (e.encrypted) throw new Error(`${e.name} is encrypted; password-protected zips cannot be read`);
    if (e.lho + 30 > u8.length || dv.getUint32(e.lho, true) !== SIG_LOCAL) {
      throw new Error(`Corrupt zip: bad local header for ${e.name}`);
    }
    const nlen = dv.getUint16(e.lho + 26, true);
    const elen = dv.getUint16(e.lho + 28, true);
    const start = e.lho + 30 + nlen + elen;
    const comp = u8.subarray(start, start + e.csize);
    let bytes;
    if (e.method === 0) bytes = comp.slice();
    else if (e.method === 8) bytes = await inflateRaw(comp);
    else throw new Error(`${e.name} uses compression method ${e.method}; only stored and deflate are supported`);
    files.push({ path: e.name, bytes, mode: e.mode });
  }
  return files;
}

async function inflateRaw(u8) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser has no DecompressionStream, so zips cannot be read here. Use a current Chrome, Edge, Safari 16.4+ or Firefox 113+, or open the unzipped folder instead');
  }
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([u8]).stream().pipeThrough(ds);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}
