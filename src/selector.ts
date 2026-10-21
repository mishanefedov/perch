// Builds a short, stable CSS selector for an element the visitor clicked in the tuner.
// It avoids classes that look generated (hashes, CSS modules) and checks that the result
// matches the element.

const STABLE_ATTRS = ["data-testid", "data-test", "data-cy", "data-qa", "data-perch", "aria-label", "name"];
const GOOD_CLASS = /^[A-Za-z][A-Za-z-]{2,24}$/;
// generated-looking pieces: long mixed letters/digits, or css-module style names
const NOISY = /[0-9]{3,}|^(css|sc|jsx|svelte|astro|emotion)-|^_/;

const q = (sel: string): Element[] => {
  try { return [...document.querySelectorAll(sel)]; } catch { return []; }
};
const unique = (sel: string, el: Element) => {
  const hits = q(sel);
  return hits.length === 1 && hits[0] === el;
};
const esc = (s: string) => (typeof CSS !== "undefined" && CSS.escape ? CSS.escape(s) : s.replace(/[^\w-]/g, "\\$&"));

function segment(el: Element, withClasses: number): string {
  const tag = el.tagName.toLowerCase();
  if (withClasses === 0) return tag;
  const classes = [...el.classList].filter((c) => GOOD_CLASS.test(c) && !NOISY.test(c)).slice(0, withClasses);
  return tag + classes.map((c) => "." + esc(c)).join("");
}

/** `tag.class` plus `:nth-of-type(n)` when same-tag siblings exist and `nth` is on */
function segmentNth(el: Element, classes: number, nth: boolean): string {
  let seg = segment(el, classes);
  if (nth) {
    const same = [...(el.parentElement?.children ?? [])].filter((c) => c.tagName === el.tagName);
    if (same.length > 1) seg += `:nth-of-type(${same.indexOf(el) + 1})`;
  }
  return seg;
}

/** A selector that matches this element and nothing else, as short and readable as it can be. */
export function selectorFor(el: Element): string {
  if (el.id && !NOISY.test(el.id) && unique("#" + esc(el.id), el)) return "#" + esc(el.id);
  for (const a of STABLE_ATTRS) {
    const v = el.getAttribute(a);
    if (v && v.length < 40) {
      const sel = `${el.tagName.toLowerCase()}[${a}="${v.replace(/"/g, '\\"')}"]`;
      if (unique(sel, el)) return sel;
    }
  }
  const chain: Element[] = [];
  for (let n: Element | null = el; n && n !== document.documentElement; n = n.parentElement) chain.push(n);
  // shortest first: the element alone, then with parents; plain, then with positions among siblings
  for (let depth = 1; depth <= chain.length; depth++) {
    for (const nth of [false, true]) {
      for (const classes of [1, 2, 0]) {
        const sel = chain.slice(0, depth).map((n, i) => segmentNth(n, i === 0 ? classes : 1, nth)).reverse().join(" > ");
        if (unique(sel, el)) return sel;
      }
    }
  }
  // cannot happen for an element in the document: a full positional path is unique by construction
  return chain.map((n) => segmentNth(n, 0, true)).reverse().join(" > ");
}

/** How many elements on the page a selector matches (the tuner and the creature itself do not count). */
export function countMatches(sel: string): number {
  return q(sel).filter((e) => !e.closest("[data-perch-root],[data-perch-tuner]")).length;
}
