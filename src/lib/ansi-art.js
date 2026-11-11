// @ts-check
// Classic BBS ANSI art (.ANS): CP437 text with SGR colour codes and
// cursor-forward moves, usually followed by a SAUCE metadata record.
//
// Plain JavaScript on purpose: this one module is shared by the Astro build,
// the browser playback script, and scripts/export-zine.js.
//
// The parser never passes escape sequences from a file through. Its output
// is a grid of printable characters with colour indexes; every escape
// sequence or HTML tag in the output is generated here.

export const ANSI_COLS = 80;

/** VGA text-mode palette in ANSI colour order (0-7 normal, 8-15 bright). */
export const VGA_PALETTE = [
  [0, 0, 0], [170, 0, 0], [0, 170, 0], [170, 85, 0],
  [0, 0, 170], [170, 0, 170], [0, 170, 170], [170, 170, 170],
  [85, 85, 85], [255, 85, 85], [85, 255, 85], [255, 255, 85],
  [85, 85, 255], [255, 85, 255], [85, 255, 255], [255, 255, 255],
];

// CP437 0x00-0x1F glyphs (0x00 shown as a space).
const CP437_LOW = ' ☺☻♥♦♣♠•◘○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼';
// CP437 0x80-0xFF.
const CP437_HIGH =
  'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐' +
  '└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';

/** @param {number} byte */
export function cp437(byte) {
  if (byte < 0x20) return CP437_LOW[byte];
  if (byte < 0x7f) return String.fromCharCode(byte);
  if (byte === 0x7f) return '⌂';
  return CP437_HIGH[byte - 0x80];
}

/**
 * @typedef {{ ch: string, fg: number, bg: number }} AnsiCell fg 0-15, bg 0-7
 * @typedef {{ title: string, author: string, group: string, date: string, width: number }} Sauce
 *   date is YYYY-MM-DD or ''; width is 0 when the record does not say
 * @typedef {{ rows: AnsiCell[][], body: Uint8Array, sauce: Sauce | null }} AnsiArt
 * @typedef {{ pos: number, row: number, col: number }} AnsiCursor
 */

/**
 * @param {Uint8Array} data
 * @returns {Sauce | null}
 */
export function parseSauce(data) {
  if (data.length < 128) return null;
  const rec = data.subarray(data.length - 128);
  /** @param {number} from @param {number} len */
  const text = (from, len) =>
    Array.from(rec.subarray(from, from + len), cp437).join('').replace(/[\s ]+$/, '');
  if (text(0, 7) !== 'SAUCE00') return null;
  const d = text(82, 8);
  // DataType 1 (character), FileType 0/1 (ASCII/ANSi): TInfo1 is the width.
  const isText = rec[94] === 1 && rec[95] <= 1;
  return {
    title: text(7, 35),
    author: text(42, 20),
    group: text(62, 20),
    date: /^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : '',
    width: isText ? rec[96] | (rec[97] << 8) : 0,
  };
}

/**
 * The art bytes only: everything before the EOF marker / SAUCE record.
 * @param {Uint8Array} data
 */
export function ansiBody(data) {
  let end = data.indexOf(0x1a);
  if (end < 0) end = parseSauce(data) ? data.length - 128 : data.length;
  return data.subarray(0, end);
}

/**
 * Read one CSI sequence starting at body[i] (which must be ESC followed by
 * '['). Returns its numeric parameters, final byte, and the index after it.
 * @param {Uint8Array} body @param {number} i
 */
function readCsi(body, i) {
  let j = i + 2;
  /** @type {number[]} */
  const params = [0];
  while (j < body.length && (body[j] < 0x40 || body[j] > 0x7e)) {
    const c = body[j++];
    if (c >= 0x30 && c <= 0x39) params[params.length - 1] = params[params.length - 1] * 10 + (c - 0x30);
    else if (c === 0x3b) params.push(0);
  }
  return { params, final: j < body.length ? String.fromCharCode(body[j]) : '', next: j + 1 };
}

/**
 * Replay the byte stream up to `target` bytes, moving the cursor the way a
 * terminal would. An escape sequence is consumed whole.
 *
 * Wrap rule (as in ansilove, the reference renderer): a cursor that has run
 * off the right edge wraps before the next byte of any kind is processed,
 * including cursor moves and line breaks.
 *
 * @param {Uint8Array} body
 * @param {AnsiCursor} cur mutated in place
 * @param {number} target
 * @param {(b: number, row: number, col: number) => void} [onChar] called for each printed byte
 * @param {(params: number[]) => void} [onSgr] called for each SGR sequence
 */
export function advanceCursor(body, cur, target, onChar, onSgr) {
  const end = Math.min(target, body.length);
  while (cur.pos < end) {
    const b = body[cur.pos];
    if (cur.col >= ANSI_COLS) { cur.col = 0; cur.row++; }
    if (b === 0x1b && body[cur.pos + 1] === 0x5b) {
      const csi = readCsi(body, cur.pos);
      if (csi.final === 'C') cur.col = Math.min(ANSI_COLS, cur.col + (csi.params[0] || 1));
      else if (csi.final === 'm' && onSgr) onSgr(csi.params);
      cur.pos = csi.next;
      continue;
    }
    if (b === 0x0d) cur.col = 0;
    else if (b === 0x0a) cur.row++;
    else if (b !== 0x1b) {
      if (onChar) onChar(b, cur.row, cur.col);
      cur.col++;
    }
    cur.pos++;
  }
}

