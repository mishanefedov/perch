// `npx perch-pet`: detect the framework, copy perch.js into the public folder and add one
// script tag to the right file. Plain code, no network, no model. Re-runs are safe, and
// `--remove` undoes it. Everything it changes is printed.
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, "..", "dist");
const BUNDLE = join(DIST, "perch.js");
const TUNER = join(DIST, "perch-tuner.js");
const SCHEMA = JSON.parse(readFileSync(join(HERE, "..", "schema.json"), "utf8"));
const SRC = "/perch.js";

const HELP = `perch-pet: add a pixel creature to your site

  npx perch-pet [dir]                 install into the project in dir (default: current folder)
  npx perch-pet set key=value ...     change options in the installed tag (npx perch-pet set stickiness=0.8)
  npx perch-pet set --reset           back to the defaults
  npx perch-pet creature file.json    use a creature drawn in the tuner (Download JSON)
  npx perch-pet detect                what it found here, as JSON (for scripts and agents)
  npx perch-pet options               every option with type and default, as JSON Schema
  npx perch-pet --remove              undo the install
  npx perch-pet --dry                 show what would change, change nothing

install flags:   --no-tuner (do not copy the localhost tuner panel)
options (also as flags on install): --creature octopus|blob|cat|ghost|robot|alien  --stickiness 0..1
  --speed 1  --scale 3  --goal ".selector"  --ignore ".selector"  --top-offset 64
  --no-mobile  --no-drag  --no-bounce
`;

const FLAG_VALUES = { creature: "creature", stickiness: "stickiness", speed: "speed", scale: "scale", goal: "goal", ignore: "ignore", "top-offset": "topOffset", "z-index": "zIndex" };
const FLAG_FALSE = { "--no-mobile": "mobile", "--no-drag": "draggable", "--no-bounce": "bounce" };
const kebab = (k) => k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());

/** Checks one option against schema.json and returns the string to store. */
export function checkOption(key, raw) {
  const def = SCHEMA.properties[key];
  if (!def) throw new Error(`unknown option "${key}". Known: ${Object.keys(SCHEMA.properties).join(", ")}`);
  const v = String(raw);
  if (def.type === "boolean") {
    if (!["true", "false", "1", "0"].includes(v)) throw new Error(`${key} must be true or false`);
    return v === "1" ? "true" : v === "0" ? "false" : v;
  }
  if (def.type === "number" || def.type === "integer") {
    const n = Number(v);
    if (v === "" || Number.isNaN(n)) throw new Error(`${key} must be a number`);
    if (def.type === "integer" && !Number.isInteger(n)) throw new Error(`${key} must be a whole number`);
    if (def.minimum !== undefined && n < def.minimum) throw new Error(`${key} must be at least ${def.minimum}`);
    if (def.maximum !== undefined && n > def.maximum) throw new Error(`${key} must be at most ${def.maximum}`);
    return String(n);
  }
  if (def.enum && !def.enum.includes(v)) throw new Error(`${key} must be one of: ${def.enum.join(", ")}`);
  return v;
}

export function parseArgs(argv) {
  const o = { cmd: "install", dir: ".", attrs: {}, set: {}, file: null, dry: false, remove: false, help: false, reset: false, tuner: true };
  const rest = [...argv];
  if (["set", "creature", "detect", "options"].includes(rest[0])) o.cmd = rest.shift();
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--dry") o.dry = true;
    else if (a === "--remove") o.remove = true;
    else if (a === "--reset") o.reset = true;
    else if (a === "--no-tuner") o.tuner = false;
    else if (a === "-h" || a === "--help") o.help = true;
    else if (FLAG_FALSE[a]) o.attrs["data-" + kebab(FLAG_FALSE[a])] = "false";
    else if (a.startsWith("--") && FLAG_VALUES[a.slice(2)]) {
      const v = rest[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      const key = FLAG_VALUES[a.slice(2)];
      o.attrs["data-" + kebab(key)] = checkOption(key, v);
    } else if (a.startsWith("-")) throw new Error(`unknown option ${a}`);
    else if (o.cmd === "set" && a.includes("=")) {
      const at = a.indexOf("=");
      const key = a.slice(0, at);
      o.set[key] = checkOption(key, a.slice(at + 1));
    } else if (o.cmd === "creature" && !o.file) o.file = a;
    else if (o.cmd === "set") throw new Error(`expected key=value, got "${a}"`);
    else o.dir = a;
  }
  return o;
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const attrString = (attrs) => Object.entries(attrs).map(([k, v]) => ` ${k}="${esc(v)}"`).join("");

function readJson(p) {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}

function first(root, paths) {
  return paths.map((p) => join(root, p)).find((p) => existsSync(p)) ?? null;
}

function walk(dir, depth = 3, out = []) {
  if (depth < 0 || !existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, depth - 1, out);
    else out.push(p);
  }
  return out;
}

