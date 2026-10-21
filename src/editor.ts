import { draw, validate, type ArmName, type CreatureSpec, type Pose } from "./creature";

// The pixel editor inside the tuner. It edits a CreatureSpec in place: pick a part (body, legs,
// an arm pose), pick a colour, paint. Every stroke goes to the live creature on the page.

const CELL = 10;
const ARMS: ArmName[] = ["rest", "point", "wave", "hold", "brace"];
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export const EDITOR_CSS = `
.ed canvas { display: block; width: 100%; image-rendering: pixelated; border: 1px solid #0003; border-radius: 6px; touch-action: none; cursor: crosshair; }
.ed .sw { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; align-items: center; }
.ed .sw label { position: relative; display: inline-flex; width: 28px; height: 28px; border-radius: 6px; border: 2px solid transparent; cursor: pointer; overflow: hidden; }
.ed .sw label.sel { border-color: #3b82f6; }
.ed .sw input[type=color] { position: absolute; inset: -4px; width: 40px; height: 40px; border: 0; padding: 0; cursor: pointer; }
.ed .sw .pick { position: absolute; inset: 0; cursor: pointer; }
.ed .era { width: 28px; height: 28px; border: 2px solid transparent; border-radius: 6px; background: repeating-conic-gradient(#ccc 0 25%, #fff 0 50%) 0 0 / 10px 10px; cursor: pointer; padding: 0; }
.ed .era.sel { border-color: #3b82f6; }
.ed .tiny { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 10px; margin: 8px 0; }
.ed .tiny label { display: flex; gap: 6px; align-items: center; color: #444; }
.ed .tiny input[type=number] { width: 54px; }
.ed .tiny input[type=color] { width: 34px; height: 24px; padding: 0; border: 1px solid #ccc; border-radius: 4px; background: none; }
.ed .err { color: #b91c1c; font-size: 12px; margin: 6px 0 0; min-height: 1em; }
@media (prefers-color-scheme: dark) { .ed .tiny label { color: #ccc; } .ed canvas { border-color: #fff3; } }
`;

export interface EditorHandle {
  el: HTMLElement;
  /** call after the host panel shows the editor so it redraws */
  refresh(): void;
}

