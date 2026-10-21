import { CREATURES } from "../../src/config";
import { draw } from "../../src/creature";
import { FILES, load, save, type Settings } from "./settings";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const msg = (text = "") => { $("msg").textContent = text; };
const BLOCKED = "Chrome does not let extensions run on this page (chrome:// pages and the Chrome Web Store).";

let tab: chrome.tabs.Tab | undefined;
let settings: Settings;
let active = false;

async function targetTab(): Promise<chrome.tabs.Tab | undefined> {
  const id = Number(new URLSearchParams(location.search).get("tab")); // lets tests aim at a page
  if (id) return chrome.tabs.get(id);
  return (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
}

const origin = () => { try { const u = new URL(tab?.url ?? ""); return u.protocol.startsWith("http") ? u.origin : ""; } catch { return ""; } };

async function status(): Promise<boolean> {
  if (tab?.id === undefined) return false;
  try { return !!((await chrome.tabs.sendMessage(tab.id, { type: "perch:status" })) as { active: boolean } | undefined)?.active; } catch { return false; }
}

async function inject(): Promise<boolean> {
  if (tab?.id === undefined) return false;
  try { await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: FILES }); return true; } catch { msg(BLOCKED); return false; }
}

function renderToggle() { $("toggle").textContent = active ? "Hide on this page" : "Show on this page"; }

function renderChips() {
  const box = $("chips");
  box.innerHTML = "";
  const all = { ...CREATURES, ...(settings.custom ? { custom: settings.custom } : {}) };
  for (const [name, spec] of Object.entries(all)) {
    const b = document.createElement("button");
    b.type = "button"; b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(name === settings.creature)); b.dataset.creature = name;
    const c = document.createElement("canvas");
    c.width = spec.cols * 2; c.height = spec.rows * 2;
    draw(c.getContext("2d")!, spec, { left: "rest", right: "rest", face: "look", legs: 0, px: 0, py: 0, flip: false, w: spec.cols, h: spec.rows }, 2);
    b.append(c, document.createTextNode(name));
    b.addEventListener("click", () => { settings.creature = name; void save({ creature: name }); renderChips(); });
    box.appendChild(b);
  }
}

let saveTimer = 0;
function slider(key: "scale" | "speed" | "stickiness") {
  const input = $<HTMLInputElement>(key), out = $(key + "-out");
  input.value = String(settings[key]); out.textContent = String(settings[key]);
  input.addEventListener("input", () => {
    settings[key] = Number(input.value); out.textContent = input.value;
    clearTimeout(saveTimer); // chrome.storage.sync allows about 2 writes a second
    saveTimer = window.setTimeout(() => void save({ [key]: settings[key] }), 300);
  });
}

async function ask(origins: string[]): Promise<boolean> {
  return (await chrome.permissions.contains({ origins })) || (await chrome.permissions.request({ origins }));
}

async function main() {
  tab = await targetTab();
  settings = await load();
  active = await status();
  renderChips(); renderToggle();
  (["scale", "speed", "stickiness"] as const).forEach(slider);

  const o = origin();
  $("host").textContent = o ? new URL(o).hostname : "this site";
  const site = $<HTMLInputElement>("site"), all = $<HTMLInputElement>("all");
  site.checked = !!o && settings.sites.includes(o);
  all.checked = settings.everywhere;
  site.disabled = !o || settings.everywhere;
  if (!o) msg(BLOCKED);

  $("customize").addEventListener("click", async () => {
    msg();
    if (!active && !(await inject())) return;
    try { await chrome.tabs.sendMessage(tab!.id!, { type: "perch:tuner" }); } catch { msg(BLOCKED); return; }
    if (!new URLSearchParams(location.search).has("tab")) window.close(); // the panel opens on the page
  });

  $("toggle").addEventListener("click", async () => {
    msg();
    if (active) { await chrome.tabs.sendMessage(tab!.id!, { type: "perch:hide" }).catch(() => {}); active = false; }
    else active = (await inject()) && (await status());
    renderToggle();
  });

  site.addEventListener("change", async () => {
    msg();
    const origins = [`${o}/*`];
    if (site.checked) {
      if (!(await ask(origins))) { site.checked = false; msg("Permission not granted."); return; }
      settings.sites = [...new Set([...settings.sites, o])];
      await save({ sites: settings.sites });
      if (!active) { active = (await inject()) && (await status()); renderToggle(); }
    } else {
      settings.sites = settings.sites.filter((s) => s !== o);
      await save({ sites: settings.sites });
      await chrome.permissions.remove({ origins }).catch(() => {});
    }
  });

  all.addEventListener("change", async () => {
    msg();
    if (all.checked) {
      if (!(await ask(["<all_urls>"]))) { all.checked = false; msg("Permission not granted."); return; }
      settings.everywhere = true; await save({ everywhere: true });
      if (!active && o) { active = (await inject()) && (await status()); renderToggle(); }
    } else {
      settings.everywhere = false; await save({ everywhere: false });
      await chrome.permissions.remove({ origins: ["<all_urls>"] }).catch(() => {});
    }
    site.disabled = !o || settings.everywhere;
  });
}

void main();
