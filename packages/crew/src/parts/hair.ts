import type { HairStyle, Part } from "../types.js";
import { Canvas } from "./paint.js";

/**
 * Hair is built from a crown ellipse, a per-column hairline (bangs, fringes, side locks)
 * and hand-placed shading: a highlight arc, a shade row under the fringe, strand lines.
 * The face area (forehead and brows) is left open on purpose.
 */
interface Front {
  lo?: number; hi?: number;
  cx?: number; cy: number; rx: number; ry: number;
  lift?: (x: number) => number;
  /** exclusive bottom row of hair per column; <= top means no hair */
  bot: (x: number) => number;
  /** [x, y0, y1] dark strand lines */
  strands?: [number, number, number][];
  /** [x, y] extra highlight pixels, besides the automatic arc */
  light?: [number, number][];
  noShine?: boolean;
  extra?: (c: Canvas) => void;
  /** runs after shading, before outline */
  after?: (c: Canvas) => void;
}

/** symmetric profile from a 14 entry table for x = 10..23 (mirrored about the grid centre) */
const sym = (t: number[]) => (x: number) => t[Math.min(x, 47 - x) - 10] ?? 0;
const jag = (a: number[]) => (x: number) => a[((x % a.length) + a.length) % a.length]!;

const inHead = (x: number, y: number) => x >= 13 && x <= 34 && y >= 11 && y <= 31;

/** 1px dark rim on the outside of the hair, but never across the face. */
function rim(c: Canvas): void {
  const snap = c.c.map((r) => r.slice());
  for (let y = 0; y < 48; y++)
    for (let x = 0; x < 48; x++) {
      if (snap[y]![x] !== "." || inHead(x, y)) continue;
      if ([[1, 0], [-1, 0], [0, 1]].some(([dx, dy]) => (snap[y! + dy!]?.[x! + dx!] ?? ".") !== ".")) c.c[y]![x] = "H";
    }
}

function front(id: string, s: Front): Part {
  const c = new Canvas();
  const cx = s.cx ?? 24;
  const tops: Record<number, number> = {};
  for (let x = s.lo ?? 10; x <= (s.hi ?? 37); x++) {
    const dx = (x + 0.5 - cx) / s.rx;
    if (Math.abs(dx) >= 1) continue;
    const top = Math.round(s.cy - s.ry * Math.sqrt(1 - dx * dx) - (s.lift?.(x) ?? 0));
    const bot = Math.round(s.bot(x));
    if (bot <= top) continue;
    tops[x] = top;
    for (let y = top; y < bot; y++) c.set(x, y, "h");
    if (bot - top >= 3) c.set(x, bot - 1, "H");
  }
  if (!s.noShine) {
    for (let x = 15; x <= 21; x++) if (tops[x] !== undefined && c.get(x, tops[x]! + 2) === "h") c.set(x, tops[x]! + 2, "L");
    for (let x = 13; x <= 14; x++) if (tops[x] !== undefined && c.get(x, tops[x]! + 3) === "h") c.set(x, tops[x]! + 3, "L");
  }
  s.extra?.(c);
  for (const [x, y0, y1] of s.strands ?? []) for (let y = y0; y <= y1; y++) if (c.get(x, y) === "h") c.set(x, y, "H");
  for (const [x, y] of s.light ?? []) if (c.get(x, y) !== ".") c.set(x, y, "L");
  s.after?.(c);
  rim(c);
  return c.toPart(id, "hairFront");
}

function back(id: string, build: (c: Canvas) => void): Part {
  const c = new Canvas();
  build(c);
  rim(c);
  return c.toPart(id, "hairBack");
}

