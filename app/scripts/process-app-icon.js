#!/usr/bin/env node
/**
 * process-app-icon.js
 *
 * Takes the raw Soniq logo PNG (assets/icons/icon-source.png), removes the
 * small sparkle watermark in the bottom-right corner by covering it with the
 * surrounding background colour, then copies the cleaned image to every
 * icon slot Expo needs.
 *
 * Usage:
 *   1. Save your logo PNG to:  app/assets/icons/icon-source.png
 *   2. Run:  node scripts/process-app-icon.js
 *   3. Commit the output files, then trigger a new EAS build.
 *
 * No npm dependencies — pure Node.js (zlib + fs).
 */

'use strict';

const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ── Paths ─────────────────────────────────────────────────────────────────────

const ROOT       = path.join(__dirname, '..');
const SRC        = path.join(ROOT, 'assets', 'icons', 'icon-source.png');
const OUT_MAIN   = path.join(ROOT, 'assets', 'images', 'icon.png');
const OUT_SPLASH = path.join(ROOT, 'assets', 'images', 'splash-icon.png');
const OUT_ADAPT  = path.join(ROOT, 'assets', 'images', 'adaptive-icon.png');
const OUT_NEON   = path.join(ROOT, 'assets', 'icons',  'icon-neon.png');

// ── PNG helpers ───────────────────────────────────────────────────────────────

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

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
  for (const byte of buf) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const tb  = Buffer.from(type, 'ascii');
  const len = Buffer.allocUnsafe(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.allocUnsafe(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0);
  return Buffer.concat([len, tb, data, crcBuf]);
}

function parseChunks(buf) {
  const chunks = [];
  let pos = 8;
  while (pos < buf.length) {
    const length = buf.readUInt32BE(pos);
    const type   = buf.slice(pos + 4, pos + 8).toString('ascii');
    const data   = buf.slice(pos + 8, pos + 8 + length);
    chunks.push({ type, data });
    pos += 12 + length;
  }
  return chunks;
}

function bytesPerPixel(colorType) {
  return { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType] ?? 3;
}

// Paeth predictor (used by PNG filter type 4)
function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/**
 * Un-apply PNG per-scanline filters → raw pixel buffer.
 * Each scanline in `filtered` starts with 1 filter-type byte.
 */
function unfilter(filtered, W, H, bpp) {
  const stride = W * bpp;
  const raw    = Buffer.alloc(H * stride, 0);

  for (let y = 0; y < H; y++) {
    const ft      = filtered[y * (stride + 1)];       // filter type byte
    const inBase  = y * (stride + 1) + 1;
    const outBase = y * stride;

    for (let x = 0; x < stride; x++) {
      const filt = filtered[inBase + x];
      const a = x >= bpp             ? raw[outBase + x - bpp]               : 0;
      const b = y > 0               ? raw[(y - 1) * stride + x]             : 0;
      const c = y > 0 && x >= bpp  ? raw[(y - 1) * stride + x - bpp]       : 0;

      let recon;
      switch (ft) {
        case 0: recon = filt;                                          break;
        case 1: recon = (filt + a)                       & 0xff;      break;
        case 2: recon = (filt + b)                       & 0xff;      break;
        case 3: recon = (filt + Math.floor((a + b) / 2)) & 0xff;      break;
        case 4: recon = (filt + paeth(a, b, c))          & 0xff;      break;
        default: recon = filt;
      }
      raw[outBase + x] = recon;
    }
  }
  return raw;
}

/**
 * Re-apply filter type 0 (None) — simplest encoding, compresses well for
 * uniform backgrounds.  Returns buffer with 1 filter byte prepended per row.
 */
