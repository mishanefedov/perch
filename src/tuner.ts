import type { PerchApi } from "./api";
import type { PerchOptions } from "./config";
import { validate, type CreatureSpec } from "./creature";
import { createEditor, EDITOR_CSS, type EditorHandle } from "./editor";
import { countMatches, selectorFor } from "./selector";

// The tuner: a small gear button on localhost. Change values, watch the creature react, see
// which elements it treats as floors, then copy one command that saves the result.
// It lives in a shadow root so it cannot clash with your CSS, and it is never shown to visitors
// on a live site (the main script only loads it on localhost or with ?perch=tune).

const KEYS = ["creature", "stickiness", "speed", "scale", "goal", "ignore", "platforms", "topOffset", "mobile", "draggable", "bounce", "zIndex"] as const;
type Key = (typeof KEYS)[number];

const CSS_TEXT = `
:host { all: initial; }
* { box-sizing: border-box; font: 13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; }
.gear { position: fixed; left: 16px; bottom: 16px; width: 40px; height: 40px; border-radius: 50%; border: 1px solid #0003; background: #111; color: #fff; cursor: pointer; display: grid; place-items: center; box-shadow: 0 4px 16px #0004; }
.gear:hover { background: #333; }
.gear svg { width: 20px; height: 20px; }
.panel { position: fixed; left: 16px; bottom: 16px; width: 320px; max-height: calc(100vh - 32px); overflow: auto; background: #fff; color: #111; border: 1px solid #0002; border-radius: 12px; box-shadow: 0 12px 40px #0004; padding: 14px; }
.panel[hidden], .gear[hidden] { display: none; }
header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
h2 { font-size: 14px; margin: 0; }
.x { border: 0; background: none; font-size: 20px; line-height: 1; cursor: pointer; color: #555; padding: 2px 6px; border-radius: 6px; }
.x:hover { background: #eee; }
.row { display: grid; grid-template-columns: 92px 1fr 36px; align-items: center; gap: 8px; margin: 8px 0; }
.row.wide { grid-template-columns: 92px 1fr auto; }
.row label { color: #444; }
.val { text-align: right; color: #666; font-variant-numeric: tabular-nums; }
input[type=range] { width: 100%; }
select, input[type=text], input[type=number] { width: 100%; padding: 5px 7px; border: 1px solid #ccc; border-radius: 6px; background: #fff; color: #111; }
.checks { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 10px; margin: 10px 0; }
.checks label { display: flex; gap: 6px; align-items: center; color: #222; }
button.b { padding: 5px 9px; border: 1px solid #bbb; border-radius: 6px; background: #f6f6f6; color: #111; cursor: pointer; }
button.b:hover { background: #eaeaea; }
button.b.primary { background: #111; color: #fff; border-color: #111; }
button.b.primary:hover { background: #333; }
button.on { background: #dbeafe; border-color: #3b82f6; }
.out { width: 100%; height: 64px; resize: vertical; padding: 7px; border: 1px solid #ccc; border-radius: 6px; font: 12px/1.4 ui-monospace, Menlo, monospace; background: #fafafa; color: #111; }
.btns { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.hint { color: #666; font-size: 12px; margin: 8px 0 0; }
.sep { height: 1px; background: #0001; margin: 12px 0; }
.pick { position: fixed; inset: 0; cursor: crosshair; z-index: 1; }
.box { position: fixed; pointer-events: none; border: 2px solid #f59e0b; background: #f59e0b22; border-radius: 3px; z-index: 2; }
.tip { position: fixed; left: 50%; top: 14px; transform: translateX(-50%); background: #111; color: #fff; padding: 6px 12px; border-radius: 8px; z-index: 3; }
.copied { color: #15803d; }
.match { grid-column: 2 / 4; margin: -4px 0 0; font-size: 12px; color: #666; min-height: 14px; }
.match.warn { color: #b45309; } .match.bad { color: #b91c1c; }
@media (prefers-color-scheme: dark) {
  .panel { background: #1b1b1d; color: #eee; border-color: #fff2; }
  .row label, .checks label { color: #ccc; } .val, .hint { color: #999; }
  select, input[type=text], input[type=number], .out { background: #111; color: #eee; border-color: #444; }
  button.b { background: #2a2a2d; color: #eee; border-color: #555; } button.b:hover { background: #38383c; }
  button.b.primary { background: #eee; color: #111; border-color: #eee; }
  button.on { background: #1e3a5f; border-color: #3b82f6; } .x { color: #aaa; } .x:hover { background: #333; } .sep { background: #fff2; }
}`;

