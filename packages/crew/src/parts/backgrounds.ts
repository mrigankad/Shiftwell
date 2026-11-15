import type { Part, Scene } from "../types.js";
import { Canvas } from "./paint.js";

const hash = (x: number, y: number) => ((x * 73856093) ^ (y * 19349663)) >>> 0;

function city(): Part {
  const c = new Canvas();
  c.rect(0, 0, 47, 47, "1");
  const bl: [number, number, number][] = [[0, 10, 24], [9, 18, 15], [18, 27, 28], [26, 38, 17], [37, 47, 23]];
  for (const [a, b, top] of bl) {
    c.rect(a, top, b, 47, "2");
    for (let y = top + 2; y < 40; y += 4)
      for (let x = a + 1; x < b; x += 3) if (hash(x, y) % 3 === 0) c.set(x, y, "w");
  }
  for (const [x, y] of [[5, 3], [20, 6], [33, 2], [42, 8], [12, 9]] as const) c.set(x, y, "w");
  return c.toPart("bg.city", "background");
}
function desk(): Part {
  const c = new Canvas();
  c.rect(0, 0, 47, 47, "1");
  c.rect(0, 30, 47, 47, "2");
  c.rect(2, 12, 9, 15, "w"); c.rect(3, 16, 8, 16, "w"); c.rect(5, 17, 6, 28, "2");
  c.rect(35, 14, 46, 26, "2"); c.rect(36, 15, 45, 25, "1");
  for (let y = 17; y < 25; y += 2) c.rect(37, y, 37 + (hash(y, 3) % 6) + 1, y, "w");
  for (const [x, y] of [[16, 4], [26, 8], [44, 4]] as const) c.set(x, y, "w");
  return c.toPart("bg.desk", "background");
}
function stars(): Part {
  const c = new Canvas();
  c.rect(0, 0, 47, 47, "1");
  for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) if ((x + y) % 2 === 0 && y > 28 + (x % 5)) c.set(x, y, "2");
  c.ell(40, 8, 4.5, 4.5, "w"); c.ell(42, 6.5, 3.8, 3.8, "1");
  for (let i = 0; i < 14; i++) { const x = hash(i, 1) % 48, y = hash(i, 2) % 26; if (c.get(x, y) === "1") c.set(x, y, "w"); }
  return c.toPart("bg.stars", "background");
}
function plain(): Part {
  const c = new Canvas();
  c.rect(0, 0, 47, 47, "1");
  for (let y = 24; y < 48; y++) for (let x = 0; x < 48; x++) if ((x + y) % 2 === 0 || y > 36) c.set(x, y, "2");
  return c.toPart("bg.plain", "background");
}

export const backgrounds: Record<Scene, Part> = { city: city(), desk: desk(), stars: stars(), plain: plain() };
