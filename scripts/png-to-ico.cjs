// Convert PNG app icon to ICO format (PNG-in-ICO, Windows Vista+ compatible).
const fs = require("node:fs");
const path = require("node:path");

const pngPath = path.join(__dirname, "..", "src", "assets", "icon.png");
const icoPath = path.join(__dirname, "..", "src", "assets", "icon.ico");

const png = fs.readFileSync(pngPath);

// PNG IHDR starts at offset 16: 8 sig + 4 len + 4 "IHDR"
const w = png.readUInt32BE(16);
const h = png.readUInt32BE(20);

// ICO header (6 bytes)
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: ICO
header.writeUInt16LE(1, 4); // count

// ICO directory entry (16 bytes)
const entry = Buffer.alloc(16);
entry.writeUInt8(w >= 256 ? 0 : w, 0); // width
entry.writeUInt8(h >= 256 ? 0 : h, 1); // height
entry.writeUInt8(0, 2); // palette
entry.writeUInt8(0, 3); // reserved
entry.writeUInt16LE(1, 4); // color planes
entry.writeUInt16LE(32, 6); // bpp (doesn't matter for PNG data)
entry.writeUInt32LE(png.length, 8); // image size
entry.writeUInt32LE(22, 12); // offset (6 header + 16 entry)

const ico = Buffer.concat([header, entry, png]);
fs.writeFileSync(icoPath, ico);
console.log(`ICO saved: ${icoPath} (${w}x${h}, ${ico.length} bytes)`);
