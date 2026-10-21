import type { ResolvedOptions } from "./config";

// Finds the things on the page the creature can stand on ("platforms") and the call to
// action it should point at ("goals"). Plain DOM reads: no network, no model, nothing
// written to the page.

export interface Plat {
  el: Element;
  left: number;
  right: number;
  top: number;
  goal: boolean;
  text: boolean;
}

export const ROOT_ATTR = "data-perch-root";
const BASE = "h1,h2,h3,h4,h5,h6,p,li,blockquote,figure,img,video,table,pre,form,button,input:not([type=hidden]),textarea,select,[role=button],a,[data-perch]";
const TEXT = "p,h1,h2,h3,h4,h5,h6,blockquote,li";
const PRESS = "button,a,[role=button],input[type=submit],input[type=button]";
const GOAL_WORDS = /sign ?up|get started|join|subscribe|buy|book|try|start|demo|contact|waitlist|download|pricing|free|request|talk to|get access|early access/i;
const MAX = 300;

export class Scanner {
  private els: Element[] = [];
  private goals = new Set<Element>();
  private occluded = new Set<Element>();
  private frame = -1;
  private cache: Plat[] = [];
  private range = document.createRange();
  private ink = document.createElement("canvas").getContext("2d");
  private inkCache = new Map<string, number>();
  private limit = 0;
  private cfg: ResolvedOptions;
  private W: number;

  constructor(cfg: ResolvedOptions, W: number) {
    this.cfg = cfg;
    this.W = W;
  }

  /** px at the top of the viewport the creature must stay below (fixed headers) */
  get topLimit(): number {
    return Math.max(this.cfg.topOffset ?? 0, this.limit) + 8;
  }

  private ignored(el: Element): boolean {
    if (el.closest(`[${ROOT_ATTR}], [data-perch-ignore]`)) return true;
    return !!this.cfg.ignore && !!el.closest(this.cfg.ignore);
  }

  private visible(el: Element): boolean {
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden" && parseFloat(cs.opacity) > 0.05;
  }

  private looksLikeButton(el: Element): boolean {
    if (el.matches("button,[role=button],input[type=submit],input[type=button],[data-perch]")) return true;
    if (!el.matches("a")) return true;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const filled = cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent";
    const bordered = parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== "none";
    return r.width > 60 && r.height > 24 && (filled || bordered || /btn|button|cta/i.test(el.className?.toString() ?? ""));
  }

  private goalScore(el: Element): number {
    if (!el.matches(PRESS)) return 0;
    const text = (el.textContent ?? (el as HTMLInputElement).value ?? "").trim();
    if (!text || text.length > 40) return 0;
    let s = 0;
    if (el.closest("form") && el.matches("[type=submit], button:not([type=button])")) s += 3;
    if (GOAL_WORDS.test(text)) s += 2;
    if (/btn|button|cta/i.test(el.className?.toString() ?? "")) s += 1;
    return s;
  }

