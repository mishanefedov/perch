// `npx perch-pet`: detect the framework, copy perch.js into the public folder and add one
// script tag to the right file. Plain code, no network, no model. Re-runs are safe, and
// `--remove` undoes it. Everything it changes is printed.
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, "..", "dist");
const BUNDLE = join(DIST, "perch.js");
const TUNER = join(DIST, "perch-tuner.js");
const SCHEMA = JSON.parse(readFileSync(join(HERE, "..", "schema.json"), "utf8"));
const SRC = "/perch.js";

const HELP = `perch-pet: add a pixel creature to your site

  npx perch-pet [dir]                 find where it can go and install (asks if there is a choice)
  npx perch-pet --file app/layout.tsx install into this exact file (repeat --file for several)
  npx perch-pet detect                every place it found, as JSON (for scripts and agents)
  npx perch-pet set key=value ...     change options in the installed tag (npx perch-pet set stickiness=0.8)
  npx perch-pet set --reset           back to the defaults
  npx perch-pet creature file.json    use a creature drawn in the tuner (Download JSON)
  npx perch-pet options               every option with type and default, as JSON Schema
  npx perch-pet --remove              undo the install
  npx perch-pet --dry                 show what would change, change nothing

where it goes:
  --file <path>     the layout or HTML file that has your <body> (repeatable)
  --public <dir>    folder for perch.js (default: the framework's public folder)
  --yes, -y         do not ask: use the recommended place

install flags:   --no-tuner (do not copy the localhost tuner panel)
options (also as flags on install): --creature octopus|blob|cat|ghost|robot|alien  --stickiness 0..1
  --speed 1  --scale 3  --goal ".selector"  --ignore ".selector"  --top-offset 64
  --no-mobile  --no-drag  --no-bounce
`;

const FLAG_VALUES = { creature: "creature", stickiness: "stickiness", speed: "speed", scale: "scale", goal: "goal", ignore: "ignore", "top-offset": "topOffset", "z-index": "zIndex" };
const FLAG_FALSE = { "--no-mobile": "mobile", "--no-drag": "draggable", "--no-bounce": "bounce" };
const kebab = (k) => k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());

const ASK_ACTIONS = ["link", "copy", "scroll", "click", "event", "close"];
/** The same rules as validateAsk in src/ask.ts (a test keeps them in step). Returns the problems, or []. */
export function askProblems(a) {
  const errs = [];
  if (!a || typeof a !== "object" || Array.isArray(a)) return ["ask must be a JSON object like {\"text\":\"...\",\"buttons\":[...]}"];
  if (typeof a.text !== "string" || !a.text.trim()) errs.push("text is required");
  else if (a.text.length > 200) errs.push("text is longer than 200 characters");
  if (a.delay !== undefined && (typeof a.delay !== "number" || a.delay < 0 || a.delay > 60)) errs.push("delay must be a number from 0 to 60");
  if (a.once !== undefined && !["session", "forever", "always"].includes(a.once)) errs.push('once must be "session", "forever" or "always"');
  if (a.id !== undefined && typeof a.id !== "string") errs.push("id must be a string");
  if (a.buttons !== undefined) {
    if (!Array.isArray(a.buttons)) errs.push("buttons must be a list");
    else {
      if (a.buttons.length > 3) errs.push("at most 3 buttons");
      a.buttons.forEach((b, i) => {
        const n = `button ${i + 1}`;
        if (!b || typeof b !== "object") { errs.push(`${n} must be an object`); return; }
        if (typeof b.label !== "string" || !b.label.trim()) errs.push(`${n}: label is required`);
        else if (b.label.length > 40) errs.push(`${n}: label is longer than 40 characters`);
        const action = b.action ?? (b.value ? "link" : "close");
        if (!ASK_ACTIONS.includes(action)) { errs.push(`${n}: action must be one of ${ASK_ACTIONS.join(", ")}`); return; }
        if (action !== "close" && (typeof b.value !== "string" || !b.value.trim())) errs.push(`${n}: ${action} needs a value`);
        else if (typeof b.value === "string" && b.value.length > 500) errs.push(`${n}: value is longer than 500 characters`);
        else if (action === "link" && typeof b.value === "string") {
          let ok = false;
          try { ok = ["http:", "https:", "mailto:", "tel:"].includes(new URL(b.value, "https://example.com/").protocol); } catch { /* not a URL */ }
          if (!ok) errs.push(`${n}: link must be an http(s), mailto or tel URL, or a relative path`);
        }
      });
    }
  }
  return errs;
}

