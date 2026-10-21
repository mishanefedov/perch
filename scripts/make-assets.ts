// Generates the animated SVGs used in the README from the creature data.
//   bun run assets
import { mkdirSync, writeFileSync } from "node:fs";
import { CREATURES } from "../src/config";
import { buildGrid, type CreatureSpec, type Pose } from "../src/creature";

const pose = (spec: CreatureSpec, o: Partial<Pose>): Pose => ({ left: "rest", right: "rest", face: "look", legs: 0, px: 0, py: 0, flip: false, w: spec.cols, h: spec.rows, ...o });

/** one <rect> per horizontal run of the same colour */
function rects(grid: (string | null)[][], px: number): string {
  const out: string[] = [];
  grid.forEach((row, y) => {
    let run: { c: string; x: number } | null = null;
    for (let x = 0; x <= row.length; x++) {
      const c = x < row.length ? row[x] : null;
      if (run && c !== run.c) { out.push(`<rect x="${run.x * px}" y="${y * px}" width="${(x - run.x) * px}" height="${px + 0.6}" fill="${run.c}"/>`); run = null; }
      if (c && !run) run = { c, x };
    }
  });
  return out.join("");
}

/** the creature as two leg frames plus a blink overlay, ready to animate */
function sprite(spec: CreatureSpec, px: number, id: string) {
  const a = rects(buildGrid(spec, pose(spec, { legs: 0 })), px);
  const b = rects(buildGrid(spec, pose(spec, { legs: 1 })), px);
  const main = spec.palette.R ?? spec.palette[Object.keys(spec.palette)[0]];
  const blink = [spec.eyes.left, spec.eyes.right].map(([ex, ey]) => `<rect x="${ex * px}" y="${ey * px}" width="${4 * px}" height="${4 * px}" fill="${main}"/><rect x="${ex * px}" y="${(ey + 2) * px}" width="${4 * px}" height="${px}" fill="${spec.eyeColors.pupil}"/>`).join("");
  const footY = (spec.offset[1] + spec.body.length + spec.legs[0].length) * px;
  return {
    w: spec.cols * px, foot: footY,
    svg: `<g class="${id}-a">${a}</g><g class="${id}-b">${b}</g><g class="${id}-blink">${blink}</g>`,
    css: `.${id}-a{animation:flipA .5s steps(1) infinite}.${id}-b{animation:flipB .5s steps(1) infinite}.${id}-blink{animation:blink 4s steps(1) infinite}`,
  };
}

const BASE_CSS = `@keyframes flipA{0%{opacity:1}50%{opacity:0}}@keyframes flipB{0%{opacity:0}50%{opacity:1}}@keyframes blink{0%,94%{opacity:0}95%,98%{opacity:1}99%,100%{opacity:0}}`;

// ---------- lineup: every creature ----------
function lineup() {
  const px = 5, names = Object.keys(CREATURES);
  const gap = 20, cell = 28 * px + gap;
  const W = names.length * cell + gap, H = 16 * px + 90;
  let css = BASE_CSS + `@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}.name{fill:#64748b;font:600 15px ui-monospace,Menlo,monospace;text-anchor:middle}.line{fill:#64748b;opacity:.35}`;
  const maxFoot = Math.max(...names.map((n) => sprite(CREATURES[n], px, "x").foot));
  const items = names.map((n, i) => {
    const s = sprite(CREATURES[n], px, "c" + i);
    const lift = maxFoot - s.foot; // line the feet up on one floor
    css += s.css + `.b${i}{animation:bob 1.6s ease-in-out ${(i * 0.23).toFixed(2)}s infinite}.c${i}-blink{animation-delay:-${(i * 0.7).toFixed(1)}s}`;
    const x = gap + i * cell;
    return `<g transform="translate(${x},${20 + lift})"><g class="b${i}">${s.svg}</g></g><rect class="line" x="${x - 4}" y="${20 + maxFoot + 6}" width="${s.w + 8}" height="5" rx="2.5"/><text class="name" x="${x + s.w / 2}" y="${20 + maxFoot + 38}">${n}</text>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="The six built-in creatures: ${names.join(", ")}"><style>${css}</style>${items.join("")}</svg>`;
}

/** the default octopus, cropped tight: used as the logo and favicon */
function logo() {
  const spec = CREATURES.octopus;
  const grid = buildGrid(spec, pose(spec, { legs: 0 }));
  let x0 = 99, x1 = -1, y0 = 99, y1 = -1;
  grid.forEach((row, y) => row.forEach((c, x) => { if (c) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }));
  const cropped = grid.slice(y0, y1 + 1).map((r) => r.slice(x0, x1 + 1));
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  return `<svg xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" viewBox="0 0 ${w} ${h}" width="${w * 8}" height="${h * 8}" role="img" aria-label="Perch octopus logo">${rects(cropped, 1).replace(/height="1.6"/g, 'height="1.05"')}</svg>`;
}

mkdirSync("site/static", { recursive: true });
writeFileSync("site/static/logo.svg", logo());
writeFileSync("site/static/favicon.svg", logo());
writeFileSync("assets/creatures.svg", lineup());
console.log("assets/creatures.svg, site/static/logo.svg");
