// Settings shared by the popup, the content script and the background worker.
import type { CreatureSpec } from "../../src/creature";

export interface Settings {
  /** a built-in name, or "custom" for the creature drawn in the tuner */
  creature: string;
  /** the drawn creature, kept even while a built-in one is selected */
  custom?: CreatureSpec;
  scale: number;
  speed: number;
  stickiness: number;
  /** origins where the creature is always on, e.g. "https://example.com" */
  sites: string[];
  /** on every site (needs the optional all-sites permission) */
  everywhere: boolean;
}

export const DEFAULTS: Settings = { creature: "octopus", scale: 3, speed: 1, stickiness: 0.5, sites: [], everywhere: false };

/** Sites where a creature on top of a canvas app only gets in the way. Skipped in "every site" mode. */
export const NEVER = ["*://docs.google.com/*", "*://*.figma.com/*", "*://*.miro.com/*", "*://excalidraw.com/*"];

export async function load(): Promise<Settings> {
  const stored = (await chrome.storage.sync.get([...Object.keys(DEFAULTS), "custom"] as (keyof Settings)[])) as Partial<Settings>;
  return { ...DEFAULTS, ...stored };
}

export async function save(partial: Partial<Settings>): Promise<void> {
  await chrome.storage.sync.set(partial);
}

/** What only applies to one site: the call to action, things to ignore, space for a fixed header. */
export interface SiteRule { goal?: string; ignore?: string; topOffset?: number; ask?: object }

export const ruleKey = (origin: string) => `rule:${origin}`;

export async function loadRule(origin: string): Promise<SiteRule> {
  return ((await chrome.storage.sync.get(ruleKey(origin)))[ruleKey(origin)] ?? {}) as SiteRule;
}

/** One storage item per site (an item may hold 8 KB). An empty rule removes the item. */
export async function saveRule(origin: string, rule: SiteRule): Promise<void> {
  const clean = Object.fromEntries(Object.entries(rule).filter(([, v]) => v !== undefined && v !== ""));
  if (Object.keys(clean).length) await chrome.storage.sync.set({ [ruleKey(origin)]: clean });
  else await chrome.storage.sync.remove(ruleKey(origin));
}

/** Options for Perch.init. The page itself is never modified: no landing animation on elements. */
export function perchOptions(s: Settings, rule: SiteRule = {}) {
  const creature = s.creature === "custom" && s.custom ? s.custom : s.creature === "custom" ? "octopus" : s.creature;
  return { creature, scale: s.scale, speed: s.speed, stickiness: s.stickiness, bounce: false, mobile: true, draggable: true, ...rule };
}

export const FILES = ["perch-ext.js", "perch-tuner.js", "bootstrap.js"];
