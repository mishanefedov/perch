import { validateAsk, type AskOptions } from "./ask";
import { CREATURES, resolve, type PerchOptions } from "./config";
import { validate, type CreatureSpec } from "./creature";
import { start, type Handle } from "./engine";

export type { PerchOptions, CreatureSpec, Handle, AskOptions };
export { CREATURES, validate, validateAsk };

/** What the tuner panel needs from the library. */
export interface PerchApi {
  init(options?: PerchOptions): Handle | null;
  destroy(): void;
  celebrate(): void;
  update(options: PerchOptions): void;
  options(): PerchOptions;
  defaults(): { stickiness: number; speed: number; scale: number };
  /** a copy of a built-in creature, for editing */
  spec(name: string): CreatureSpec | undefined;
  debug(on: boolean): void;
  /** show the question now (for trying it out) */
  previewAsk(): void;
  creatures: string[];
}

let current: Handle | null = null;
let options: PerchOptions = {};
let debugOn = false;

/** Starts the creature. Safe to call twice: the first one is replaced. */
export function init(next: PerchOptions = {}): Handle | null {
  if (typeof document === "undefined") return null;
  current?.destroy();
  current = null;
  options = { ...next };
  const cfg = resolve(options);
  if (typeof options.creature === "object") {
    const errs = validate(cfg.spec);
    if (errs.length) throw new Error("perch: invalid creature\n- " + errs.join("\n- "));
  }
  const coarse = matchMedia("(pointer: coarse)").matches || innerWidth < 640;
  if (coarse && !cfg.mobile) return null;
  current = start(cfg);
  if (debugOn) current.debug(true);
  return current;
}

/** Like init, but first loads `creatureUrl` (a creature JSON file) when one is set. */
export async function boot(next: PerchOptions = {}): Promise<Handle | null> {
  if (next.creatureUrl && typeof next.creature !== "object") {
    try {
      const res = await fetch(next.creatureUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const spec = (await res.json()) as CreatureSpec;
      const errs = validate(spec);
      if (errs.length) throw new Error(errs.join(", "));
      return init({ ...next, creature: spec });
    } catch (e) {
      console.warn(`perch: could not use ${next.creatureUrl} (${e instanceof Error ? e.message : e}); using the built-in creature`);
      return init({ ...next, creatureUrl: undefined });
    }
  }
  return init(next);
}

export function destroy(): void {
  current?.destroy();
  current = null;
}

export function celebrate(): void {
  current?.celebrate();
}

/** Changes some options while it runs. The creature restarts. */
export function update(partial: PerchOptions): void {
  const next = { ...options, ...partial };
  const keys = Object.keys(partial);
  // edits to the drawing alone swap in place: no restart, so painting in the tuner feels live
  if (current && keys.length === 1 && keys[0] === "creature" && typeof partial.creature === "object" && validate(partial.creature).length === 0 && current.setCreature(partial.creature)) {
    options = next;
    return;
  }
  // a new question alone is swapped in place too: typing in the tuner must not restart the creature
  if (current && keys.length === 1 && keys[0] === "ask") {
    options = next;
    current.setAsk(next.ask ?? null);
    return;
  }
  init(next);
}

/** The options as you set them (not the resolved defaults). */
export function getOptions(): PerchOptions {
  return { ...options };
}

/** Shows which elements the scanner treats as floors (blue) and call-to-action spots (green). */
export function debug(on = true): void {
  debugOn = on;
  current?.debug(on);
}

export const api: PerchApi = {
  init,
  destroy,
  celebrate,
  update,
  options: getOptions,
  defaults: () => {
    const r = resolve({});
    return { stickiness: r.stickiness, speed: r.speed, scale: r.scale };
  },
  spec: (name) => (CREATURES[name] ? (JSON.parse(JSON.stringify(CREATURES[name])) as CreatureSpec) : undefined),
  debug,
  previewAsk: () => current?.previewAsk(),
  creatures: Object.keys(CREATURES),
};

/** The tuner is meant for development: localhost, local network addresses, or ?perch=tune. */
export function tunerWanted(attr?: string): boolean {
  if (typeof location === "undefined") return false;
  if (attr === "false") return false;
  if (attr === "true") return true;
  const flag = new URLSearchParams(location.search).get("perch");
  try {
    if (flag === "tune") sessionStorage.setItem("perch-tune", "1");
    if (flag === "off") sessionStorage.removeItem("perch-tune");
    if (sessionStorage.getItem("perch-tune") === "1") return true;
  } catch { /* storage can be blocked */ }
  const h = location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h.endsWith(".local") || h.endsWith(".localhost") || h.endsWith(".test") || /^(192\.168|10\.)\./.test(h);
}
