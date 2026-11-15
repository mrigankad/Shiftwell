import { GRID, type LayerName, type Part } from "../types.js";

/** Build-time painter. Output is always plain pixel-row strings (the Part type). */
export class Canvas {
  c: string[][] = Array.from({ length: GRID }, () => Array<string>(GRID).fill("."));

  set(x: number, y: number, ch: string): void {
    if (x >= 0 && y >= 0 && x < GRID && y < GRID) this.c[y]![x] = ch;
  }
  get(x: number, y: number): string {
    return x >= 0 && y >= 0 && x < GRID && y < GRID ? this.c[y]![x]! : ".";
  }
  rect(x0: number, y0: number, x1: number, y1: number, ch: string): void {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, ch);
  }
  ell(cx: number, cy: number, rx: number, ry: number, ch: string): void {
    for (let y = 0; y < GRID; y++)
      for (let x = 0; x < GRID; x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, ch);
      }
  }
  /** carve with "." */
  cut(cx: number, cy: number, rx: number, ry: number): void { this.ell(cx, cy, rx, ry, "."); }
  /** 1px outline on transparent pixels touching filled ones (4-neighbour). */
  outline(ch: string): void {
    const snap = this.c.map((r) => r.slice());
    for (let y = 0; y < GRID; y++)
      for (let x = 0; x < GRID; x++) {
        if (snap[y]![x] !== ".") continue;
        const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (snap[y! + dy!]?.[x! + dx!] ?? ".") !== ".");
        if (n) this.c[y]![x] = ch;
      }
  }
  toPart(id: string, layer: LayerName): Part {
    let x0 = GRID, y0 = GRID, x1 = -1, y1 = -1;
    for (let y = 0; y < GRID; y++)
      for (let x = 0; x < GRID; x++)
        if (this.c[y]![x] !== ".") { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    if (x1 < 0) return { id, layer, x: 0, y: 0, rows: [] };
    const rows: string[] = [];
    for (let y = y0; y <= y1; y++) rows.push(this.c[y]!.slice(x0, x1 + 1).join(""));
    return { id, layer, x: x0, y: y0, rows };
  }
}

/** Mirror a left half across x = 24 (the grid centre). Left half starts at x0 and ends at x = 23. */
export const part = (id: string, layer: LayerName, x: number, y: number, rows: string[]): Part => ({ id, layer, x, y, rows });

export const mirrorRows = (left: string[]): string[] => left.map((r) => r + [...r].reverse().join(""));
