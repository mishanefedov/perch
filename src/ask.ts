// "Ask": the creature asks the visitor a question in a small speech bubble. You set the text, up to
// three buttons, and what each button does (open a link, copy text, scroll, click an element, send an
// event, or just close). While the bubble is up the creature stands still, and the bubble goes away as
// soon as the visitor scrolls. It lives in a shadow root, so the page's CSS cannot touch it.

export type AskAction = "link" | "copy" | "scroll" | "click" | "event" | "close";
export type AskOnce = "session" | "forever" | "always";

export interface AskButton {
  label: string;
  /** default: "link" when there is a value, else "close" */
  action?: AskAction;
  /** link: the URL. copy: the text. scroll and click: a CSS selector. event: the event name */
  value?: string;
  /** link only: open in a new tab */
  newTab?: boolean;
}

export interface AskOptions {
  text: string;
  buttons?: AskButton[];
  /** seconds on the page before it shows. Default 6 */
  delay?: number;
  /** how often one visitor sees it: once per browser session (default), once ever, or on every visit */
  once?: AskOnce;
  /** remembers that it was seen under this name. Default: made from the text and the buttons */
  id?: string;
}

export interface AskResolved {
  text: string;
  buttons: (Required<Pick<AskButton, "label" | "action">> & { value: string; newTab: boolean })[];
  delay: number;
  once: AskOnce;
  id: string;
}

export const ASK_ACTIONS: AskAction[] = ["link", "copy", "scroll", "click", "event", "close"];
export const ASK_LIMITS = { text: 200, buttons: 3, label: 40, value: 500, delayMax: 60 };

/** http(s), mailto, tel and relative URLs only: never javascript: or data: */
export function safeUrl(value: string, base?: string): string | null {
  try {
    const u = new URL(value, base ?? (typeof location !== "undefined" ? location.href : "https://example.com/"));
    return ["http:", "https:", "mailto:", "tel:"].includes(u.protocol) ? u.href : null;
  } catch { return null; }
}

/** Every problem with an ask, in plain words. Empty list = valid. */
export function validateAsk(input: unknown): string[] {
  const errs: string[] = [];
  if (!input || typeof input !== "object") return ["ask must be an object like { text, buttons }"];
  const a = input as Record<string, unknown>;
  if (typeof a.text !== "string" || !a.text.trim()) errs.push("text is required");
  else if (a.text.length > ASK_LIMITS.text) errs.push(`text is longer than ${ASK_LIMITS.text} characters`);
  if (a.delay !== undefined && (typeof a.delay !== "number" || a.delay < 0 || a.delay > ASK_LIMITS.delayMax)) errs.push(`delay must be a number from 0 to ${ASK_LIMITS.delayMax}`);
  if (a.once !== undefined && !["session", "forever", "always"].includes(a.once as string)) errs.push('once must be "session", "forever" or "always"');
  if (a.id !== undefined && typeof a.id !== "string") errs.push("id must be a string");
  if (a.buttons !== undefined) {
    if (!Array.isArray(a.buttons)) errs.push("buttons must be a list");
    else {
      if (a.buttons.length > ASK_LIMITS.buttons) errs.push(`at most ${ASK_LIMITS.buttons} buttons`);
      a.buttons.forEach((b, i) => {
        const n = `button ${i + 1}`;
        if (!b || typeof b !== "object") { errs.push(`${n} must be an object`); return; }
        const x = b as Record<string, unknown>;
        if (typeof x.label !== "string" || !x.label.trim()) errs.push(`${n}: label is required`);
        else if (x.label.length > ASK_LIMITS.label) errs.push(`${n}: label is longer than ${ASK_LIMITS.label} characters`);
        const action = (x.action ?? (x.value ? "link" : "close")) as string;
        if (!ASK_ACTIONS.includes(action as AskAction)) { errs.push(`${n}: action must be one of ${ASK_ACTIONS.join(", ")}`); return; }
        if (action !== "close" && (typeof x.value !== "string" || !x.value.trim())) errs.push(`${n}: ${action} needs a value`);
        else if (typeof x.value === "string" && x.value.length > ASK_LIMITS.value) errs.push(`${n}: value is longer than ${ASK_LIMITS.value} characters`);
        else if (action === "link" && typeof x.value === "string" && !safeUrl(x.value, "https://example.com/")) errs.push(`${n}: link must be an http(s), mailto or tel URL, or a relative path`);
      });
    }
  }
  return errs;
}

const hash = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };

/** Lenient version used at runtime: drops what is invalid, clamps numbers. Null when there is nothing to show. */
export function normalizeAsk(input: unknown): AskResolved | null {
  if (!input || typeof input !== "object") return null;
  const a = input as AskOptions;
  const text = typeof a.text === "string" ? a.text.trim().slice(0, ASK_LIMITS.text) : "";
  if (!text) return null;
  const buttons = (Array.isArray(a.buttons) ? a.buttons : []).slice(0, ASK_LIMITS.buttons).flatMap((b) => {
    if (!b || typeof b.label !== "string" || !b.label.trim()) return [];
    const value = typeof b.value === "string" ? b.value.slice(0, ASK_LIMITS.value) : "";
    const action = (b.action && ASK_ACTIONS.includes(b.action) ? b.action : value ? "link" : "close") as AskAction;
    if (action !== "close" && !value) return [];
    return [{ label: b.label.trim().slice(0, ASK_LIMITS.label), action, value, newTab: !!b.newTab }];
  });
  const delay = typeof a.delay === "number" && a.delay >= 0 ? Math.min(a.delay, ASK_LIMITS.delayMax) : 6;
  const once: AskOnce = a.once === "forever" || a.once === "always" ? a.once : "session";
  return { text, buttons, delay, once, id: typeof a.id === "string" && a.id ? a.id : hash(text + buttons.map((b) => b.label + b.value).join("|")) };
}

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; font: 15px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.bubble { position: fixed; left: 0; top: 0; max-width: min(300px, calc(100vw - 16px)); background: #fff; color: #111; border-radius: 14px; padding: 12px 34px 12px 14px; box-shadow: 0 10px 30px #0004, 0 0 0 1px #0001; opacity: 0; pointer-events: none; transition: opacity .2s; }
.bubble.on { opacity: 1; pointer-events: auto; }
.q { margin: 0; font-weight: 600; word-break: break-word; }
.btns { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.b { border: 1px solid #0003; background: #f3f3f3; color: #111; border-radius: 9px; padding: 6px 12px; font-weight: 600; font-size: 14px; cursor: pointer; text-decoration: none; display: inline-block; }
.b:hover { background: #e7e7e7; }
.b.primary { background: #e5484d; border-color: #e5484d; color: #fff; }
.b.primary:hover { background: #d63a40; }
.x { position: absolute; top: 4px; right: 6px; border: 0; background: none; color: #666; font-size: 20px; line-height: 1; padding: 2px 6px; border-radius: 6px; cursor: pointer; }
.x:hover { color: #000; background: #0001; }
.bubble::after { content: ""; position: absolute; left: var(--tail, 50%); bottom: -7px; width: 14px; height: 14px; background: #fff; transform: translateX(-50%) rotate(45deg); box-shadow: 2px 2px 2px #0002; }
.bubble.below::after { bottom: auto; top: -7px; box-shadow: -2px -2px 2px #0002; }
:focus-visible { outline: 2px solid #f59e0b; outline-offset: 2px; }
@media (prefers-color-scheme: dark) {
  .bubble { background: #1b1b1d; color: #eee; box-shadow: 0 10px 30px #0008, 0 0 0 1px #fff2; } .bubble::after { background: #1b1b1d; }
  .b { background: #2a2a2d; color: #eee; border-color: #fff3; } .b:hover { background: #38383c; } .x { color: #aaa; } .x:hover { color: #fff; background: #fff2; }
}
@media (prefers-reduced-motion: reduce) { .bubble { transition: none; } }`;

export interface AskController {
  /** new content: while it is up it updates in place, otherwise it is scheduled again */
  set(ask: AskResolved | null): void;
  /** show now. `preview` ignores (and does not set) the "already seen" flag */
  show(preview?: boolean): void;
  hide(reason?: string): void;
  destroy(): void;
}

interface Hooks {
  /** where the creature is: the bubble points at it */
  anchor(): DOMRect;
  zIndex: number;
  /** true while the bubble is up (the creature stands still), false when it is gone */
  onVisible(visible: boolean): void;
  /** the scheduled question waits until this is true (the creature has landed in view), for at most 8 seconds */
  ready(): boolean;
}

const store = (once: AskOnce) => { try { return once === "forever" ? localStorage : sessionStorage; } catch { return null; } };
const key = (id: string) => `perch-ask:${id}`;

export function createAsk(hooks: Hooks): AskController {
  const host = document.createElement("div");
  host.setAttribute("data-perch-root", "");
  host.style.cssText = `position:fixed;left:0;top:0;z-index:${hooks.zIndex};pointer-events:none;`;
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>${CSS}</style><div class="bubble" role="status" aria-live="polite"><button class="x" type="button" aria-label="Close">×</button><p class="q"></p><div class="btns"></div></div>`;
  const bubble = root.querySelector(".bubble") as HTMLElement;
  const q = root.querySelector(".q") as HTMLElement;
  const btns = root.querySelector(".btns") as HTMLElement;
  document.body.appendChild(host);

  let ask: AskResolved | null = null;
  let timer = 0;
  let visible = false;
  let preview = false;
  let y0 = 0, x0 = 0;

  const seen = (a: AskResolved) => a.once !== "always" && store(a.once)?.getItem(key(a.id)) === "1";
  const remember = (a: AskResolved) => { if (a.once !== "always") try { store(a.once)?.setItem(key(a.id), "1"); } catch { /* storage can be blocked */ } };

  function place() {
    const r = hooks.anchor();
    const w = bubble.offsetWidth, h = bubble.offsetHeight;
    const cx = r.left + r.width / 2;
    const x = Math.min(Math.max(8, cx - w / 2), innerWidth - w - 8);
    const above = r.top - h - 12 >= 8;
    bubble.classList.toggle("below", !above);
    bubble.style.setProperty("--tail", Math.min(Math.max(18, cx - x), w - 18) + "px");
    const y = Math.min(Math.max(8, above ? r.top - h - 12 : r.bottom + 12), innerHeight - h - 8); // always on screen
    bubble.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  function run(b: AskResolved["buttons"][number], el: HTMLElement) {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (b.action === "copy") {
      void navigator.clipboard?.writeText(b.value).catch(() => {});
      el.textContent = "Copied";
      setTimeout(() => hide("action"), 900);
      return;
    }
    if (b.action === "scroll") (document.querySelector(b.value) as HTMLElement | null)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    else if (b.action === "click") (document.querySelector(b.value) as HTMLElement | null)?.click();
    else if (b.action === "event") window.dispatchEvent(new CustomEvent(b.value || "perch:ask", { detail: { label: b.label } }));
    hide("action");
  }

  function render(a: AskResolved) {
    q.textContent = a.text;
    btns.textContent = "";
    a.buttons.forEach((b, i) => {
      const url = b.action === "link" ? safeUrl(b.value) : null;
      const el = (url ? document.createElement("a") : document.createElement("button")) as HTMLElement;
      el.className = "b" + (i === 0 ? " primary" : "");
      el.textContent = b.label;
      if (url) {
        (el as HTMLAnchorElement).href = url;
        if (b.newTab) { (el as HTMLAnchorElement).target = "_blank"; (el as HTMLAnchorElement).rel = "noopener"; }
        el.addEventListener("click", () => hide("action"));
      } else {
        (el as HTMLButtonElement).type = "button";
        el.addEventListener("click", () => run(b, el));
      }
      btns.appendChild(el);
    });
    btns.hidden = a.buttons.length === 0;
  }

  const onScroll = () => { if (Math.abs(scrollY - y0) > 4 || Math.abs(scrollX - x0) > 4) hide("scroll"); };
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") hide("escape"); };
  const onResize = () => place();

  function show(isPreview = false) {
    if (!ask) return;
    if (!isPreview && (visible || seen(ask))) return;
    clearTimeout(timer);
    preview = isPreview;
    render(ask);
    y0 = scrollY; x0 = scrollX;
    bubble.classList.add("on");
    place();
    if (!visible) {
      visible = true;
      addEventListener("scroll", onScroll, { passive: true });
      addEventListener("keydown", onKey);
      addEventListener("resize", onResize);
      hooks.onVisible(true);
    }
  }

  function hide(_reason = "close") {
    if (!visible) return;
    visible = false;
    bubble.classList.remove("on");
    removeEventListener("scroll", onScroll);
    removeEventListener("keydown", onKey);
    removeEventListener("resize", onResize);
    if (ask && !preview) remember(ask);
    preview = false;
    hooks.onVisible(false);
  }

  const schedule = () => {
    clearTimeout(timer);
    if (!ask || seen(ask)) return;
    let waited = 0;
    const fire = () => {
      if (document.hidden) { document.addEventListener("visibilitychange", fire, { once: true }); return; }
      if (!hooks.ready() && waited < 8000) { waited += 150; timer = window.setTimeout(fire, 150); return; }
      show();
    };
    timer = window.setTimeout(fire, ask.delay * 1000);
  };

  (root.querySelector(".x") as HTMLElement).addEventListener("click", () => hide("close"));

  return {
    set(next) {
      ask = next;
      if (!next) { clearTimeout(timer); hide("removed"); return; }
      if (visible) { render(next); place(); } else schedule();
    },
    show,
    hide,
    destroy() { clearTimeout(timer); hide("destroy"); host.remove(); },
  };
}