/** Checks one option against schema.json and returns the string to store. */
export function checkOption(key, raw) {
  const def = SCHEMA.properties[key];
  if (!def) throw new Error(`unknown option "${key}". Known: ${Object.keys(SCHEMA.properties).join(", ")}`);
  const v = String(raw);
  if (def.type === "object") {
    let parsed;
    try { parsed = JSON.parse(v); } catch { throw new Error(`${key} must be valid JSON, for example ask='{"text":"Want a demo?","buttons":[{"label":"Yes","action":"link","value":"/demo"}]}'`); }
    const problems = key === "ask" ? askProblems(parsed) : [];
    if (problems.length) throw new Error(`${key} is not valid:\n- ` + problems.join("\n- "));
    return JSON.stringify(parsed);
  }
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
  const o = { cmd: "install", dir: ".", attrs: {}, set: {}, creatureFile: null, files: [], public: null, yes: false, dry: false, remove: false, help: false, reset: false, tuner: true };
  const rest = [...argv];
  if (["set", "creature", "detect", "options"].includes(rest[0])) o.cmd = rest.shift();
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--dry") o.dry = true;
    else if (a === "--remove") o.remove = true;
    else if (a === "--reset") o.reset = true;
    else if (a === "--no-tuner") o.tuner = false;
    else if (a === "--yes" || a === "-y") o.yes = true;
    else if (a === "--file" || a === "--public") {
      const v = rest[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      if (a === "--file") o.files.push(v); else o.public = v;
    }
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
      const value = a.slice(at + 1);
      o.set[key] = value === "" ? null : checkOption(key, value); // `key=` removes the option
    } else if (o.cmd === "creature" && !o.creatureFile) o.creatureFile = a;
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

const SKIP = new Set(["node_modules", ".next", ".git", "dist", "build", "out", ".turbo", ".vercel", ".svelte-kit", ".nuxt", ".output", "coverage"]);
function walk(dir, depth = 3, out = []) {
  if (depth < 0 || !existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name) || e.name.startsWith(".")) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, depth - 1, out);
    else out.push(p);
  }
  return out;
}
const read = (p) => { try { return readFileSync(p, "utf8"); } catch { return ""; } };
const hasBody = (p) => /<\/body>/i.test(read(p));
const LAYOUT_RE = /(^|[\\/])layout\.(tsx|jsx|js|ts)$/;
const LABELS = {
  "next-app": "Next.js layout",
  "next-pages": "Next.js pages router (_document)",
  "next-pages-new": "Next.js pages router (creates _document)",
  nuxt: "Nuxt plugin (creates it)",
  html: "HTML page",
};

