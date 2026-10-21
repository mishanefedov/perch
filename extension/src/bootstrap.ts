// Content script. perch-ext.js and perch-tuner.js run first and define window.Perch and window.PerchTuner
// (in this extension's own isolated world, so the page cannot see or change them). This file starts the
// creature with the saved settings, opens the tuner panel on request, and saves what the panel changes.
import { DEFAULTS, load, loadRule, perchOptions, save, saveRule } from "./settings";

interface Opts { creature?: string | object; scale?: number; speed?: number; stickiness?: number; goal?: string; ignore?: string; topOffset?: number }
type PerchGlobal = { init(o: object): unknown; destroy(): void };
type TunerGlobal = { mount(api: unknown, hooks: object): () => void };
interface State { active: boolean; tunerMounted: boolean; listening: boolean; selfWrites: number }
const world = window as unknown as { Perch: PerchGlobal; PerchTuner: TunerGlobal; __perchExt?: State };

// The scripts can be injected again (the popup's Show button, the shortcut), and every injection runs this
// file once more. The state therefore lives on one shared object, not in variables of this run.
const st: State = (world.__perchExt ??= { active: false, tunerMounted: false, listening: false, selfWrites: 0 });

async function show() {
  const [s, rule] = await Promise.all([load(), loadRule(location.origin)]);
  world.Perch.init(perchOptions(s, rule));
  st.active = true;
}
function hide() {
  world.Perch.destroy();
  st.active = false;
}

/** The tuner changed something: the creature and sliders are global, the rest belongs to this site. */
function persist(opts: Opts) {
  const custom = typeof opts.creature === "object" ? opts.creature : undefined;
  const global: Record<string, unknown> = {
    creature: custom ? "custom" : opts.creature ?? DEFAULTS.creature,
    scale: opts.scale ?? DEFAULTS.scale,
    speed: opts.speed ?? DEFAULTS.speed,
    stickiness: opts.stickiness ?? DEFAULTS.stickiness,
  };
  if (custom) global.custom = custom;
  st.selfWrites++; // our own saves must not restart the creature the tuner is showing
  void Promise.all([save(global), saveRule(location.origin, { goal: opts.goal, ignore: opts.ignore, topOffset: opts.topOffset })])
    .finally(() => setTimeout(() => { st.selfWrites--; }, 700));
}

async function openTuner() {
  if (!st.active) await show();
  if (!st.tunerMounted) {
    world.PerchTuner.mount(world.Perch, { extension: true, gear: false, onChange: persist });
    st.tunerMounted = true;
  }
  window.dispatchEvent(new Event("perch:tuner"));
}

if (!st.listening) {
  st.listening = true;
  chrome.runtime.onMessage.addListener((msg: { type?: string }, _sender, reply) => {
    const done = () => reply({ active: st.active });
    if (msg.type === "perch:status") done();
    else if (msg.type === "perch:show") void show().then(done);
    else if (msg.type === "perch:hide") { hide(); done(); }
    else if (msg.type === "perch:toggle") void (st.active ? Promise.resolve(hide()) : show()).then(done);
    else if (msg.type === "perch:tuner") void openTuner().then(done);
    else return false;
    return true; // the reply is async
  });
  // settings changed in the popup: apply them to a creature that is already on this page
  chrome.storage.onChanged.addListener(() => { if (st.active && st.selfWrites === 0) void show(); });
}
void show();