export function createEditor(initial: CreatureSpec, onChange: (spec: CreatureSpec) => void, onBack: () => void, onReset: () => CreatureSpec): EditorHandle {
  let spec = clone(initial);
  let part = "body";
  let tool = Object.keys(spec.palette)[0];
  const undo: string[] = [];

  const el = document.createElement("div");
  el.className = "ed";
  el.innerHTML = `
    <header><h2>Edit creature</h2><button class="x" data-back aria-label="Back to settings" title="Back">←</button></header>
    <div class="row wide"><label for="ed-part">Part</label>
      <select id="ed-part">
        <option value="body">Body</option><option value="legsA">Legs, frame A</option><option value="legsB">Legs, frame B</option>
        ${ARMS.map((a) => `<option value="arm:${a}">Arm: ${a}</option>`).join("")}
      </select><span></span></div>
    <div class="sw" role="radiogroup" aria-label="Colour to paint with"></div>
    <canvas aria-label="Creature pixels. Click or drag to paint." width="${spec.cols * CELL}" height="${spec.rows * CELL}"></canvas>
    <div class="tiny">
      <label>Eye white <input type="color" data-eye="white"></label>
      <label>Pupil <input type="color" data-eye="pupil"></label>
      <label>Arms <input type="color" data-arm></label>
      <label>Name <input type="text" data-name style="width:90px"></label>
      <label>Eye y <input type="number" data-ey min="0" max="12"></label>
      <label>Eyes x <input type="number" data-ex min="0" max="20"></label>
    </div>
    <p class="err" aria-live="polite"></p>
    <div class="btns">
      <button class="b" data-undo>Undo</button>
      <button class="b" data-reset>Reset</button>
      <button class="b primary" data-dl>Download JSON</button>
      <button class="b" data-copyjson>Copy JSON</button>
    </div>
    <p class="hint">Click a colour to paint with it, double-click it to change it. Arms are mirrored to the other side. To keep the result run <code>npx perch-pet creature ./creature.json</code>.</p>`;

  const $ = <T extends HTMLElement>(s: string) => el.querySelector(s) as T;
  const canvas = $<HTMLCanvasElement>("canvas");
  const ctx = canvas.getContext("2d")!;
  const err = $<HTMLElement>(".err");
  const sw = $<HTMLElement>(".sw");

  const armColor = () => spec.armColor ?? spec.palette.R ?? Object.values(spec.palette)[0];

  function pose(): Pose {
    const arm = (part.startsWith("arm:") ? part.slice(4) : "rest") as ArmName;
    return { left: arm, right: arm, face: "look", legs: part === "legsB" ? 1 : 0, px: 0, py: 0, flip: false, w: spec.cols, h: spec.rows };
  }

  function render() {
    const { cols, rows, offset: [ox, oy] } = spec;
    canvas.width = cols * CELL; canvas.height = rows * CELL;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { ctx.fillStyle = (x + y) % 2 ? "#f1f1f1" : "#e6e6e6"; ctx.fillRect(x * CELL, y * CELL, CELL, CELL); }
    draw(ctx, spec, pose(), CELL);
    ctx.strokeStyle = "#0000001a"; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= cols; x++) { ctx.moveTo(x * CELL + 0.5, 0); ctx.lineTo(x * CELL + 0.5, rows * CELL); }
    for (let y = 0; y <= rows; y++) { ctx.moveTo(0, y * CELL + 0.5); ctx.lineTo(cols * CELL, y * CELL + 0.5); }
    ctx.stroke();
    // outline of the part being edited
    ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 2;
    const bw = spec.body[0].length;
    if (part === "body") ctx.strokeRect(ox * CELL, oy * CELL, bw * CELL, spec.body.length * CELL);
    else if (part.startsWith("legs")) ctx.strokeRect(ox * CELL, (oy + spec.body.length) * CELL, bw * CELL, spec.legs[0].length * CELL);
    else for (const [x, y] of spec.arms[part.slice(4) as ArmName]) for (const cx of [x, cols - 1 - x]) ctx.strokeRect(cx * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
  }

  function palette() {
    sw.innerHTML = "";
    for (const [k, color] of Object.entries(spec.palette)) {
      const l = document.createElement("label");
      l.className = k === tool ? "sel" : "";
      l.style.background = color;
      l.title = `Colour ${k}: click to paint with it, double-click to change it`;
      const pick = document.createElement("span");
      pick.className = "pick";
      pick.addEventListener("click", () => { tool = k; palette(); });
      const input = document.createElement("input");
      input.type = "color"; input.value = color; input.style.cssText = "position:absolute;inset:0;opacity:0;pointer-events:none;";
      pick.addEventListener("dblclick", () => input.click());
      input.addEventListener("input", () => { spec.palette[k] = input.value; l.style.background = input.value; commit(false); });
      l.append(pick, input);
      sw.appendChild(l);
    }
    const era = document.createElement("button");
    era.className = "era" + (tool === "." ? " sel" : "");
    era.title = "Eraser";
    era.setAttribute("aria-label", "Eraser");
    era.addEventListener("click", () => { tool = "."; palette(); });
    const add = document.createElement("button");
    add.className = "b"; add.textContent = "+"; add.title = "Add a colour";
    add.addEventListener("click", () => {
      const key = "ABCEFGHIJKLMNOPQRSTUVWXYZ".split("").find((c) => !spec.palette[c]);
      if (!key) return;
      pushUndo(); spec.palette[key] = "#ff00aa"; tool = key; palette(); commit(false);
    });
    sw.append(era, add);
  }

  function fields() {
    $<HTMLInputElement>("[data-eye=white]").value = spec.eyeColors.white;
    $<HTMLInputElement>("[data-eye=pupil]").value = spec.eyeColors.pupil;
    $<HTMLInputElement>("[data-arm]").value = armColor();
    $<HTMLInputElement>("[data-name]").value = spec.name;
    $<HTMLInputElement>("[data-ey]").value = String(spec.eyes.left[1]);
    $<HTMLInputElement>("[data-ex]").value = String(spec.eyes.left[0]);
  }

  function pushUndo() { undo.push(JSON.stringify(spec)); if (undo.length > 60) undo.shift(); }
  function commit(redraw = true) {
    const problems = validate(spec);
    err.textContent = problems.join(", ");
    if (redraw) render();
    if (!problems.length) onChange(clone(spec));
  }

  // ---- painting ----
  function paint(cx: number, cy: number) {
    const { offset: [ox, oy], cols } = spec;
    let changed = false;
    if (part === "body" || part.startsWith("legs")) {
      const rows = part === "body" ? spec.body : spec.legs[part === "legsB" ? 1 : 0];
      const r = cy - oy - (part === "body" ? 0 : spec.body.length), c = cx - ox;
      if (r < 0 || r >= rows.length || c < 0 || c >= rows[r].length) return;
      if (rows[r][c] !== tool) { const chars = [...rows[r]]; chars[c] = tool; rows[r] = chars.join(""); changed = true; }
    } else {
      const list = spec.arms[part.slice(4) as ArmName];
      // arms are stored for the right side; the left side mirrors them
      const x = cx >= cols / 2 ? cx : cols - 1 - cx;
      const i = list.findIndex(([ax, ay]) => ax === x && ay === cy);
      if (tool === "." && i >= 0) { list.splice(i, 1); changed = true; }
      else if (tool !== "." && i < 0 && cy >= 0 && cy < spec.rows) { list.push([x, cy]); changed = true; }
    }
    if (changed) { render(); commit(false); }
  }
  const cell = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return [Math.floor(((e.clientX - r.left) / r.width) * spec.cols), Math.floor(((e.clientY - r.top) / r.height) * spec.rows)] as const;
  };
  let down = false;
  canvas.tabIndex = 0; // so Escape works after painting
  canvas.addEventListener("pointerdown", (e) => { canvas.focus({ preventScroll: true }); down = true; canvas.setPointerCapture(e.pointerId); pushUndo(); paint(...cell(e)); });
  canvas.addEventListener("pointermove", (e) => { if (down) paint(...cell(e)); });
  const end = () => { down = false; };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);

  // ---- the rest of the controls ----
  $<HTMLSelectElement>("#ed-part").addEventListener("change", (e) => { part = (e.target as HTMLSelectElement).value; render(); });
  el.querySelectorAll<HTMLInputElement>("[data-eye]").forEach((i) => i.addEventListener("input", () => { pushUndo(); spec.eyeColors[i.dataset.eye as "white" | "pupil"] = i.value; commit(); }));
  $<HTMLInputElement>("[data-arm]").addEventListener("input", (e) => { pushUndo(); spec.armColor = (e.target as HTMLInputElement).value; commit(); });
  $<HTMLInputElement>("[data-name]").addEventListener("change", (e) => { spec.name = (e.target as HTMLInputElement).value.trim() || "creature"; commit(false); });
  const moveEyes = () => {
    const x = Number($<HTMLInputElement>("[data-ex]").value), y = Number($<HTMLInputElement>("[data-ey]").value);
    if (Number.isNaN(x) || Number.isNaN(y)) return;
    pushUndo();
    const gap = spec.eyes.right[0] - spec.eyes.left[0];
    spec.eyes = { left: [x, y], right: [x + gap, y] };
    commit();
  };
  $<HTMLInputElement>("[data-ex]").addEventListener("change", moveEyes);
  $<HTMLInputElement>("[data-ey]").addEventListener("change", moveEyes);
  $<HTMLButtonElement>("[data-undo]").addEventListener("click", () => { const prev = undo.pop(); if (!prev) return; spec = JSON.parse(prev); palette(); fields(); commit(); });
  $<HTMLButtonElement>("[data-reset]").addEventListener("click", () => { pushUndo(); spec = clone(onReset()); tool = Object.keys(spec.palette)[0]; palette(); fields(); commit(); });
  $<HTMLButtonElement>("[data-back]").addEventListener("click", onBack);
  const json = () => JSON.stringify(spec, null, 2);
  $<HTMLButtonElement>("[data-dl]").addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([json()], { type: "application/json" }));
    a.download = "creature.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $<HTMLButtonElement>("[data-copyjson]").addEventListener("click", async (e) => {
    const b = e.currentTarget as HTMLButtonElement, label = b.textContent;
    try { await navigator.clipboard.writeText(json()); b.textContent = "Copied"; } catch { b.textContent = "Use Download"; }
    setTimeout(() => { b.textContent = label; }, 1400);
  });

  palette(); fields(); render();
  return { el, refresh: () => { palette(); fields(); render(); } };
}
