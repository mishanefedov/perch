// Script-tag build: <script src="/perch.js" data-creature="blob" defer></script>
// Starts by itself, reads data-* attributes, and on localhost also loads perch-tuner.js
// from the same folder. Visitors on a live site never download the tuner.
import { api, boot, tunerWanted } from "./api";
import { fromScript, type PerchOptions } from "./config";

declare global {
  interface Window { Perch: unknown; PERCH?: PerchOptions; PerchTuner?: { mount(api: unknown): () => void; selectorFor(el: Element): string } }
}

const tag = (document.currentScript as HTMLScriptElement | null) ?? document.querySelector<HTMLScriptElement>("script[src*='perch']");
const fromTag = fromScript(tag);
window.Perch = { ...api };

const clean = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

function loadTuner() {
  if (!tag?.src) return;
  const s = document.createElement("script");
  s.src = tag.src.replace(/perch(\.min)?\.js(\?.*)?$/, "perch-tuner.js");
  s.onload = () => window.PerchTuner?.mount(api);
  s.onerror = () => console.info("perch: tuner file not found next to perch.js (run `npx perch-pet` again to copy it)");
  document.head.appendChild(s);
}

if (tag && fromTag.auto) {
  const go = () => {
    const { auto: _auto, ...fromAttrs } = fromTag;
    void boot({ ...clean(fromAttrs), ...(window.PERCH ?? {}) });
    if (tunerWanted(tag.dataset.tuner)) loadTuner();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go, { once: true });
  else go();
}