  /** Heavy pass: re-reads which elements exist and which are near the screen. Call it on a timer,
   *  on DOM changes and after scrolling stops. */
  refresh(): void {
    const near = (r: DOMRect) => r.width > 0 && r.height > 0 && r.bottom > -innerHeight * 0.5 && r.top < innerHeight * 1.5;
    const all = [...document.querySelectorAll(BASE + (this.cfg.platforms ? "," + this.cfg.platforms : ""))];
    const keep: Element[] = [];
    const goals = new Set<Element>();
    const forced = this.cfg.goal ? [...document.querySelectorAll(this.cfg.goal)] : [];
    const taggedGoals = [...document.querySelectorAll("[data-perch]")];
    for (const el of all) {
      if (keep.length >= MAX) break;
      if (!near(el.getBoundingClientRect()) || this.ignored(el) || !this.visible(el)) continue;
      if (el.matches("a") && !this.looksLikeButton(el)) continue;
      keep.push(el);
    }
    // a goal stands on its form if it has one (the creature points at the button), else on itself
    const goalEls = new Set<Element>(forced);
    for (const g of taggedGoals) goalEls.add(g);
    if (!this.cfg.goal) for (const el of keep) if (this.goalScore(el) >= 3) goalEls.add(el);
    for (const g of goalEls) {
      if (this.ignored(g)) continue;
      const host = g.closest("form") ?? g;
      if (!near(host.getBoundingClientRect())) continue;
      goals.add(host);
      if (!keep.includes(host)) keep.push(host);
    }
    this.els = keep;
    this.goals = goals;

    // what is actually on top at each platform (modals, cookie banners, menus)?
    this.occluded.clear();
    for (const el of keep) {
      const r = el.getBoundingClientRect();
      const x = Math.max(1, Math.min(innerWidth - 1, (r.left + r.right) / 2));
      const y = Math.max(1, Math.min(innerHeight - 1, Math.max(r.top, 0) + Math.min(r.height, innerHeight - r.top) / 2));
      const hit = document.elementFromPoint(x, y);
      if (hit && !hit.closest(`[${ROOT_ATTR}]`) && !el.contains(hit) && !hit.contains(el)) this.occluded.add(el);
    }

    // fixed or sticky bars at the top of the screen
    let lim = 0;
    for (const x of [innerWidth * 0.2, innerWidth * 0.5, innerWidth * 0.8]) {
      let e: Element | null = document.elementFromPoint(x, 4);
      while (e && e !== document.documentElement) {
        const cs = getComputedStyle(e);
        if (cs.position === "fixed" || cs.position === "sticky") {
          const r = e.getBoundingClientRect();
          if (r.top <= 8 && r.height < innerHeight * 0.4 && !e.closest(`[${ROOT_ATTR}]`)) lim = Math.max(lim, r.bottom);
          break;
        }
        e = e.parentElement;
      }
    }
    this.limit = lim;
    this.frame = -1;
  }

  // A text line box starts above the letters (the font's ascent is taller than its glyphs).
  // Measure where the ink starts so the creature stands on the letters, not on the air above.
  private inkOffset(el: Element): number {
    if (!this.ink) return 0;
    const cs = getComputedStyle(el);
    const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const text = (el.textContent ?? "").trim().slice(0, 80);
    const key = `${font}|${text}`;
    let off = this.inkCache.get(key);
    if (off === undefined) {
      this.ink.font = font;
      const m = this.ink.measureText(text);
      off = Math.max(0, m.fontBoundingBoxAscent - m.actualBoundingBoxAscent);
      if (this.inkCache.size > 500) this.inkCache.clear();
      this.inkCache.set(key, off);
    }
    return off;
  }

  private box(el: Element): { left: number; right: number; top: number; text: boolean } {
    if (el.matches(TEXT) && !el.querySelector("img,video,table,form,button,input")) {
      // the first line of actual text, not the whole (often much wider) block
      this.range.selectNodeContents(el);
      const lines = [...this.range.getClientRects()].filter((r) => r.width > 2);
      if (lines.length) {
        const top = Math.min(...lines.map((r) => r.top));
        const first = lines.filter((r) => r.top < top + 4);
        return { left: Math.min(...first.map((r) => r.left)), right: Math.max(...first.map((r) => r.right)), top: top + this.inkOffset(el), text: true };
      }
    }
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, text: false };
  }

  /** Platforms with fresh positions. Cached per frame number. */
  plats(frameNo: number): Plat[] {
    if (this.frame === frameNo) return this.cache;
    this.frame = frameNo;
    const W = this.W;
    const min = this.topLimit + 10;
    const out: Plat[] = [];
    for (const el of this.els) {
      if (!el.isConnected || this.occluded.has(el)) continue;
      const b = this.box(el);
      if (b.right - b.left > W * 0.6 && b.top > min && b.top < innerHeight - 4) out.push({ el, ...b, goal: this.goals.has(el) });
    }
    return (this.cache = out);
  }

  /** the thing to point at inside a goal platform */
  pressable(host: Element): Element {
    return host.matches(PRESS) ? host : host.querySelector("button,[type=submit],a,[role=button]") ?? host;
  }

  /** where to point at: the press target of the goal nearest the middle of the screen */
  goalTarget(plats: Plat[]): Element | null {
    const g = plats.filter((p) => p.goal).sort((a, b) => Math.abs(a.top - innerHeight * 0.55) - Math.abs(b.top - innerHeight * 0.55))[0];
    return g ? this.pressable(g.el) : null;
  }
}

export { PRESS };
