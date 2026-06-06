#!/usr/bin/env node
/**
 * generate-placeholder-icons.js
 *
 * Creates solid-colour placeholder PNG files for the three alternate app-icon
 * variants (dark, neon, gold).  Run this once, then commit the generated files:
 *
 *   node scripts/generate-placeholder-icons.js
 *
 * Output:
 *   assets/icons/icon-dark.png   (1024 × 1024, near-black)
 *   assets/icons/icon-neon.png   (1024 × 1024, dark cyan)
 *   assets/icons/icon-gold.png   (1024 × 1024, dark amber)
 *
 * iOS:     Expo reads these directly from assets/icons/ (app.json alternateIcons).
 * Android: withAndroidAlternateIcons.js reads them and produces every mipmap density.
 */

const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ── Minimal PNG encoder (pure Node.js, no external deps) ─────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const lenBuf    = Buffer.allocUnsafe(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.allocUnsafe(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  return Buffer.concat([lenBuf, typeBytes, data, crcBuf]);
}

/**
 * Encode a solid-colour RGB image as a PNG buffer.
 * Uses filter-type 0 (None) on every row + zlib level-1 for speed.
 */
function solidColorPng(width, height, r, g, b) {
  const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(width,  0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 2; // RGB colour type
  ihdr.fill(0, 10); // compression / filter / interlace = 0

  // Build raw scanlines: [filter=0, R, G, B, R, G, B, ...]
  const rowStride = 1 + width * 3;
  const raw = Buffer.allocUnsafe(height * rowStride);
  for (let y = 0; y < height; y++) {
    const base = y * rowStride;
    raw[base] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      raw[base + 1 + x * 3] = r;
      raw[base + 2 + x * 3] = g;
      raw[base + 3 + x * 3] = b;
    }
  }

  const idat = zlib.deflateSync(raw, { level: 1 });

  return Buffer.concat([
    PNG_SIG,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Icon definitions ──────────────────────────────────────────────────────────

const ICONS = [
  { name: 'icon-dark', r: 10,  g: 10,  b: 10  }, // #0a0a0a — near black
  { name: 'icon-neon', r: 0,   g: 16,  b: 16  }, // #001010 — void cyan
  { name: 'icon-gold', r: 26,  g: 18,  b: 0   }, // #1a1200 — dark amber
];

const SIZE = 1024;
const OUT_DIR = path.join(__dirname, '..', 'assets', 'icons');

// ── Generate ──────────────────────────────────────────────────────────────────

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const icon of ICONS) {
  const dest = path.join(OUT_DIR, `${icon.name}.png`);
  const buf  = solidColorPng(SIZE, SIZE, icon.r, icon.g, icon.b);
  fs.writeFileSync(dest, buf);
  console.log(`✓ ${dest}  (${(buf.length / 1024).toFixed(1)} KB)`);
}

console.log('\nDone. Commit assets/icons/*.png and run `expo prebuild` or an EAS build.');
