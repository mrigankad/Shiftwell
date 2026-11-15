import { fmtHours, SAVED_HOURS_PER_HANDOFF } from "../usage/metrics";
import { headline, plural, type Recap } from "./summary";

/** Card colours come from the fixed welcome tokens in index.css, so the PNG looks the same in both themes. */
const token = (name: string, fallback: string) => {
  try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback; } catch { return fallback; }
};
const alpha = (hex: string, a: number) => (/^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${Math.round(a * 255).toString(16).padStart(2, "0")}` : hex);
const palette = () => ({
  card: token("--color-welcome-card", "black"), tile: token("--color-welcome-tile", "black"), white: token("--color-welcome-ink", "white"),
  muted: token("--color-welcome-muted", "gray"), soft: token("--color-welcome-body", "silver"), accent: token("--color-welcome-accent", "orange"),
  shift: token("--color-shift", "orangered"), hero: token("--color-welcome", "black"),
  worker: alpha(token("--color-welcome-accent", "orange"), 0.12),
});
const FONT = '"Plus Jakarta Sans Variable", "Plus Jakarta Sans", system-ui, sans-serif';
export const CARD_W = 560;
export const CARD_H = 640;
const SCALE = 2;
const HERO_H = 200;

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error(`Could not load ${src}`));
    i.src = src;
  });
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

type Seg = { text: string; color: string };

/** Wrap coloured segments to a width. Words keep their segment colour. */
function wrap(ctx: CanvasRenderingContext2D, segs: Seg[], maxW: number): Seg[][] {
  const words: Seg[] = [];
  for (const s of segs) for (const w of s.text.split(/(\s+)/)) if (w) words.push({ text: w, color: s.color });
  const lines: Seg[][] = [[]];
  let width = 0;
  for (const w of words) {
    const wd = ctx.measureText(w.text).width;
    const isSpace = /^\s+$/.test(w.text);
    if (width + wd > maxW && !isSpace && lines[lines.length - 1].length) {
      lines.push([]); width = 0;
    }
    if (isSpace && width === 0) continue;
    lines[lines.length - 1].push(w); width += wd;
  }
  return lines;
}

export async function renderRecapCard(r: Recap, crewSrc = "/crew.png"): Promise<HTMLCanvasElement> {
  const C = palette();
  try { await Promise.all([document.fonts.load(`700 36px ${FONT}`), document.fonts.load(`400 13px ${FONT}`)]); } catch { /* fall back to system font */ }
  const crew = await loadImage(crewSrc).catch(() => null);

  const cv = document.createElement("canvas");
  cv.width = CARD_W * SCALE; cv.height = CARD_H * SCALE;
  const ctx = cv.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = "alphabetic";

  // Card body with rounded corners.
  ctx.save();
  rr(ctx, 0, 0, CARD_W, CARD_H, 24); ctx.clip();
  ctx.fillStyle = C.card; ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Hero: the pixel crew, cover-fitted and centred, drawn without smoothing to keep the pixels crisp.
  ctx.fillStyle = C.hero; ctx.fillRect(0, 0, CARD_W, HERO_H);
  if (crew) {
    const s = Math.max(CARD_W / crew.width, HERO_H / crew.height);
    const dw = crew.width * s, dh = crew.height * s;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(crew, (CARD_W - dw) / 2, (HERO_H - dh) / 2, dw, dh);
    ctx.imageSmoothingEnabled = true;
  }
  ctx.restore();

  const px = 32;
  let y = HERO_H + 28;

  // Logo row.
  ctx.save();
  ctx.translate(px, y); ctx.scale(20 / 48, 20 / 48);
  ctx.fillStyle = C.white; ctx.beginPath(); [[14, 7], [46, 7], [40, 21], [8, 21]].forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.shift; ctx.beginPath(); [[8, 27], [40, 27], [34, 41], [2, 41]].forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = C.white; ctx.font = `700 17px ${FONT}`; ctx.textAlign = "left";
  ctx.fillText("shiftwell", px + 28, y + 16);
  ctx.fillStyle = C.muted; ctx.font = `400 13px ${FONT}`; ctx.textAlign = "right";
  ctx.fillText(`Week of ${r.weekLabel}`, CARD_W - px, y + 15);
  ctx.textAlign = "left";
  y += 20 + 20;

  // Headline, wrapped, with the accent phrase tinted.
  const h = headline(r);
  ctx.font = `700 34px ${FONT}`;
  const lines = wrap(ctx, [{ text: h.before, color: C.white }, { text: h.accent, color: C.accent }, { text: h.after, color: C.white }], CARD_W - px * 2).slice(0, 3);
  const lh = 40;
  lines.forEach((line, li) => {
    let x = px;
    for (const seg of line) { ctx.fillStyle = seg.color; ctx.fillText(seg.text, x, y + 30 + li * lh); x += ctx.measureText(seg.text).width; }
  });
  y += lines.length * lh + 20;

  // Three stat tiles.
  const tiles: [string, string][] = [
    [String(r.runsFinished), "runs finished"],
    [String(r.handoffs), "handoffs"],
    [r.handoffs > 0 ? `~${fmtHours(r.hoursSaved)}` : "0m", "saved, estimate"],
  ];
  const gap = 12, tw = (CARD_W - px * 2 - gap * 2) / 3, th = 78;
  tiles.forEach(([big, small], i) => {
    const x = px + i * (tw + gap);
    ctx.fillStyle = C.tile; rr(ctx, x, y, tw, th, 12); ctx.fill();
    ctx.fillStyle = C.white; ctx.font = `700 26px ${FONT}`; ctx.fillText(big, x + 14, y + 14 + 26);
    ctx.fillStyle = C.muted; ctx.font = `400 13px ${FONT}`; ctx.fillText(small, x + 14, y + 14 + 26 + 18);
  });
  y += th + 12;

  // Work row: commits, files, busiest hour.
  ctx.fillStyle = C.soft; ctx.font = `400 13px ${FONT}`;
  const work = `${plural(r.commits, "commit")} across ${plural(r.files, "file")}`;
  ctx.fillText(work, px, y + 14);
  const busy = r.busiest ? `Busiest hour: ${r.busiest.text}` : "Busiest hour: not enough readings";
  ctx.textAlign = "right"; ctx.fillText(busy, CARD_W - px, y + 14); ctx.textAlign = "left";
  y += 34;

  // Worker of the week banner.
  const bh = 68;
  ctx.fillStyle = C.worker; rr(ctx, px, y, CARD_W - px * 2, bh, 12); ctx.fill();
  const hasTop = !!r.top;
  ctx.fillStyle = C.white; ctx.font = `700 15px ${FONT}`;
  ctx.fillText(hasTop ? `Carried the most: ${r.top!.name}` : "Carried the most: nobody yet", px + 16, y + 28);
  ctx.fillStyle = C.soft; ctx.font = `400 13px ${FONT}`;
  ctx.fillText(hasTop ? `${plural(r.top!.runs, "run")}, ${plural(r.top!.commits, "commit")}, ${plural(r.top!.files, "file")}` : "Start a run and the crew shows up here", px + 16, y + 48);

  // Footnote about the estimate.
  ctx.fillStyle = C.muted; ctx.font = `400 11px ${FONT}`;
  ctx.fillText(`Saved time is an estimate: ${SAVED_HOURS_PER_HANDOFF}h of waiting avoided per handoff.`, px, CARD_H - 22);
  return cv;
}

export function canvasToBlob(cv: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("Could not encode PNG"))), "image/png"));
}