/** Works out what kind of project this is and which file gets the tag. */
export function detect(root) {
  const pkg = readJson(join(root, "package.json")) ?? {};
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const ts = existsSync(join(root, "tsconfig.json"));

  if (deps.next) {
    const app = first(root, ["app/layout.tsx", "app/layout.jsx", "app/layout.js", "app/layout.ts", "src/app/layout.tsx", "src/app/layout.jsx", "src/app/layout.js", "src/app/layout.ts"]);
    if (app) return { kind: "next-app", file: app, publicDir: join(root, "public") };
    const doc = first(root, ["pages/_document.tsx", "pages/_document.jsx", "pages/_document.js", "src/pages/_document.tsx", "src/pages/_document.jsx", "src/pages/_document.js"]);
    const pagesDir = existsSync(join(root, "src/pages")) ? "src/pages" : "pages";
    if (doc) return { kind: "next-pages", file: doc, publicDir: join(root, "public") };
    if (existsSync(join(root, pagesDir))) return { kind: "next-pages-new", file: join(root, pagesDir, ts ? "_document.tsx" : "_document.js"), publicDir: join(root, "public"), ts };
  }
  if (deps.astro) {
    const layouts = walk(join(root, "src"), 3).filter((f) => f.endsWith(".astro") && /<\/body>/.test(readFileSync(f, "utf8")));
    const file = layouts.find((f) => /layouts?[\\/]/i.test(f)) ?? layouts[0];
    if (file) return { kind: "html", file, publicDir: join(root, "public"), inline: "is:inline " };
  }
  if (deps["@sveltejs/kit"] && existsSync(join(root, "src/app.html"))) return { kind: "html", file: join(root, "src/app.html"), publicDir: join(root, "static") };
  if (deps.nuxt) {
    const dir = existsSync(join(root, "app")) && !existsSync(join(root, "plugins")) ? "app/plugins" : "plugins";
    return { kind: "nuxt", file: join(root, dir, "perch.client.ts"), publicDir: join(root, "public") };
  }
  const html = first(root, ["index.html", "public/index.html", "src/index.html"]);
  if (html) {
    const vite = existsSync(join(root, "vite.config.ts")) || existsSync(join(root, "vite.config.js"));
    const publicDir = html.endsWith(join("public", "index.html")) || vite ? join(root, "public") : dirname(html);
    return { kind: "html", file: html, publicDir };
  }
  return null;
}

/** Puts `line` on its own line just before the first `closing` tag, indented one level deeper. */
function insertBeforeClosing(text, closing, line) {
  const m = new RegExp(closing, "i").exec(text);
  if (!m) return null;
  const lineStart = text.lastIndexOf("\n", m.index) + 1;
  const before = text.slice(lineStart, m.index);
  if (before.trim() === "") return text.slice(0, lineStart) + `${before}  ${line}\n` + text.slice(lineStart);
  return text.slice(0, m.index) + line + text.slice(m.index); // closing tag shares its line: stay inline
}

