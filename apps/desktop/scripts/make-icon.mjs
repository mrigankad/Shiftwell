// Writes src-tauri/icon-source.png (1024x1024): two slanted bars on a transparent background.
// Pure JS rasteriser with 4x4 supersampling and a tiny PNG encoder (no dependencies).
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const N = 1024, SS = 4;
const shear = 0.32; // x shift per unit of height
const bars = [
  { x0: 250, w: 190, color: [0x16, 0x18, 0x1d] },
  { x0: 560, w: 190, color: [0xff, 0x5a, 0x1f] },
];
const top = 180, bot = 844;
function hit(x, y) {
  if (y < top || y > bot) return null;
  const off = (bot - y) * shear - ((bot - top) * shear) / 2; // slants right going up
  for (const b of bars) if (x >= b.x0 + off && x <= b.x0 + off + b.w) return b.color;
  return null;
}
const stride = N * 4 + 1;
const raw = Buffer.alloc(stride * N);
for (let y = 0; y < N; y++) {
  for (let x = 0; x < N; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < SS; sy++)
      for (let sx = 0; sx < SS; sx++) {
        const c = hit(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS);
        if (c) { r += c[0]; g += c[1]; b += c[2]; a++; }
      }
    const o = y * stride + 1 + x * 4;
    if (a) { raw[o] = r / a; raw[o + 1] = g / a; raw[o + 2] = b / a; raw[o + 3] = Math.round((255 * a) / (SS * SS)); }
  }
}
const crcT = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => { let c = 0xffffffff; for (const v of buf) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => {
  const l = Buffer.alloc(4); l.writeUInt32BE(d.length);
  const td = Buffer.concat([Buffer.from(t), d]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([l, td, c]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
]);
const out = resolve(dirname(fileURLToPath(import.meta.url)), "../src-tauri/icon-source.png");
writeFileSync(out, png);
console.log("wrote", out);
