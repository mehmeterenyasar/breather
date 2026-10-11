/**
 * Draws the icons, with no dependencies.
 *
 * The mark is a ring with a gap at the top right, which reads as a timer. The
 * stroke is a ratio of the size rather than a fixed width, so the 16px version
 * is still legible.
 *
 * The PNGs are encoded by hand with node:zlib. That avoids both a heavyweight
 * dependency like sharp or resvg and a binary file in the repository: to change
 * the icon, edit the geometry below and run `npm run icons`.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icon');
const SIZES = [16, 32, 48, 96, 128];

/** A green-teal that holds up against both a light and a dark toolbar. */
const COLOR = { r: 0x4a, g: 0x93, b: 0x82 };

/** Geometry, as ratios of the size. */
const RADIUS_RATIO = 0.33;
const STROKE_RATIO = 0.17;
/** Gap width and centre, in degrees. Top right, so it doesn't read as a power button. */
const GAP_DEG = 58;
const GAP_CENTER_DEG = -45;
/** Supersampling factor, for the antialiasing. */
const SS = 4;

const TAU = Math.PI * 2;
const toRad = (deg) => (deg * Math.PI) / 180;

/** Whether a point falls inside the ring. Sampled for coverage. */
function isInsideRing(x, y, cx, cy, radius, halfStroke, startAngle, endAngle) {
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.hypot(dx, dy);

  // The round caps at each end of the arc.
  for (const angle of [startAngle, endAngle]) {
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius;
    if (Math.hypot(x - px, y - py) <= halfStroke) return true;
  }

  if (Math.abs(dist - radius) > halfStroke) return false;

  // Bring the angle into [startAngle, startAngle + sweep].
  let angle = Math.atan2(dy, dx);
  let delta = angle - startAngle;
  while (delta < 0) delta += TAU;
  return delta <= endAngle - startAngle;
}

function renderIcon(size) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * RADIUS_RATIO;
  const halfStroke = (size * STROKE_RATIO) / 2;

  // The arc runs clockwise from the end of the gap round to its start.
  const startAngle = toRad(GAP_CENTER_DEG + GAP_DEG / 2);
  const endAngle = toRad(GAP_CENTER_DEG - GAP_DEG / 2 + 360);

  const pixels = Buffer.alloc(size * size * 4);
  const step = 1 / SS;
  const samples = SS * SS;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = px + (sx + 0.5) * step;
          const y = py + (sy + 0.5) * step;
          if (isInsideRing(x, y, cx, cy, radius, halfStroke, startAngle, endAngle)) hits++;
        }
      }

      const alpha = Math.round((hits / samples) * 255);
      const offset = (py * size + px) * 4;
      pixels[offset] = COLOR.r;
      pixels[offset + 1] = COLOR.g;
      pixels[offset + 2] = COLOR.b;
      pixels[offset + 3] = alpha;
    }
  }

  return pixels;
}

/* ---------------- PNG kodlama ---------------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Every scanline starts with a filter byte.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });

for (const size of SIZES) {
  const png = encodePng(size, renderIcon(size));
  const file = resolve(OUT_DIR, `${size}.png`);
  writeFileSync(file, png);
  console.log(`${size}.png  ${png.length} bayt`);
}