/**
 * Why a file cannot be shown, or null if it can. Only 80-column art using
 * colours and cursor-forward moves is supported.
 * @param {Uint8Array} data
 * @returns {string | null}
 */
export function unsupportedReason(data) {
  const sauce = parseSauce(data);
  if (sauce && sauce.width > ANSI_COLS) return `it is ${sauce.width} columns wide (maximum ${ANSI_COLS})`;
  const body = ansiBody(data);
  let drawn = false;
  for (let i = 0; i < body.length; i++) {
    if (body[i] === 0x1b && body[i + 1] === 0x5b) {
      const csi = readCsi(body, i);
      if (csi.final === 'm') {
        if (csi.params.some(p => p === 5 || p === 6)) return 'it uses blinking text';
      } else if (csi.final === 'H' || csi.final === 'f') {
        if (drawn) return 'it repositions the cursor mid-drawing';
      } else if (!'CJhl'.includes(csi.final) || csi.final === '') {
        return `it uses an unsupported cursor command (CSI ${csi.final || '?'})`;
      }
      i = csi.next - 1;
    } else if (body[i] !== 0x0d && body[i] !== 0x0a) {
      drawn = true;
    }
  }
  return null;
}

/**
 * @param {Uint8Array} data
 * @returns {AnsiArt}
 */
export function parseAnsiArt(data) {
  const body = ansiBody(data);
  /** @type {AnsiCell[][]} */
  const rows = [];
  let fg = 7;
  let bg = 0;
  let bold = false;

  advanceCursor(
    body,
    { pos: 0, row: 0, col: 0 },
    body.length,
    (b, row, col) => {
      while (rows.length <= row) rows.push(Array.from({ length: ANSI_COLS }, () => ({ ch: ' ', fg: 7, bg: 0 })));
      rows[row][col] = { ch: cp437(b), fg: fg + (bold ? 8 : 0), bg };
    },
    params => {
      for (const n of params) {
        if (n === 0) { fg = 7; bg = 0; bold = false; }
        else if (n === 1) bold = true;
        else if (n === 22) bold = false;
        else if (n >= 30 && n <= 37) fg = n - 30;
        else if (n >= 40 && n <= 47) bg = n - 40;
      }
    },
  );

  return { rows, body, sauce: parseSauce(data) };
}

/**
 * Article metadata for an art file named `{order}-{slug}.ans`. Title, artist,
 * group and date come from the SAUCE record when there is one.
 * @param {string} filename
 * @param {Uint8Array} data
 */
export function ansiMeta(filename, data) {
  const stem = filename.replace(/\.ans$/i, '');
  const slug = stem.toLowerCase();
  const m = stem.match(/^(\d+)-(.*)$/);
  const sauce = parseSauce(data);
  const title = sauce?.title || (m ? m[2] : stem);
  const author = sauce?.author || 'unknown';
  const group = sauce?.group || '';
  return {
    slug,
    order: m ? parseInt(m[1], 10) : 0,
    title,
    author,
    group,
    date: sauce?.date || '',
    description: `ANSI art by ${author}${group ? ` of ${group}` : ''}.`,
  };
}

/** One-line credit: "title" by artist / group · date */
/** @param {{ title: string, author: string, group: string, date: string }} meta */
export function ansiCredit(meta) {
  return [`"${meta.title}"`, `by ${meta.author}`, meta.group && `/ ${meta.group}`, meta.date && `· ${meta.date}`]
    .filter(Boolean)
    .join(' ');
}

/** @param {string} s */
const escapeHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Split a row into runs of cells sharing colours.
 * @param {AnsiCell[]} cells
 * @returns {{ fg: number, bg: number, text: string }[]}
 */
function runs(cells) {
  const out = [];
  for (let i = 0; i < cells.length; ) {
    const { fg, bg } = cells[i];
    let text = '';
    while (i < cells.length && cells[i].fg === fg && cells[i].bg === bg) text += cells[i++].ch;
    out.push({ fg, bg, text });
  }
  return out;
}

/**
 * Rows as <div class="ansi-row"> elements. By default spans carry colour
 * classes (f0-f15, b0-b7); pass `style` to emit inline styles instead.
 * @param {AnsiCell[][]} rows
 * @param {(fg: number, bg: number) => string} [style]
 */
export function ansiRowsToHtml(rows, style) {
  return rows
    .map(cells => {
      const spans = runs(cells)
        .map(r => {
          const attr = style ? `style="${style(r.fg, r.bg)}"` : `class="f${r.fg} b${r.bg}"`;
          return `<span ${attr}>${escapeHtml(r.text)}</span>`;
        })
        .join('');
      return `<div class="ansi-row">${spans}</div>`;
    })
    .join('');
}

/**
 * Rows as terminal text with 24-bit VGA colours, one line per row.
 * @param {AnsiCell[][]} rows
 */
export function ansiRowsToAnsi(rows) {
  return rows
    .map(cells =>
      runs(cells)
        .map(r => {
          const f = VGA_PALETTE[r.fg];
          const b = VGA_PALETTE[r.bg];
          return `\x1b[38;2;${f[0]};${f[1]};${f[2]};48;2;${b[0]};${b[1]};${b[2]}m${r.text}`;
        })
        .join('') + '\x1b[0m',
    )
    .join('\n');
}

/** Grey level (0-255) of a palette colour, by perceived brightness. */
/** @param {number} index */
export function vgaGrey(index) {
  const [r, g, b] = VGA_PALETTE[index];
  return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
}