/** soft round tuft or curl: body, shade crescent bottom right, highlight top left */
function curl(c: Canvas, cx: number, cy: number, r: number): void {
  const cells: [number, number][] = [];
  for (let y = 0; y < 48; y++)
    for (let x = 0; x < 48; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > r) continue;
      cells.push([x, y]);
      c.set(x, y, d > r - 1.05 && dx + dy > -0.4 ? "H" : "h");
    }
  const hx = Math.round(cx - r * 0.35 - 0.5), hy = Math.round(cy - r * 0.45 - 0.5);
  if (c.get(hx, hy) === "h") c.set(hx, hy, "L");
  if (r > 3 && c.get(hx + 1, hy) === "h") c.set(hx + 1, hy, "L");
}

/** thick tapering stroke along a polyline */
function stroke(c: Canvas, pts: [number, number][], r0: number, r1: number, ch = "h"): void {
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, seg = t * (pts.length - 1), k = Math.min(Math.floor(seg), pts.length - 2), u = seg - k;
    const x = pts[k]![0] + (pts[k + 1]![0] - pts[k]![0]) * u, y = pts[k]![1] + (pts[k + 1]![1] - pts[k]![1]) * u;
    c.ell(x, y, r0 + (r1 - r0) * t, r0 + (r1 - r0) * t, ch);
  }
}

/** hair behind the head: base mass and a darker lower half so it reads as depth */
const nape = (c: Canvas) => {
  c.ell(24, 18, 14, 11.5, "h"); c.rect(14, 24, 33, 30, "h");
  c.rect(14, 28, 33, 31, "H");
};

const tie = (c: Canvas, x: number, y: number, w = 4, h = 3) => {
  c.rect(x, y, x + w - 1, y + h - 1, "x");
  c.set(x, y, "."); c.set(x + w - 1, y + h - 1, ".");
  c.set(x + 1, y, "w");
};