/** Every place in one project folder where the tag could go, best first. */
function projectCandidates(dir) {
  const pkg = readJson(join(dir, "package.json"));
  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
  const ts = existsSync(join(dir, "tsconfig.json"));
  const vite = !!deps.vite || existsSync(join(dir, "vite.config.ts")) || existsSync(join(dir, "vite.config.js"));
  const out = [];
  const add = (c) => out.push({ project: dir, ...c });

  if (deps.next) {
    for (const base of ["app", "src/app"]) {
      const appDir = join(dir, base);
      // a root layout is the one that renders <html> and <body>. Route groups can each have their own.
      for (const f of walk(appDir, 6).filter((f) => LAYOUT_RE.test(f) && hasBody(f))) {
        const top = dirname(f) === appDir;
        add({ kind: "next-app", file: f, publicDir: join(dir, "public"), score: top ? 100 : 85, label: top ? "Next.js root layout" : "Next.js layout (route group)" });
      }
    }
    const doc = first(dir, ["pages/_document.tsx", "pages/_document.jsx", "pages/_document.js", "src/pages/_document.tsx", "src/pages/_document.jsx", "src/pages/_document.js"]);
    const pagesBase = ["pages", "src/pages"].find((b) => existsSync(join(dir, b)));
    if (doc) add({ kind: "next-pages", file: doc, publicDir: join(dir, "public"), score: 90, label: LABELS["next-pages"] });
    else if (pagesBase && !out.length) add({ kind: "next-pages-new", file: join(dir, pagesBase, ts ? "_document.tsx" : "_document.js"), publicDir: join(dir, "public"), score: 50, label: LABELS["next-pages-new"] });
  }
  if (deps.astro) {
    for (const f of walk(join(dir, "src"), 4).filter((f) => f.endsWith(".astro") && hasBody(f))) {
      const layout = /layouts?[\\/]/i.test(f);
      add({ kind: "html", file: f, publicDir: join(dir, "public"), inline: "is:inline ", score: layout ? 90 : 60, label: layout ? "Astro layout" : "Astro page" });
    }
  }
  if (deps["@sveltejs/kit"] && existsSync(join(dir, "src/app.html"))) add({ kind: "html", file: join(dir, "src/app.html"), publicDir: join(dir, "static"), score: 100, label: "SvelteKit app.html" });
  if (deps.nuxt) {
    const sub = existsSync(join(dir, "app")) && !existsSync(join(dir, "plugins")) ? "app/plugins" : "plugins";
    add({ kind: "nuxt", file: join(dir, sub, "perch.client.ts"), publicDir: join(dir, "public"), score: 100, label: LABELS.nuxt });
  }
  if (!["next", "astro", "@sveltejs/kit", "nuxt"].some((d) => deps[d])) {
    const pages = [...new Set([...["index.html", "public/index.html", "src/index.html"].map((p) => join(dir, p)), ...walk(dir, 2).filter((f) => f.endsWith(".html"))])].filter((f) => existsSync(f) && hasBody(f));
    for (const f of pages) {
      const inPublic = f.startsWith(join(dir, "public") + "/");
      const score = f === join(dir, "index.html") ? 80 : f === join(dir, "public/index.html") ? 75 : f === join(dir, "src/index.html") ? 70 : 50;
      add({ kind: "html", file: f, publicDir: vite || inPublic ? join(dir, "public") : dirname(f), score, label: vite ? "Vite / HTML page" : "HTML page" });
    }
  }
  return out;
}

/** All candidate places under `root`, best first, with ids. Looks in `root` itself, and if it is not a
 *  project, in folders below it (monorepos, a site/ or web/ folder). */
export function findCandidates(root) {
  let list = projectCandidates(root);
  if (!list.length) {
    const dirs = [...new Set(walk(root, 3).filter((f) => basename(f) === "package.json").map(dirname))].filter((d) => d !== root);
    list = dirs.flatMap(projectCandidates);
  }
  list.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file));
  return list.map((c, i) => ({ ...c, id: i + 1, recommended: i === 0 }));
}

/** The one obvious choice, or null when a person (or --file) has to decide. */
export function autoPick(list) {
  if (list.length === 1) return list[0];
  if (new Set(list.map((c) => c.project)).size > 1) return null; // several projects (a monorepo): a person decides
  if (list.length > 1 && list[0].score >= 100 && list[1].score < 100) return list[0]; // one real root layout beats nested ones
  return null;
}

/** Same as before: the framework's one obvious file, or null. */
export function detect(root) {
  return autoPick(findCandidates(root));
}

