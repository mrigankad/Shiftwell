// Writes src-tauri/icon-source.png (1024x1024) and the 64px tray variants in src-tauri/icons/tray: two slanted bars on a transparent background.
// Pure JS rasteriser with 4x4 supersampling and a tiny PNG encoder (no dependencies).
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
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
const dots = {
  attention: [0xf5, 0xa5, 0x24],
  out: [0xe5, 0x48, 0x4d],
};
// Renders the mark at size n (coordinates are defined on the 1024 grid); an optional status dot
// with a light ring sits bottom right.
function render(n, dot) {
  const k = 1024 / n;
  const dx = 790, dy = 790, dr = 150, ring = 50;
  const stride = n * 4 + 1;
  const raw = Buffer.alloc(stride * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const px = (x + (sx + 0.5) / SS) * k, py = (y + (sy + 0.5) / SS) * k;
          let c = hit(px, py);
          if (dot) {
            const d = Math.hypot(px - dx, py - dy);
            if (d <= dr) c = dots[dot];
            else if (d <= dr + ring) c = [0xff, 0xff, 0xff];
          }
          if (c) { r += c[0]; g += c[1]; b += c[2]; a++; }
        }
      const o = y * stride + 1 + x * 4;
      if (a) { raw[o] = r / a; raw[o + 1] = g / a; raw[o + 2] = b / a; raw[o + 3] = Math.round((255 * a) / (SS * SS)); }
    }
  }
  return raw;
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
const png = (n, raw) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n, 0); ihdr.writeUInt32BE(n, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
  ]);
};
const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(resolve(here, "../src-tauri/icons/tray"), { recursive: true });
const write = (rel, n, dot) => {
  const out = resolve(here, rel);
  writeFileSync(out, png(n, render(n, dot)));
  console.log("wrote", out);
};
write("../src-tauri/icon-source.png", N);
// Tray variants: normal, attention (warn dot), out (fail dot).
write("../src-tauri/icons/tray/normal.png", 64);
write("../src-tauri/icons/tray/attention.png", 64, "attention");
write("../src-tauri/icons/tray/out.png", 64, "out");