const GEAR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`;

const STORE = "perch-tuner-creature";
const shq = (v: string) => (/^[\w.:/@%+=,-]+$/.test(v) ? v : `'${v.replace(/'/g, `'\\''`)}'`);
const attr = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The three ways to save the current values. Only values that differ from the defaults appear. */
export function outputs(opts: PerchOptions) {
  const custom = typeof opts.creature === "object";
  const entries = KEYS.filter((k) => opts[k] !== undefined && typeof opts[k] !== "object").map((k) => [k, String(opts[k])] as const);
  const lines = [...(custom ? ["npx perch-pet creature ./creature.json"] : []), ...(entries.length ? ["npx perch-pet set " + entries.map(([k, v]) => `${k}=${shq(v)}`).join(" ")] : [])];
  const kebab = (k: string) => k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
  const tagAttrs = [...entries, ...(custom ? ([["creatureUrl", "/perch-creature.json"]] as const) : [])];
  const tag = `<script src="/perch.js"${tagAttrs.map(([k, v]) => ` data-${kebab(k)}="${attr(v)}"`).join("")} defer></script>`;
  const json = JSON.stringify({ ...Object.fromEntries(entries.map(([k]) => [k, opts[k]])), ...(custom ? { creature: opts.creature } : {}) }, null, 2);
  return { command: lines.join("\n"), tag, json };
}

