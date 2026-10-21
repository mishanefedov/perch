import { mkdirSync, rmSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });

const common = { target: "browser" as const, outdir: "dist" };
const jobs = [
  // script-tag builds
  Bun.build({ ...common, entrypoints: ["src/entry-iife.ts"], format: "iife", minify: true, naming: "perch.js" }),
  Bun.build({ ...common, entrypoints: ["src/tuner-entry.ts"], format: "iife", minify: true, naming: "perch-tuner.js" }),
  // bundler builds: `import "perch-pet"` and `import "perch-pet/auto"`, tuner split into its own chunk
  Bun.build({ ...common, entrypoints: ["src/index.ts", "src/auto.ts"], format: "esm", splitting: true, minify: false, outdir: "dist/esm" }),
];
for (const r of await Promise.all(jobs)) if (!r.success) { console.error(r.logs.join("\n")); process.exit(1); }

const proc = Bun.spawnSync(["bunx", "tsc", "-p", "tsconfig.build.json"]);
if (proc.exitCode !== 0) { console.error(proc.stdout.toString() + proc.stderr.toString()); process.exit(1); }

const kb = async (f: string) => ((await Bun.file(f).arrayBuffer()).byteLength / 1024).toFixed(1);
const gz = async (f: string) => (Bun.gzipSync(new Uint8Array(await Bun.file(f).arrayBuffer())).byteLength / 1024).toFixed(1);
console.log(`dist/perch.js        ${await kb("dist/perch.js")} kB (${await gz("dist/perch.js")} kB gzip)`);
console.log(`dist/perch-tuner.js  ${await kb("dist/perch-tuner.js")} kB (${await gz("dist/perch-tuner.js")} kB gzip), dev only`);
