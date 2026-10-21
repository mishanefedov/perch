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

export function selectorFor(el: Element): string {
  if (el.id && !NOISY.test(el.id) && unique("#" + esc(el.id), el)) return "#" + esc(el.id);
  for (const a of STABLE_ATTRS) {
    const v = el.getAttribute(a);
    if (v && v.length < 40) {
      const sel = `${el.tagName.toLowerCase()}[${a}="${v.replace(/"/g, '\\"')}"]`;
      if (unique(sel, el)) return sel;
    }
  }
  // climb: try the element alone with 0, 1, 2 classes, then add parents until it is unique
  const chain: Element[] = [];
  for (let n: Element | null = el; n && n !== document.documentElement; n = n.parentElement) chain.push(n);
  for (let depth = 1; depth <= chain.length; depth++) {
    for (const classes of [1, 2, 0]) {
      const parts = chain.slice(0, depth).map((n, i) => segment(n, i === 0 ? classes : 1));
      let sel = parts.reverse().join(" > ");
      if (unique(sel, el)) return sel;
      // same, with an nth-of-type on the element itself
      const idx = [...(el.parentElement?.children ?? [])].filter((c) => c.tagName === el.tagName).indexOf(el) + 1;
      if (idx > 0) {
        const withNth = parts.slice();
        withNth[withNth.length - 1] += `:nth-of-type(${idx})`;
        sel = withNth.join(" > ");
        if (unique(sel, el)) return sel;
      }
    }
  }
  return el.tagName.toLowerCase();
}