export function mountTuner(api: PerchApi): () => void {
  if (document.querySelector("[data-perch-tuner]")) return () => {};
  const host = document.createElement("div");
  host.setAttribute("data-perch-tuner", "");
  host.setAttribute("data-perch-root", "");
  host.style.cssText = "position:fixed;left:0;top:0;z-index:2147483000;";
  const root = host.attachShadow({ mode: "open" });
  const d = api.defaults();
  let opts: PerchOptions = { ...api.options() };
  let showFloors = false;

  root.innerHTML = `<style>${CSS_TEXT}${EDITOR_CSS}</style>
  <button class="gear" aria-label="Open Perch tuner" aria-expanded="false" title="Perch tuner">${GEAR}</button>
  <section class="panel" role="dialog" aria-label="Perch tuner" hidden>
    <div class="main">
    <header><h2>Perch tuner</h2><button class="x" aria-label="Close">×</button></header>
    <div class="row wide"><label for="creature">Creature</label><select id="creature">${api.creatures.map((c) => `<option>${c}</option>`).join("")}<option value="__custom" hidden>custom (edited)</option></select><span></span></div>
    <div class="row wide"><span></span><button class="b" data-edit title="Draw pixels, change colours, move the eyes">Draw or edit this creature…</button><span></span></div>
    <div class="row"><label for="stickiness">Stickiness</label><input id="stickiness" type="range" min="0" max="1" step="0.05"><span class="val" data-for="stickiness"></span></div>
    <div class="row"><label for="speed">Speed</label><input id="speed" type="range" min="0.2" max="3" step="0.1"><span class="val" data-for="speed"></span></div>
    <div class="row"><label for="scale">Size</label><input id="scale" type="range" min="1" max="6" step="1"><span class="val" data-for="scale"></span></div>
    <div class="checks">
      <label><input type="checkbox" id="draggable"> Drag and throw</label>
      <label><input type="checkbox" id="bounce"> Elements dip</label>
      <label><input type="checkbox" id="mobile"> Run on phones</label>
      <label><input type="checkbox" id="floors"> Show floors</label>
    </div>
    <div class="row wide"><label for="goal">Goal</label><input id="goal" type="text" placeholder="auto"><button class="b" data-pick="goal" title="Click an element on the page">Pick</button><p class="match" data-match="goal"></p></div>
    <div class="row wide"><label for="ignore">Ignore</label><input id="ignore" type="text" placeholder="none"><button class="b" data-pick="ignore" title="Click an element on the page">Pick</button><p class="match" data-match="ignore"></p></div>
    <div class="row"><label for="topOffset">Top space</label><input id="topOffset" type="number" min="0" step="4" placeholder="auto"><span class="val">px</span></div>
    <div class="sep"></div>
    <textarea class="out" readonly aria-label="Command that saves these values"></textarea>
    <div class="btns">
      <button class="b primary" data-copy="command">Copy command</button>
      <button class="b" data-copy="tag">Copy script tag</button>
      <button class="b" data-copy="json">Copy JSON</button>
      <button class="b" data-reset>Reset</button>
    </div>
    <p class="hint">Run the command in your project folder to save these values. Floors are blue, the goal is green. This panel only shows on localhost.</p>
    </div>
  </section>`;

  const $ = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const gear = $<HTMLButtonElement>(".gear");
  const panel = $<HTMLElement>(".panel");
  const out = $<HTMLTextAreaElement>(".out");
  const field = (id: string) => $<HTMLInputElement>("#" + id);

  const show = (open: boolean) => {
    panel.hidden = !open; gear.hidden = open;
    gear.setAttribute("aria-expanded", String(open));
    if (open) (panel.querySelector("select") as HTMLElement).focus(); else gear.focus();
  };

  const sync = () => {
    ($<HTMLSelectElement>("#creature")).value = typeof opts.creature === "string" ? opts.creature : typeof opts.creature === "object" ? "__custom" : "octopus";
    field("stickiness").value = String(opts.stickiness ?? d.stickiness);
    field("speed").value = String(opts.speed ?? d.speed);
    field("scale").value = String(opts.scale ?? d.scale);
    field("draggable").checked = opts.draggable ?? true;
    field("bounce").checked = opts.bounce ?? true;
    field("mobile").checked = opts.mobile ?? true;
    field("floors").checked = showFloors;
    field("goal").value = opts.goal ?? "";
    field("ignore").value = opts.ignore ?? "";
    field("topOffset").value = opts.topOffset === undefined ? "" : String(opts.topOffset);
    for (const k of ["goal", "ignore"] as const) {
      const el = $<HTMLElement>(`[data-match=${k}]`), sel = opts[k];
      const n = sel ? countMatches(sel) : -1;
      el.className = "match" + (n === 0 ? " bad" : k === "goal" && n > 1 ? " warn" : "");
      el.textContent = n < 0 ? "" : n === 0 ? "matches nothing on this page" : `matches ${n} element${n === 1 ? "" : "s"}${k === "goal" && n > 1 ? " (all count as goals)" : ""}`;
    }
    root.querySelectorAll<HTMLElement>(".val[data-for]").forEach((el) => { el.textContent = field(el.dataset.for!).value; });
    out.value = outputs(opts).command || "No changes from the defaults.";
  };

  /** Stores a value, drops it when it equals the default, restarts the creature. */
  const set = <K extends Key>(k: K, v: PerchOptions[K] | undefined, isDefault = false) => {
    const next = { ...opts };
    if (v === undefined || v === "" || isDefault) delete next[k]; else next[k] = v;
    opts = next;
    api.init(opts); // replaces all options, so dropped keys really go back to their defaults
    sync();
  };

  $<HTMLSelectElement>("#creature").addEventListener("change", (e) => {
    const v = (e.target as HTMLSelectElement).value;
    if (v === "__custom") return;
    try { localStorage.removeItem(STORE); } catch { /* storage can be blocked */ }
    set("creature", v, v === "octopus");
  });
  for (const [id, def] of [["stickiness", d.stickiness], ["speed", d.speed], ["scale", d.scale]] as const) {
    field(id).addEventListener("input", () => set(id, Number(field(id).value), Number(field(id).value) === def));
  }
  for (const id of ["draggable", "bounce", "mobile"] as const) field(id).addEventListener("change", () => set(id, field(id).checked, field(id).checked));
  field("floors").addEventListener("change", () => { showFloors = field("floors").checked; api.debug(showFloors); });
  for (const id of ["goal", "ignore"] as const) field(id).addEventListener("change", () => set(id, field(id).value.trim()));
  field("topOffset").addEventListener("change", () => set("topOffset", field("topOffset").value === "" ? undefined : Number(field("topOffset").value)));

  // ---- pick an element on the page ----
  const pick = (which: "goal" | "ignore") => {
    show(false);
    const layer = document.createElement("div");
    layer.className = "pick";
    const box = document.createElement("div");
    box.className = "box";
    const tip = document.createElement("div");
    tip.className = "tip";
    tip.textContent = `Click the ${which === "goal" ? "call to action" : "element to ignore"}. ↑ picks the parent, ↓ goes back. Esc cancels.`;
    root.append(layer, box, tip);
    let target: Element | null = null;
    let trail: Element[] = []; // elements below the current pick, for ↓
    const at = (x: number, y: number) => {
      layer.style.pointerEvents = "none";
      const el = document.elementFromPoint(x, y);
      layer.style.pointerEvents = "";
      return el && !el.closest("[data-perch-root]") ? el : null;
    };
    const outline = () => {
      const r = target?.getBoundingClientRect();
      box.style.display = r ? "" : "none";
      if (r) Object.assign(box.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
      tip.textContent = target ? `${selectorFor(target)}   (matches ${countMatches(selectorFor(target))}). Click to pick, ↑ parent, ↓ child, Esc cancels.` : tip.textContent;
    };
    let lastX = -1, lastY = -1;
    const move = (e: MouseEvent) => {
      if (e.clientX === lastX && e.clientY === lastY) return; // a click re-reports the same spot: keep the ↑ choice
      lastX = e.clientX; lastY = e.clientY;
      target = at(e.clientX, e.clientY); trail = []; outline();
    };
    const done = () => { layer.remove(); box.remove(); tip.remove(); removeEventListener("keydown", key, true); show(true); };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); done(); }
      else if (e.key === "ArrowUp" && target?.parentElement && target.parentElement !== document.body) { e.preventDefault(); trail.push(target); target = target.parentElement; outline(); }
      else if (e.key === "ArrowDown" && trail.length) { e.preventDefault(); target = trail.pop()!; outline(); }
    };
    layer.addEventListener("mousemove", move);
    layer.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      const el = target ?? at(e.clientX, e.clientY);
      done();
      if (!el) return;
      const sel = selectorFor(el);
      set(which, which === "ignore" && opts.ignore ? `${opts.ignore}, ${sel}` : sel);
    });
    addEventListener("keydown", key, true);
  };
  root.querySelectorAll<HTMLElement>("[data-pick]").forEach((b) => b.addEventListener("click", () => pick(b.dataset.pick as "goal" | "ignore")));

  // ---- copy buttons ----
  root.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach((b) => b.addEventListener("click", async () => {
    const text = outputs(opts)[b.dataset.copy as "command" | "tag" | "json"] || "";
    const label = b.textContent;
    try { await navigator.clipboard.writeText(text); b.textContent = "Copied"; } catch { out.value = text; out.select(); b.textContent = "Select + copy"; }
    b.classList.add("copied");
    setTimeout(() => { b.textContent = label; b.classList.remove("copied"); }, 1400);
  }));
  $<HTMLButtonElement>("[data-reset]").addEventListener("click", () => {
    opts = {};
    try { localStorage.removeItem(STORE); } catch { /* storage can be blocked */ }
    api.init({});
    sync();
  });

  // ---- the pixel editor ----
  const main = $<HTMLElement>(".main");
  let editor: EditorHandle | null = null;
  const saveCustom = (spec: CreatureSpec) => {
    opts = { ...opts, creature: spec };
    api.update({ creature: spec }); // swaps the drawing in place, no restart
    try { localStorage.setItem(STORE, JSON.stringify(spec)); } catch { /* storage can be blocked */ }
  };
  const closeEditor = () => { editor?.el.remove(); editor = null; main.hidden = false; sync(); };
  $<HTMLButtonElement>("[data-edit]").addEventListener("click", () => {
    const name = typeof opts.creature === "string" ? opts.creature : "octopus";
    const start = (typeof opts.creature === "object" ? opts.creature : api.spec(name)) as CreatureSpec;
    const original = JSON.parse(JSON.stringify(start)) as CreatureSpec;
    editor = createEditor(start, saveCustom, closeEditor, () => original);
    main.hidden = true;
    panel.appendChild(editor.el);
    editor.refresh();
  });
  // edits survive a page reload while you tune
  try {
    const saved = localStorage.getItem(STORE);
    if (saved && opts.creature === undefined) {
      const spec = JSON.parse(saved) as CreatureSpec;
      if (validate(spec).length === 0) { opts = { ...opts, creature: spec }; api.init(opts); }
    }
  } catch { /* ignore a broken saved creature */ }

  gear.addEventListener("click", () => show(true));
  $<HTMLButtonElement>(".x").addEventListener("click", () => show(false));
  panel.addEventListener("keydown", (e) => { if (e.key === "Escape") { if (editor) closeEditor(); else show(false); } });

  document.body.appendChild(host);
  sync();
  return () => host.remove();
}