function addImportAfterDirectives(text, importLine) {
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length && (/^\s*(["']use (client|server)["'];?)\s*$/.test(lines[i]) || lines[i].trim() === "")) i++;
  // after the last top-level import, if there is one
  let last = -1;
  for (let j = 0; j < lines.length; j++) if (/^import\s.+from\s+["'].+["'];?\s*$/.test(lines[j])) last = j;
  const at = last >= 0 ? last + 1 : i;
  lines.splice(at, 0, importLine);
  return lines.join("\n");
}

const DOC_TS = (tag) => `// perch-pet: generated file. Safe to delete, or keep and edit.
import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <Main />
        <NextScript />
        ${tag}
      </body>
    </Html>
  );
}
`;

const NUXT_PLUGIN = (attrs) => `// perch-pet: loads the creature in the browser only
export default defineNuxtPlugin(() => {
  const s = document.createElement("script");
  s.src = "${SRC}";
  s.defer = true;
${Object.entries(attrs).map(([k, v]) => `  s.setAttribute(${JSON.stringify(k)}, ${JSON.stringify(v)});`).join("\n")}
  document.body.appendChild(s);
});
`;

/** The change to make to the layout file, as { path, before, after } or a note when it is already done. */
export function plan(found, attrs) {
  const a = attrString(attrs);
  const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : null);
  const text = read(found.file);
  if (found.kind === "nuxt") return { path: found.file, before: text, after: NUXT_PLUGIN(attrs), created: text === null };
  if (found.kind === "next-pages-new") return { path: found.file, before: null, after: DOC_TS(`<script src="${SRC}" defer${a}></script>`), created: true };
  if (text === null) throw new Error(`cannot read ${found.file}`);
  if (text.includes(SRC)) return { path: found.file, before: text, after: text, already: true };
  let after;
  if (found.kind === "next-app") {
    const tag = `<Script src="${SRC}" strategy="afterInteractive"${a} />`;
    after = insertBeforeClosing(text, "</body>", tag);
    if (after && !/from\s+["']next\/script["']/.test(text)) after = addImportAfterDirectives(after, `import Script from "next/script"; // perch-pet`);
  } else if (found.kind === "next-pages") {
    after = text.replace(/^([ \t]*)<NextScript\s*\/>/m, (m, i) => `${m}\n${i}<script src="${SRC}" defer${a}></script>`);
    if (after === text) after = null;
  } else {
    after = insertBeforeClosing(text, "</body>", `<script ${found.inline ?? ""}src="${SRC}" defer${a}></script>`);
  }
  if (!after) throw new Error(`could not find a place for the tag in ${found.file}`);
  return { path: found.file, before: text, after };
}

export function removal(found) {
  const text = existsSync(found.file) ? readFileSync(found.file, "utf8") : null;
  if (text === null) return null;
  if (found.kind === "nuxt") return text.includes("perch-pet") ? { path: found.file, delete: true } : null;
  if (text.includes("perch-pet: generated file")) return { path: found.file, delete: true };
  const tag = /[ \t]*<(?:Script|script)\b[^>]*\/perch\.js[^>]*?(?:\/>|>\s*<\/script>)[ \t]*\n?/g;
  const after = text.replace(tag, "").split("\n").filter((l) => !l.includes("// perch-pet")).join("\n");
  return after === text ? null : { path: found.file, before: text, after };
}

const TAG_RE = /<(?:Script|script)\b[^>]*\/perch\.js[^>]*?(?:\/>|>\s*<\/script>)/;
const unesc = (v) => v.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const camel = (k) => k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

/** The data-* options currently on the installed tag, as { stickiness: "0.8", ... }. */
export function readOptions(found) {
  if (!existsSync(found.file)) return null;
  const text = readFileSync(found.file, "utf8");
  if (found.kind === "nuxt") {
    if (!text.includes("perch-pet")) return null;
    const out = {};
    for (const m of text.matchAll(/s\.setAttribute\("data-([\w-]+)", ("(?:[^"\\]|\\.)*")\)/g)) out[camel(m[1])] = JSON.parse(m[2]);
    return out;
  }
  const tag = TAG_RE.exec(text)?.[0];
  if (!tag) return null;
  const out = {};
  for (const m of tag.matchAll(/\sdata-([\w-]+)="([^"]*)"/g)) out[camel(m[1])] = unesc(m[2]);
  return out;
}

/** Rewrites the data-* options on the installed tag. `changes` maps key -> string (set) or null (unset). */
export function writeOptions(found, changes, reset = false) {
  const now = reset ? {} : readOptions(found);
  if (now === null) throw new Error("perch-pet is not installed here. Run `npx perch-pet` first.");
  const next = { ...now };
  for (const [k, v] of Object.entries(changes)) { if (v === null) delete next[k]; else next[k] = v; }
  const attrs = Object.fromEntries(Object.entries(next).map(([k, v]) => ["data-" + kebab(k), v]));
  const text = readFileSync(found.file, "utf8");
  let after;
  if (found.kind === "nuxt") after = NUXT_PLUGIN(attrs);
  else {
    after = text.replace(TAG_RE, (tag) => tag.replace(/\sdata-[\w-]+="[^"]*"/g, "").replace(/(src="\/perch\.js")/, `$1${attrString(attrs)}`));
  }
  writeFileSync(found.file, after);
  return next;
}

export async function run(argv, cwd, out = console.log) {
  const o = parseArgs(argv);
  if (o.help) { out(HELP); return 0; }
  if (o.cmd === "options") { out(JSON.stringify(SCHEMA, null, 2)); return 0; }
  const root = join(cwd, o.dir);
  if (!existsSync(root)) throw new Error(`folder not found: ${root}`);
  const found = detect(root);
  const rel = (p) => relative(root, p) || ".";
  const manual = `Add this line before </body> yourself:\n  <script src="${SRC}" defer${attrString(o.attrs)}></script>\n(after copying node_modules/perch-pet/dist/perch.js to your public folder as perch.js)`;

  if (o.cmd === "detect") {
    const opts = found ? readOptions(found) : null;
    out(JSON.stringify({
      framework: found?.kind ?? null,
      layoutFile: found ? rel(found.file) : null,
      publicDir: found ? rel(found.publicDir) : null,
      installed: opts !== null,
      options: opts ?? {},
    }, null, 2));
    return found ? 0 : 1;
  }

  if (!found) {
    out("Could not detect a supported project (Next.js, Astro, SvelteKit, Nuxt, Vite or plain HTML) here.\n" + manual);
    return 1;
  }

  if (o.cmd === "set") {
    const changes = { ...o.set };
    if (!o.reset && !Object.keys(changes).length) throw new Error("nothing to set. Example: npx perch-pet set stickiness=0.8 creature=cat");
    if (o.dry) { out(`Would set: ${JSON.stringify(changes)}${o.reset ? " (after reset)" : ""} in ${rel(found.file)}`); return 0; }
    const next = writeOptions(found, changes, o.reset);
    out(`Updated ${rel(found.file)}. Options now: ${Object.keys(next).length ? JSON.stringify(next) : "defaults"}`);
    return 0;
  }

  if (o.cmd === "creature") {
    if (!o.file) throw new Error("usage: npx perch-pet creature ./creature.json");
    const src = join(cwd, o.file);
    if (!existsSync(src)) throw new Error(`file not found: ${src}`);
    let spec;
    try { spec = JSON.parse(readFileSync(src, "utf8")); } catch (e) { throw new Error(`${o.file} is not valid JSON`); }
    if (!existsSync(join(DIST, "esm", "index.js"))) throw new Error("dist/ is missing. Run `bun run build` first.");
    const { validate } = await import(join(DIST, "esm", "index.js"));
    const problems = validate(spec);
    if (problems.length) throw new Error(`${o.file} is not a valid creature:\n- ` + problems.join("\n- "));
    const dest = join(found.publicDir, "perch-creature.json");
    if (o.dry) { out(`Would copy ${o.file} to ${rel(dest)} and set creatureUrl`); return 0; }
    mkdirSync(found.publicDir, { recursive: true });
    writeFileSync(dest, JSON.stringify(spec, null, 2) + "\n");
    writeOptions(found, { creatureUrl: "/perch-creature.json", creature: null });
    out(`Copied creature "${spec.name}" to ${rel(dest)} and pointed the tag at it.`);
    return 0;
  }

  out(`Detected: ${found.kind.replace(/-/g, " ")}`);
  const files = ["perch.js", "perch-tuner.js", "perch-creature.json"].map((f) => join(found.publicDir, f));

  if (o.remove) {
    const r = removal(found);
    if (!o.dry) {
      if (r?.delete) rmSync(r.path);
      else if (r) writeFileSync(r.path, r.after);
      for (const f of files) if (existsSync(f)) rmSync(f);
    }
    out(`${o.dry ? "Would remove" : "Removed"}: ${files.map(rel).join(", ")}${r ? `, tag in ${rel(r.path)}` : ""}`);
    return 0;
  }

  if (!existsSync(BUNDLE)) throw new Error("dist/perch.js is missing. Run `bun run build` first.");
  const p = plan(found, o.attrs);
  if (!o.dry) {
    mkdirSync(found.publicDir, { recursive: true });
    copyFileSync(BUNDLE, files[0]);
    if (o.tuner && existsSync(TUNER)) copyFileSync(TUNER, files[1]);
    if (!p.already) {
      mkdirSync(dirname(p.path), { recursive: true });
      writeFileSync(p.path, p.after);
    }
  }
  out(`${o.dry ? "Would copy" : "Copied"}: ${rel(files[0])}${o.tuner ? ` and ${rel(files[1])} (the localhost tuner)` : ""}`);
  out(p.already ? `Already installed in ${rel(p.path)} (script refreshed)` : `${o.dry ? "Would edit" : p.created ? "Created" : "Edited"}: ${rel(p.path)}`);
  if (o.dry && !p.already) out("\n" + p.after.split("\n").filter((l) => l.includes("perch")).join("\n"));
  if (!o.dry) out("\nDone. Run your dev server: a gear button appears bottom-left on localhost to tune it. To undo: npx perch-pet --remove");
  return 0;
}
