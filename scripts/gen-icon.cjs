// Pure Node.js PNG encoder — generates app icon without Electron dependency.
const fs = require("node:fs");
const zlib = require("node:zlib");
const path = require("node:path");

const S = 512, R = 96;

// Raw RGBA pixels with filter byte (0 = None) prepended to each row
const rawRows = [];
for (let y = 0; y < S; y++) {
  const row = [0]; // filter: None
  for (let x = 0; x < S; x++) {
    const dx = Math.abs(x - S/2), dy = Math.abs(y - S/2);
    let inside = dx <= S/2 - 1 && dy <= S/2 - 1;
    if (dx > S/2 - 1 - R && dy > S/2 - 1 - R) {
      const ex = dx - (S/2 - 1 - R), ey = dy - (S/2 - 1 - R);
      inside = ex*ex + ey*ey <= R*R;
    }
    if (inside) {
      row.push(255, 255, 255, 255); // white BG
    } else {
      row.push(0, 0, 0, 0); // transparent
    }
  }
  rawRows.push(row);
}

function draw(x, y, r, g, b) {
  if (x < 0 || x >= S || y < 0 || y >= S) return;
  const row = rawRows[y];
  const i = 1 + x * 4;
  row[i] = r; row[i+1] = g; row[i+2] = b; row[i+3] = 255;
}

function thickLine(x0, y0, x1, y1, w, r, g, b) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  for (let j = 0; j <= len; j++) {
    const cx = Math.round(x0 + (j / len) * (x1 - x0));
    const cy = Math.round(y0 + (j / len) * (y1 - y0));
    for (let dy = -w; dy <= w; dy++)
      for (let dx = -w; dx <= w; dx++)
        if (dx*dx + dy*dy <= w*w) draw(cx + dx, cy + dy, r, g, b);
  }
}

function fillRect(x0, y0, x1, y1, r, g, b) {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      draw(x, y, r, g, b);
}

// Blue (#007aff) ">" chevron and "_" line
const blue = [0, 122, 255];
thickLine(144, 368, 240, 256, 16, ...blue);
thickLine(240, 256, 144, 144, 16, ...blue);
fillRect(272, 368, 416, 400, ...blue);

// Flatten to Buffer
const raw = Buffer.alloc(rawRows.length * rawRows[0].length);
let offset = 0;
for (const row of rawRows) {
  for (const v of row) raw[offset++] = v;
}

// PNG encoding
function crc32(buf) {
  let c = 0xffffffff;
  const table = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c; } return t; })();
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeB = Buffer.from(type, "ascii");
  const crc = crc32(Buffer.concat([typeB, data]));
  const crcB = Buffer.alloc(4);
  crcB.writeUInt32BE(crc);
  return Buffer.concat([len, typeB, data, crcB]);
}

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0);  ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8;  // bit depth
ihdr[9] = 6;  // color type: RGBA
ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

const compressed = zlib.deflateSync(raw);
const png = Buffer.concat([
  signature,
  chunk("IHDR", ihdr),
  chunk("IDAT", compressed),
  chunk("IEND", Buffer.alloc(0)),
]);

const outPath = path.join(__dirname, "..", "src", "assets", "icon.png");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, png);
console.log("Icon saved to", outPath);