const specs: Record<HairStyle, { front: Front; back: (c: Canvas) => void }> = {
  short: {
    front: {
      cy: 15.5, rx: 14, ry: 10.5,
      bot: sym([17, 20, 21, 21, 21, 15, 16, 15, 14, 15, 16, 15, 14, 15]),
      strands: [[18, 11, 13], [22, 10, 12]],
      extra: (c) => { c.set(26, 4, "h"); c.set(27, 3, "h"); c.set(27, 4, "L"); c.set(28, 3, "H"); },
    },
    back: nape,
  },
  spiky: {
    front: {
      cy: 16.5, rx: 14, ry: 10,
      lift: jag([0, 2, 5, 2, 0, 1, 3, 1]),
      bot: (x) => (x < 15 || x > 32 ? [17, 20, 21, 21, 21][Math.min(Math.min(x, 47 - x) - 10, 4)]! : 13 + jag([3, 0, 2, 3, 0, 2])(x)),
      strands: [[17, 9, 12], [24, 8, 11], [30, 9, 12]],
    },
    back: nape,
  },
  curly: {
    front: {
      lo: 12, hi: 35, cy: 14, rx: 12, ry: 8, bot: () => 11, noShine: true,
      extra: (c) => {
        // crown ring, front curls over the forehead, side clusters falling past the ears
        for (const [x, y, r] of [[11, 24, 3.4], [37, 24, 3.4], [10.6, 18, 3.4], [37.4, 18, 3.4], [11.5, 30, 3.2], [36.5, 30, 3.2]] as const) curl(c, x, y, r);
        for (const [x, y, r] of [[12, 12, 3.8], [36, 12, 3.8], [16.5, 7, 3.8], [31.5, 7, 3.8], [24, 4.8, 4]] as const) curl(c, x, y, r);
        for (const [x, y, r] of [[16, 13, 2.9], [32, 13, 2.9], [20.5, 11.4, 2.9], [27.5, 11.4, 2.9]] as const) curl(c, x, y, r);
        curl(c, 24, 11.6, 2.4);
      },
    },
    back: (c) => {
      nape(c);
      for (const [x, y, r] of [[10, 26, 4], [38, 26, 4], [11, 32, 3.6], [37, 32, 3.6]] as const) curl(c, x, y, r);
    },
  },
  wavy: {
    // shoulder length, centre parted curtains, S shaped waves that flick outward
    front: {
      cy: 15.5, rx: 14, ry: 10.5,
      bot: (x) => {
        const m = Math.min(x, 47 - x);
        if (m <= 14) return 35 - (m % 2) * 1 + (m === 10 ? -3 : 0);
        return [0, 17, 16, 16, 15, 15, 14, 13, 13, 12][m - 14] ?? 12;
      },
      extra: (c) => {
        for (const sx of [1, -1]) {
          for (let y = 22; y <= 34; y++) {
            const off = Math.round(1.5 * Math.sin(y * 0.85));
            const xo = sx === 1 ? 10 - off : 37 + off;
            c.set(xo, y, "h"); c.set(sx === 1 ? xo + 1 : xo - 1, y, "h");
          }
          const tip = sx === 1 ? 8 : 39;
          c.set(tip, 35, "h"); c.set(tip + sx, 35, "h"); c.set(tip, 34, "h"); c.set(tip + sx, 36, "H"); c.set(tip, 36, "H");
        }
      },
      strands: [[12, 20, 32], [35, 20, 32]],
      light: [[12, 24], [11, 28], [13, 31], [36, 26], [35, 30]],
      after: (c) => { c.set(23, 4, "H"); c.rect(23, 5, 23, 11, "H"); },
    },
    back: (c) => { nape(c); c.rect(9, 20, 38, 34, "h"); c.rect(9, 30, 38, 34, "H"); },
  },
  long: {
    // straight and sleek: centre parted, long side locks down over the shoulders
    front: {
      cy: 15.5, rx: 14, ry: 10.5,
      bot: (x) => {
        const m = Math.min(x, 47 - x);
        if (m <= 14) return [38, 41, 43, 43, 42][m - 10]!;
        return [0, 17, 16, 16, 15, 15, 14, 13, 13, 12][m - 14] ?? 12;
      },
      strands: [[12, 18, 40], [14, 20, 38], [33, 18, 40], [35, 20, 38]],
      light: [[11, 24], [11, 25], [13, 27], [13, 28]],
      after: (c) => { c.rect(23, 5, 23, 11, "H"); },
    },
    back: (c) => { nape(c); c.rect(10, 20, 37, 44, "h"); c.rect(10, 32, 37, 44, "H"); },
  },
  bob: {
    // chin length, rounded inward at the ends, blunt bangs that stop above the brows
    front: {
      cy: 15.5, rx: 14.5, ry: 10.5,
      bot: sym([24, 28, 31, 31, 30, 16, 16, 16, 15, 16, 15, 16, 16, 16]),
      strands: [[12, 20, 29], [14, 20, 27], [19, 9, 12], [28, 9, 12]],
      light: [[11, 24], [12, 26]],
    },
    back: (c) => { nape(c); c.rect(10, 20, 37, 32, "h"); c.rect(10, 29, 37, 32, "H"); },
  },
  buns: {
    front: {
      cy: 15.5, rx: 14, ry: 10.5,
      bot: sym([17, 20, 21, 21, 21, 15, 16, 15, 15, 16, 15, 14, 14, 13]),
      after: (c) => { c.rect(23, 5, 23, 10, "H"); },
      extra: (c) => {
        curl(c, 12, 6, 4.6); curl(c, 36, 6, 4.6);
        for (const x of [12, 36]) { c.rect(x - 4, 9, x + 3, 10, "x"); c.set(x - 4, 9, "."); c.set(x + 3, 9, "."); c.set(x - 2, 9, "w"); }
        // a few flyaways
        c.set(7, 11, "H"); c.set(40, 11, "H");
      },
    },
    back: nape,
  },
  ponytail: {
    // slicked up and back: a high tie off the crown and a swinging tail
    front: {
      cy: 15.5, rx: 14, ry: 10.5,
      bot: sym([17, 19, 20, 20, 19, 14, 14, 14, 13, 13, 13, 13, 13, 13]),
      strands: [[16, 7, 11], [20, 6, 10]],
      extra: (c) => { tie(c, 29, 4, 4, 3); },
    },
    back: (c) => {
      nape(c);
      const path: [number, number][] = [[31, 4], [38, 2], [43, 9], [43, 19], [40, 27]];
      stroke(c, path, 3.6, 1.6);
      stroke(c, path.map(([x, y]) => [x + 1.4, y + 0.4] as [number, number]), 0.7, 0.4, "H"); // shade streak
      stroke(c, path.map(([x, y]) => [x - 1.3, y + 0.2] as [number, number]), 0.6, 0.4, "L"); // highlight streak
      c.set(40, 28, "h"); c.set(39, 29, "H"); c.set(40, 29, "h");
    },
  },
  sidePart: {
    // part on one side, a long sweep across the other; the left forehead and brow stay open
    front: {
      cy: 15.5, rx: 14, ry: 10.5,
      bot: (x) => {
        const m = Math.min(x, 47 - x);
        if (x < 15) return [17, 20, 21, 21, 21][x - 10] ?? 17;
        if (x >= 34) return [22, 22, 21, 19][x - 34]!;
        const t: Record<number, number> = { 15: 14, 16: 14, 17: 13, 18: 13, 19: 13, 20: 14, 21: 14, 22: 15, 23: 15, 24: 15, 25: 16, 26: 16, 27: 16, 28: 16, 29: 16, 30: 17, 31: 17, 32: 18, 33: 20 };
        void m;
        return t[x] ?? 15;
      },
      strands: [[22, 9, 13], [26, 8, 14], [30, 9, 15], [19, 4, 10]],
      light: [[24, 7], [25, 8], [27, 9]],
      after: (c) => { c.set(18, 5, "H"); c.set(18, 6, "H"); },
    },
    back: nape,
  },
  sidePonytail: {
    // low side tail over the shoulder, fringe swept to the other side
    front: {
      cy: 15.5, rx: 14, ry: 10.5,
      bot: (x) => {
        if (x < 15) return [17, 20, 22, 22, 22][x - 10] ?? 17;
        if (x >= 34) return [20, 19, 18, 17][x - 34]!;
        const t: Record<number, number> = { 15: 16, 16: 15, 17: 14, 18: 14, 19: 13, 20: 13, 21: 14, 22: 14, 23: 15, 24: 15, 25: 15, 26: 16, 27: 16, 28: 16, 29: 16, 30: 16, 31: 16, 32: 17, 33: 18 };
        return t[x] ?? 15;
      },
      strands: [[22, 8, 12], [27, 8, 13], [31, 9, 14]],
      extra: (c) => {
        // tail: tie at the left temple, falling over the shoulder
        c.rect(10, 16, 14, 19, "h");
        stroke(c, [[11.5, 20], [9.2, 27], [10.4, 34], [11, 40]], 3.5, 2);
        c.rect(9, 17, 14, 19, "x"); c.set(9, 17, "."); c.set(14, 19, "."); c.set(10, 17, "w");
        c.set(10, 41, "h"); c.set(11, 42, "H");
        for (let y = 22; y <= 38; y += 4) c.set(Math.round(10.2 - 0.4 * Math.sin(y)), y, "H");
        c.set(11, 24, "L"); c.set(10, 30, "L");
      },
    },
    back: (c) => { nape(c); },
  },
};

export const hairStyles = Object.keys(specs) as HairStyle[];
export const hairs: Record<HairStyle, { back: Part; front: Part }> = Object.fromEntries(
  hairStyles.map((k) => [k, { back: back(`hairBack.${k}`, specs[k].back), front: front(`hairFront.${k}`, specs[k].front) }]),
) as Record<HairStyle, { back: Part; front: Part }>;
