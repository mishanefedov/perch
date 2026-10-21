// import "perch-pet/auto": starts the creature with the options from window.PERCH (or defaults),
// and shows the tuner on localhost. One line, no other code.
import { api, boot, tunerWanted } from "./api";
import type { PerchOptions } from "./config";

if (typeof document !== "undefined") {
  const opts = ((window as unknown as { PERCH?: PerchOptions }).PERCH ?? {}) as PerchOptions;
  const go = () => {
    void boot(opts);
    if (tunerWanted()) void import("./tuner").then((m) => m.mountTuner(api));
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go, { once: true });
  else go();
}
