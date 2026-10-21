import type { CreatureSpec } from "./creature";
import { alien } from "./creatures/alien";
import { blob } from "./creatures/blob";
import { cat } from "./creatures/cat";
import { ghost } from "./creatures/ghost";
import { octopus } from "./creatures/octopus";
import { robot } from "./creatures/robot";

export interface PerchOptions {
  /** built-in name (octopus, blob, cat, ghost, robot, alien) or your own CreatureSpec. Default "octopus" */
  creature?: string | CreatureSpec;
  /** URL of a creature JSON file made in the tuner (`npx perch-pet creature file.json` sets this up) */
  creatureUrl?: string;
  /** pixel size of one sprite pixel. Default 3 on desktop, 2 on phones */
  scale?: number;
  /** 0 to 1. How long it stays on a spot before moving on. Default 0.5 */
  stickiness?: number;
  /** walk speed multiplier. Default 1 */
  speed?: number;
  /** extra CSS selector for things it may stand on, added to the automatic ones */
  platforms?: string;
  /** CSS selector for things it must never stand on or point at */
  ignore?: string;
  /** CSS selector for the call to action it should point at. Default: found automatically */
  goal?: string;
  /** px kept free at the top, e.g. a fixed header. Default: found automatically */
  topOffset?: number;
  /** run on phones and touch screens. Default true */
  mobile?: boolean;
  /** let visitors drag and throw it. Default true */
  draggable?: boolean;
  /** make the page elements dip a few px when it lands on them. Default true */
  bounce?: boolean;
  zIndex?: number;
}

export interface ResolvedOptions {
  spec: CreatureSpec;
  scale: number;
  stickiness: number;
  speed: number;
  platforms: string;
  ignore: string;
  goal: string;
  topOffset: number | null;
  mobile: boolean;
  draggable: boolean;
  bounce: boolean;
  zIndex: number;
}

export const CREATURES: Record<string, CreatureSpec> = { octopus, blob, cat, ghost, robot, alien };

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function resolve(o: PerchOptions = {}): ResolvedOptions {
  const spec = typeof o.creature === "object" ? o.creature : CREATURES[o.creature ?? "octopus"];
  if (!spec) throw new Error(`perch: unknown creature "${String(o.creature)}". Built in: ${Object.keys(CREATURES).join(", ")}`);
  const small = typeof matchMedia === "function" && (matchMedia("(pointer: coarse)").matches || innerWidth < 640);
  return {
    spec,
    scale: clamp(Math.round(o.scale ?? (small ? 2 : 3)), 1, 8),
    stickiness: clamp(o.stickiness ?? 0.5, 0, 1),
    speed: clamp(o.speed ?? 1, 0.2, 4),
    platforms: o.platforms ?? "",
    ignore: o.ignore ?? "",
    goal: o.goal ?? "",
    topOffset: typeof o.topOffset === "number" ? o.topOffset : null,
    mobile: o.mobile ?? true,
    draggable: o.draggable ?? true,
    bounce: o.bounce ?? true,
    zIndex: o.zIndex ?? 9999,
  };
}

/** Reads options from the data-* attributes of the script tag, e.g.
 *  <script src="/perch.js" data-creature="blob" data-stickiness="0.8" defer></script> */
export function fromScript(el: HTMLScriptElement | null): PerchOptions & { auto: boolean } {
  const d = el?.dataset ?? {};
  const num = (v: string | undefined) => (v === undefined || v === "" || isNaN(Number(v)) ? undefined : Number(v));
  const bool = (v: string | undefined) => (v === undefined ? undefined : v !== "false" && v !== "0");
  return {
    auto: d.auto !== "false",
    creature: d.creature,
    creatureUrl: d.creatureUrl,
    scale: num(d.scale),
    stickiness: num(d.stickiness),
    speed: num(d.speed),
    platforms: d.platforms,
    ignore: d.ignore,
    goal: d.goal,
    topOffset: num(d.topOffset),
    mobile: bool(d.mobile),
    draggable: bool(d.draggable),
    bounce: bool(d.bounce),
    zIndex: num(d.zIndex),
  };
}