/** Builds a candidate from a file the user named. */
export function candidateFromFile(file, publicOverride = null) {
  if (!existsSync(file) || !statSync(file).isFile()) throw new Error(`file not found: ${file}`);
  let project = dirname(file);
  for (let d = dirname(file); d !== dirname(d); d = dirname(d)) if (existsSync(join(d, "package.json"))) { project = d; break; }
  const deps = { ...readJson(join(project, "package.json"))?.dependencies, ...readJson(join(project, "package.json"))?.devDependencies };
  const name = basename(file);
  const vite = !!deps.vite || existsSync(join(project, "vite.config.ts")) || existsSync(join(project, "vite.config.js"));
  let c;
  if (deps.next && LAYOUT_RE.test(file)) c = { kind: "next-app", publicDir: join(project, "public") };
  else if (deps.next && /^_document\./.test(name)) c = { kind: "next-pages", publicDir: join(project, "public") };
  else if (deps.astro && name.endsWith(".astro")) c = { kind: "html", inline: "is:inline ", publicDir: join(project, "public") };
  else if (deps["@sveltejs/kit"] && name === "app.html") c = { kind: "html", publicDir: join(project, "static") };
  else c = { kind: "html", publicDir: vite || file.startsWith(join(project, "public") + "/") ? join(project, "public") : dirname(file) };
  if (c.kind !== "next-pages" && !hasBody(file)) throw new Error(`no </body> found in ${file}. Pick the file that renders your <body> tag (a root layout or an HTML page).`);
  return { project, file, score: 0, label: LABELS[c.kind], ...c, publicDir: publicOverride ?? c.publicDir };
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

function defaultIo() {
  return {
    isTTY: !!(process.stdin.isTTY && process.stdout.isTTY),
    ask(question) {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      return new Promise((res) => rl.question(question, (a) => { rl.close(); res(a); }));
    },
  };
}

const unquote = (s) => s.trim().replace(/^(['"])(.*)\1$/, "$2").replace(/\\ /g, " ");

/** Asks which place(s) to use. Accepts numbers ("2" or "1,2"), a file path, a folder path, or Enter for the first. */
async function askWhere(list, { cwd, out, io, publicDir }) {
  const show = (items) => {
    out(`\nFound ${items.length} places to add the creature:\n`);
    for (const c of items) out(`  ${c.id}) ${c.label.padEnd(34)} ${relative(cwd, c.file) || c.file}${c.recommended ? "   (recommended)" : ""}`);
    out("");
  };
  let items = list;
  show(items);
  for (let tries = 0; tries < 4; tries++) {
    const ans = unquote(await io.ask("Pick a number (several: 1,2), paste a file or folder path, or press Enter for 1: "));
    if (ans === "") return [items[0]];
    if (/^\d+(\s*,\s*\d+)*$/.test(ans)) {
      const ids = ans.split(",").map((n) => Number(n.trim()));
      const picked = ids.map((id) => items.find((c) => c.id === id));
      if (picked.every(Boolean)) return picked;
      out(`Choose numbers between 1 and ${items.length}.`);
      continue;
    }
    const p = resolve(cwd, ans);
    try {
      if (existsSync(p) && statSync(p).isDirectory()) {
        const found = findCandidates(p);
        if (!found.length) { out(`No supported project found in ${p}. Paste a file instead.`); continue; }
        const pick = autoPick(found);
        if (pick) return [pick];
        items = found; show(items);
        continue;
      }
      return [candidateFromFile(p, publicDir)];
    } catch (e) {
      out(e instanceof Error ? e.message : String(e));
    }
  }
  throw new Error("no valid choice. Run again with --file <path>.");
}

export async function run(argv, cwd, out = console.log, io = defaultIo()) {
  const o = parseArgs(argv);
  if (o.help) { out(HELP); return 0; }
  if (o.cmd === "options") { out(JSON.stringify(SCHEMA, null, 2)); return 0; }
  const root = resolve(cwd, o.dir);
  if (!existsSync(root)) throw new Error(`folder not found: ${root}`);
  const rel = (p) => relative(root, p) || ".";
  const here = (p) => relative(cwd, p) || ".";
  const publicOverride = o.public ? resolve(cwd, o.public) : null;
  const withPublic = (list) => (publicOverride ? list.map((c) => ({ ...c, publicDir: publicOverride })) : list);
  const manual = `Add this line before </body> yourself:\n  <script src="${SRC}" defer${attrString(o.attrs)}></script>\n(after copying node_modules/perch-pet/dist/perch.js to your public folder as perch.js)`;
  const explicit = o.files.map((f) => candidateFromFile(resolve(cwd, f), publicOverride));
  const list = explicit.length ? explicit.map((c, i) => ({ ...c, id: i + 1, recommended: i === 0 })) : withPublic(findCandidates(root));
  const installed = list.filter((c) => readOptions(c) !== null);

  if (o.cmd === "detect") {
    const pick = installed[0] ?? autoPick(list);
    const opts = installed[0] ? readOptions(installed[0]) : null;
    out(JSON.stringify({
      framework: pick?.kind ?? null,
      layoutFile: pick ? rel(pick.file) : null,
      publicDir: pick ? rel(pick.publicDir) : null,
      installed: installed.length > 0,
      options: opts ?? {},
      needsChoice: !pick && list.length > 1,
      candidates: list.map((c) => ({ id: c.id, kind: c.kind, label: c.label, file: rel(c.file), publicDir: rel(c.publicDir), project: rel(c.project), recommended: c.recommended, installed: installed.includes(c) })),
    }, null, 2));
    return list.length ? 0 : 1;
  }

  if (!list.length) {
    out("Could not find a place to add it. Looked for Next.js, Astro, SvelteKit, Nuxt, Vite and plain HTML in " + root + ".\nIf your layout is somewhere else, pass it: npx perch-pet --file path/to/layout-or-page\n\n" + manual);
    return 1;
  }

  // commands that work on what is already installed
  if (o.cmd === "set" || o.cmd === "creature" || o.remove) {
    const targets = installed.length || o.cmd !== "install" ? installed : [];
    if (!targets.length && !o.remove) throw new Error("perch-pet is not installed here. Run `npx perch-pet` first (or pass --file to say where).");
    const dirs = [...new Set((targets.length ? targets : [autoPick(list)].filter(Boolean)).map((c) => c.publicDir))];
    const files = (dir) => ["perch.js", "perch-tuner.js", "perch-creature.json"].map((f) => join(dir, f));

    if (o.remove) {
      if (!targets.length && !dirs.length) { out("Nothing to remove: perch-pet is not installed here."); return 0; }
      for (const c of targets) {
        const r = removal(c);
        if (!o.dry && r) { if (r.delete) rmSync(r.path); else writeFileSync(r.path, r.after); }
        out(`${o.dry ? "Would remove" : "Removed"} the tag in ${rel(c.file)}`);
      }
      for (const d of dirs) {
        if (!o.dry) for (const f of files(d)) if (existsSync(f)) rmSync(f);
        out(`${o.dry ? "Would remove" : "Removed"}: ${files(d).map(rel).join(", ")}`);
      }
      return 0;
    }

    if (o.cmd === "set") {
      const changes = { ...o.set };
      if (!o.reset && !Object.keys(changes).length) throw new Error("nothing to set. Example: npx perch-pet set stickiness=0.8 creature=cat");
      for (const c of targets) {
        if (o.dry) { out(`Would set: ${JSON.stringify(changes)}${o.reset ? " (after reset)" : ""} in ${rel(c.file)}`); continue; }
        const next = writeOptions(c, changes, o.reset);
        out(`Updated ${rel(c.file)}. Options now: ${Object.keys(next).length ? JSON.stringify(next) : "defaults"}`);
      }
      return 0;
    }

    // creature
    if (!o.creatureFile) throw new Error("usage: npx perch-pet creature ./creature.json");
    const src = resolve(cwd, o.creatureFile);
    if (!existsSync(src)) throw new Error(`file not found: ${src}`);
    let spec;
    try { spec = JSON.parse(readFileSync(src, "utf8")); } catch { throw new Error(`${o.creatureFile} is not valid JSON`); }
    if (!existsSync(join(DIST, "esm", "index.js"))) throw new Error("dist/ is missing. Run `bun run build` first.");
    const { validate } = await import(join(DIST, "esm", "index.js"));
    const problems = validate(spec);
    if (problems.length) throw new Error(`${o.creatureFile} is not a valid creature:\n- ` + problems.join("\n- "));
    for (const d of dirs) {
      const dest = join(d, "perch-creature.json");
      if (o.dry) { out(`Would copy ${o.creatureFile} to ${rel(dest)}`); continue; }
      mkdirSync(d, { recursive: true });
      writeFileSync(dest, JSON.stringify(spec, null, 2) + "\n");
      out(`Copied creature "${spec.name}" to ${rel(dest)}`);
    }
    if (!o.dry) for (const c of targets) writeOptions(c, { creatureUrl: "/perch-creature.json", creature: null });
    if (!o.dry) out("Pointed the tag at it.");
    return 0;
  }

  // ---- install: decide where ----
  let targets = explicit.length ? list : autoPick(list) ? [autoPick(list)] : null;
  if (!targets) {
    if (o.yes) targets = [list[0]];
    else if (io.isTTY) targets = await askWhere(list, { cwd, out, io, publicDir: publicOverride });
    else {
      out(`Found ${list.length} possible places and cannot tell which one is yours. Pick one (or several) and run again:\n`);
      for (const c of list) out(`  npx perch-pet --file ${JSON.stringify(here(c.file))}   # ${c.label}${c.recommended ? " (recommended)" : ""}`);
      out("\nOr add --yes to use the first one. `npx perch-pet detect` prints this list as JSON.");
      return 2;
    }
  } else if (!explicit.length && list.length > 1) {
    out(`Using the ${targets[0].label.toLowerCase()} (${here(targets[0].file)}) of ${list.length} places found.`);
  }

  if (!existsSync(BUNDLE)) throw new Error("dist/perch.js is missing. Run `bun run build` first.");
  const copied = new Set();
  for (const found of targets) {
    out(`${found.label}: ${here(found.file)}`);
    const p = plan(found, o.attrs);
    if (!o.dry) {
      if (!copied.has(found.publicDir)) {
        mkdirSync(found.publicDir, { recursive: true });
        copyFileSync(BUNDLE, join(found.publicDir, "perch.js"));
        if (o.tuner && existsSync(TUNER)) copyFileSync(TUNER, join(found.publicDir, "perch-tuner.js"));
        copied.add(found.publicDir);
      }
      if (!p.already) {
        mkdirSync(dirname(p.path), { recursive: true });
        writeFileSync(p.path, p.after);
      }
    }
    out(`  ${o.dry ? "Would copy" : "Copied"}: ${rel(join(found.publicDir, "perch.js"))}${o.tuner ? ` and perch-tuner.js (the localhost tuner)` : ""}`);
    out(`  ${p.already ? "Already installed (script refreshed)" : `${o.dry ? "Would edit" : p.created ? "Created" : "Edited"}: ${rel(p.path)}`}`);
    if (o.dry && !p.already) out("\n" + p.after.split("\n").filter((l) => l.includes("perch")).join("\n"));
  }
  if (!o.dry) out("\nDone. Run your dev server: a gear button appears bottom-left on localhost to tune it. To undo: npx perch-pet --remove");
  if (!o.dry) out("\nDo you like it? Star it: github.com/mishanefedov/perch");
  return 0;
}
