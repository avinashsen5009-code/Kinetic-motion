import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const publicDir = path.resolve(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. Write crisp vector SVG icon
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="112" fill="#090D16"/>
  <rect x="44" y="44" width="424" height="424" rx="84" fill="#0F172A" stroke="#38BDF8" stroke-width="12"/>
  <circle cx="256" cy="256" r="128" fill="none" stroke="#1E293B" stroke-width="16"/>
  <polygon points="216,176 336,256 216,336" fill="#38BDF8"/>
  <circle cx="144" cy="144" r="18" fill="#22C55E"/>
  <circle cx="368" cy="144" r="18" fill="#A855F7"/>
</svg>`;
fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent, 'utf-8');

// CRC32 helper for PNG chunks
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcVal = crc32(Buffer.concat([typeBuf, data]));
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createIconPng(size, isMaskable = false) {
  // Raw RGBA scanlines with filter byte 0 at start of each row
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * (isMaskable ? 0.34 : 0.40);
  const innerR = size * (isMaskable ? 0.28 : 0.33);

  for (let y = 0; y < size; y++) {
    const rowOffset = y * (size * 4 + 1);
    raw[rowOffset] = 0; // Filter type 0 (None)
    for (let x = 0; x < size; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.hypot(dx, dy);

      // Default background: Deep Studio Obsidian (#090D16)
      let r = 9, g = 13, b = 22, a = 255;

      // Inner dark slate disc (#0F172A)
      if (dist <= maxR) {
        r = 15; g = 23; b = 42;
      }

      // Electric cyan ring (#38BDF8)
      if (dist <= maxR && dist >= innerR) {
        r = 56; g = 189; b = 248;
      }

      // Center play triangle in electric cyan (#38BDF8)
      const triScale = isMaskable ? 0.14 : 0.17;
      const tx = dx / (size * triScale);
      const ty = dy / (size * triScale);
      if (tx >= -0.45 && tx <= 0.75 && Math.abs(ty) <= (0.75 - tx) * 0.58) {
        r = 56; g = 189; b = 248;
      }

      raw[pxOffset] = r;
      raw[pxOffset + 1] = g;
      raw[pxOffset + 2] = b;
      raw[pxOffset + 3] = a;
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idatData = zlib.deflateSync(raw, { level: 6 });
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idatData),
    makeChunk('IEND', iend),
  ]);
}

fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createIconPng(192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createIconPng(512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createIconPng(512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createIconPng(180, false));
console.log('Generated all PWA PNG and SVG icons in public/');
