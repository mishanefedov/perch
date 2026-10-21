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

// ---------- hero: the octopus hopping across a page ----------
function hero() {
  const px = 4;
  const s = sprite(CREATURES.octopus, px, "o");
  const W = 960, H = 300;
  const bars = [
    { x: 90, y: 86, w: 520, h: 30, c: "#64748b", o: 0.55 },   // heading
    { x: 90, y: 150, w: 400, h: 10, c: "#64748b", o: 0.3 },   // paragraph
    { x: 90, y: 172, w: 340, h: 10, c: "#64748b", o: 0.3 },
    { x: 640, y: 120, w: 230, h: 110, c: "#64748b", o: 0.14, r: 14 }, // card
  ];
  const cta = { x: 90, y: 226, w: 190, h: 44 };
  // stand points: [x centre, y of the floor]
  const spots: [number, number][] = [[330, 86], [250, 150], [760, 120], [185, 226]];
  const stand = 1.5, jump = 0.8, total = spots.length * (stand + jump);
  const kx: string[] = [], ky: string[] = [];
  const pct = (t: number) => ((t / total) * 100).toFixed(2) + "%";
  const pos = (p: [number, number]) => [p[0] - s.w / 2, p[1] - s.foot];
  let t = 0;
  for (let i = 0; i < spots.length; i++) {
    const a = spots[i], b = spots[(i + 1) % spots.length];
    const [ax, ay] = pos(a), [bx, by] = pos(b);
    const apex = Math.min(ay, by) - 46;
    kx.push(`${pct(t)}{transform:translateX(${ax}px)}`);
    ky.push(`${pct(t)}{transform:translateY(${ay}px);animation-timing-function:cubic-bezier(.2,.7,.4,1)}`);
    t += stand;
    kx.push(`${pct(t)}{transform:translateX(${ax}px)}`); // stays until it jumps
    ky.push(`${pct(t)}{transform:translateY(${ay}px);animation-timing-function:cubic-bezier(.2,.7,.4,1)}`);
    ky.push(`${pct(t + jump / 2)}{transform:translateY(${apex}px);animation-timing-function:cubic-bezier(.6,0,.8,.3)}`);
    t += jump;
    kx.push(`${pct(t)}{transform:translateX(${bx}px);animation-timing-function:linear}`);
    ky.push(`${pct(t)}{transform:translateY(${by}px)}`);
  }
  const css = `${BASE_CSS}${s.css}
@keyframes mx{${kx.join("")}}@keyframes my{${ky.join("")}}
.mx{animation:mx ${total}s linear infinite}.my{animation:my ${total}s linear infinite}
.bar{fill:#64748b}.btn{fill:#2563eb}.btnt{fill:#fff;font:600 17px system-ui,-apple-system,Segoe UI,sans-serif}`;
  const bar = (b: { x: number; y: number; w: number; h: number; o: number; r?: number }) => `<rect class="bar" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${b.r ?? b.h / 2}" opacity="${b.o}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="A pixel octopus hopping between a heading, text lines, a card and a button on a web page">
<style>${css}</style>
${bars.map(bar).join("")}
<rect class="btn" x="${cta.x}" y="${cta.y}" width="${cta.w}" height="${cta.h}" rx="10"/><text class="btnt" x="${cta.x + cta.w / 2}" y="${cta.y + 28}" text-anchor="middle">Join the waitlist</text>
<g class="mx"><g class="my">${s.svg}</g></g>
</svg>`;
}

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
writeFileSync("assets/hero.svg", hero());
writeFileSync("assets/creatures.svg", lineup());
console.log("assets/hero.svg, assets/creatures.svg");
