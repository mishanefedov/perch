// Builds the browser extension into extension-dist/ and zips it for the Chrome Web Store.
//   bun run extension:build
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { zipSync } from "fflate";

const OUT = "extension-dist";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const opts = { target: "browser" as const, format: "iife" as const, minify: true, outdir: OUT };
const builds = [
  Bun.build({ ...opts, entrypoints: ["src/entry-ext.ts"], naming: "perch-ext.js" }),
  Bun.build({ ...opts, entrypoints: ["src/tuner-entry.ts"], naming: "perch-tuner.js" }),
  Bun.build({ ...opts, entrypoints: ["extension/src/bootstrap.ts"], naming: "bootstrap.js" }),
  Bun.build({ ...opts, entrypoints: ["extension/src/background.ts"], naming: "background.js" }),
  Bun.build({ ...opts, entrypoints: ["extension/src/popup.ts"], naming: "popup.js" }),
];
for (const r of await Promise.all(builds)) if (!r.success) { console.error(r.logs.join("\n")); process.exit(1); }

for (const f of ["manifest.json", "popup.html", "popup.css"]) cpSync(join("extension", f), join(OUT, f));
if (!existsSync("extension/icons/icon-128.png")) { console.error("extension/icons is missing: run node scripts/make-images.mjs"); process.exit(1); }
cpSync("extension/icons", join(OUT, "icons"), { recursive: true });

// zip with a fixed timestamp so the same sources always give the same file
const files: Record<string, Uint8Array> = {};
const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else files[relative(OUT, p)] = new Uint8Array(readFileSync(p)); } };
walk(OUT);
const zip = zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, [v, { mtime: new Date("2026-01-01T00:00:00Z") }]])), { level: 9 });
writeFileSync(join(OUT, "perch-extension.zip"), zip);

const version = (JSON.parse(readFileSync("extension/manifest.json", "utf8")) as { version: string }).version;
console.log(`extension-dist/ v${version}: ${Object.keys(files).length} files, perch-extension.zip ${(zip.byteLength / 1024).toFixed(1)} kB`);
