import type { HairStyle, Part } from "../types.js";
import { Canvas } from "./paint.js";

interface Spec {
  cx?: number; cy: number; rx: number; ry: number;
  /** extra rows lifted above the ellipse top, per column */
  lift?: (x: number) => number;
  /** exclusive bottom row of hair per column */
  bot: (x: number) => number;
  extra?: (c: Canvas) => void;
}
const side = (x: number) => x < 14 || x >= 34;
const jag = (a: number[]) => (x: number) => a[((x % a.length) + a.length) % a.length]!;

function front(id: string, s: Spec): Part {
  const c = new Canvas();
  const cx = s.cx ?? 24;
  for (let x = 0; x < 48; x++) {
    const dx = (x + 0.5 - cx) / s.rx;
    if (Math.abs(dx) >= 1) continue;
    const top = Math.round(s.cy - s.ry * Math.sqrt(1 - dx * dx) - (s.lift?.(x) ?? 0));
    const bot = Math.round(s.bot(x));
    for (let y = top; y < bot; y++) c.set(x, y, "h");
    if (bot - top > 4 && x % 3 === 0) c.set(x, top + 2, "H");
    if (bot - top > 8 && x % 4 === 1) c.set(x, bot - 2, "H");
  }
  s.extra?.(c);
  c.outline("H");
  return c.toPart(id, "hairFront");
}

function back(id: string, build: (c: Canvas) => void): Part {
  const c = new Canvas();
  build(c);
  c.outline("H");
  return c.toPart(id, "hairBack");
}

const nape = (c: Canvas) => { c.ell(24, 19, 14.5, 12, "h"); c.rect(14, 26, 33, 31, "h"); };

const specs: Record<HairStyle, { front: Spec; back: (c: Canvas) => void }> = {
  short: {
    front: { cy: 17, rx: 14.5, ry: 12, bot: (x) => (side(x) ? 23 : 16 + jag([1, 0, 2, 1, 0, 2, 1])(x)) },
    back: nape,
  },
  spiky: {
    front: { cy: 17, rx: 14.5, ry: 11, lift: jag([0, 2, 4, 2, 0]), bot: (x) => (side(x) ? 24 : 15 + jag([3, 0, 2, 0, 3])(x)) },
    back: (c) => { nape(c); },
  },
  curly: {
    front: {
      cy: 17, rx: 16.5, ry: 13, lift: (x) => (x % 4 < 2 ? 1 : 0),
      bot: (x) => (x < 12 || x >= 36 ? 28 : side(x) ? 25 : 15 + jag([0, 1, 0, 1])(x)),
      extra: (c) => { c.ell(9.5, 24, 3.6, 5.5, "h"); c.ell(38.5, 24, 3.6, 5.5, "h"); },
    },
    back: (c) => { nape(c); c.ell(9.5, 26, 4.2, 7, "h"); c.ell(38.5, 26, 4.2, 7, "h"); },
  },
  wavy: {
    front: {
      cy: 17, rx: 15, ry: 12,
      bot: (x) => (x < 14 ? 33 + jag([0, 1, 1, 0])(x) : x >= 34 ? 30 + jag([1, 0, 0, 1])(x) : Math.min(21, 14 + (34 - x) * 0.24 + jag([0, 1, 1, 0])(x))),
    },
    back: (c) => { nape(c); c.rect(10, 22, 37, 33, "h"); },
  },
  long: {
    front: {
      cy: 17, rx: 14.5, ry: 12,
      bot: (x) => (x < 12 ? 41 - (12 - x) : x < 14 ? 41 : x >= 36 ? 41 - (x - 35) : x >= 34 ? 41 : 15 + Math.abs(x - 23.5) * 0.12 + jag([1, 0, 1, 0, 1])(x)),
    },
    back: (c) => { nape(c); c.rect(10, 20, 37, 40, "h"); },
  },
  bob: {
    front: {
      cy: 17, rx: 15, ry: 12,
      bot: (x) => (x < 12 || x >= 36 ? 29 : side(x) ? 32 : 17 + jag([0, 0, 1, 0])(x)),
    },
    back: (c) => { nape(c); c.rect(10, 20, 37, 31, "h"); },
  },
  ponytail: {
    front: { cy: 17, rx: 14.5, ry: 12, bot: (x) => (side(x) ? 22 : x < 24 ? 14 + (24 - x) * 0.3 + jag([0, 1, 0])(x) : 15 + jag([1, 0, 1])(x)) },
    back: (c) => {
      nape(c);
      c.ell(38, 25, 4.2, 10, "h");
      c.ell(36.5, 15.5, 2, 2, "x");
    },
  },
  buns: {
    front: {
      cy: 17, rx: 14.5, ry: 12, bot: (x) => (side(x) ? 22 : 16 + jag([0, 1, 0, 1])(x)),
      extra: (c) => { c.ell(12.5, 6, 4.6, 4.6, "h"); c.ell(35.5, 6, 4.6, 4.6, "h"); c.rect(11, 10, 14, 10, "x"); c.rect(34, 10, 37, 10, "x"); },
    },
    back: nape,
  },
};

export const hairStyles = Object.keys(specs) as HairStyle[];
export const hairs: Record<HairStyle, { back: Part; front: Part }> = Object.fromEntries(
  hairStyles.map((k) => [k, { back: back(`hairBack.${k}`, specs[k].back), front: front(`hairFront.${k}`, specs[k].front) }]),
) as Record<HairStyle, { back: Part; front: Part }>;