function filterNone(raw, W, H, bpp) {
  const stride = W * bpp;
  const out    = Buffer.alloc(H * (stride + 1));
  for (let y = 0; y < H; y++) {
    out[y * (stride + 1)] = 0; // filter: None
    raw.copy(out, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return out;
}

// ── Core processing ───────────────────────────────────────────────────────────

function processIcon(inputPath, outputPath) {
  if (!fs.existsSync(inputPath)) {
    console.error(`\n  ✗ Source not found: ${inputPath}`);
    console.error('  Save your logo PNG there first, then re-run this script.\n');
    process.exit(1);
  }

  const buf = fs.readFileSync(inputPath);

  if (!buf.slice(0, 8).equals(PNG_SIG)) {
    throw new Error(`Not a valid PNG: ${inputPath}`);
  }

  const chunks = parseChunks(buf);
  const ihdrChunk = chunks.find(c => c.type === 'IHDR');
  if (!ihdrChunk) throw new Error('IHDR chunk missing');

  const d         = ihdrChunk.data;
  const W         = d.readUInt32BE(0);
  const H         = d.readUInt32BE(4);
  const colorType = d[9];
  const bpp       = bytesPerPixel(colorType);

  console.log(`  Source: ${W}×${H} px  colorType=${colorType}  bpp=${bpp}`);

  // Inflate all IDAT chunks concatenated
  const idatRaw  = Buffer.concat(chunks.filter(c => c.type === 'IDAT').map(c => c.data));
  const filtered = zlib.inflateSync(idatRaw);

  // Un-filter → raw RGBA/RGB pixel buffer
  const raw    = unfilter(filtered, W, H, bpp);
  const stride = W * bpp;

  // ── Watermark removal ─────────────────────────────────────────────────────
  // The watermark is a small sparkle (~40×40 px) in the bottom-right corner of
  // the outer background area.  We sample the background colour from the
  // top-right corner (which is clean outer background) and paint over the
  // watermark region with that colour.

  // Sample from top-right corner (clearly outside icon content)
  const sampX   = W - 12;
  const sampY   = 12;
  const sampIdx = sampY * stride + sampX * bpp;
  const bgR = raw[sampIdx];
  const bgG = raw[sampIdx + 1];
  const bgB = raw[sampIdx + 2];
  const bgA = bpp === 4 ? raw[sampIdx + 3] : 255;
  console.log(`  Background colour: rgb(${bgR},${bgG},${bgB}) alpha=${bgA}`);

  // Cover bottom-right 90×90 region with background colour
  const COVER = 90;
  for (let y = H - COVER; y < H; y++) {
    for (let x = W - COVER; x < W; x++) {
      const idx     = y * stride + x * bpp;
      raw[idx]      = bgR;
      raw[idx + 1]  = bgG;
      raw[idx + 2]  = bgB;
      if (bpp === 4) raw[idx + 3] = bgA;
    }
  }

  // Re-filter with None (fastest, lossless) and compress
  const reFiltered = filterNone(raw, W, H, bpp);
  const newIdat    = zlib.deflateSync(reFiltered, { level: 7 });

  // Rebuild PNG: preserve metadata chunks (sRGB, gAMA, pHYs, etc.)
  const parts = [PNG_SIG, makeChunk('IHDR', ihdrChunk.data)];
  for (const c of chunks) {
    if (c.type === 'IHDR' || c.type === 'IDAT' || c.type === 'IEND') continue;
    // Re-build chunk with correct CRC
    parts.push(makeChunk(c.type, c.data));
  }
  parts.push(makeChunk('IDAT', newIdat));
  parts.push(makeChunk('IEND', Buffer.alloc(0)));

  const output = Buffer.concat(parts);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, output);
  console.log(`  ✓ ${path.relative(ROOT, outputPath)}  (${(output.length / 1024).toFixed(1)} KB)`);
  return outputPath;
}

// ── Run ───────────────────────────────────────────────────────────────────────

console.log('\n[Soniq] Processing app icon…');
console.log(`  Input: ${path.relative(ROOT, SRC)}\n`);

// Process the source once
processIcon(SRC, OUT_MAIN);

// Copy the same cleaned file to all other slots
// (Expo resizes these to the required sizes during build)
const cleanBuf = fs.readFileSync(OUT_MAIN);

[OUT_SPLASH, OUT_ADAPT, OUT_NEON].forEach((dest) => {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, cleanBuf);
  console.log(`  ✓ ${path.relative(ROOT, dest)}`);
});

console.log('\nDone. Commit the files in assets/ and run a new EAS build.\n');
