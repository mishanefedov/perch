// Library entry (bundlers): import { init } from "perch-pet"
import { api, tunerWanted } from "./api";

export * from "./api";

/** Opens the tuner panel (a gear button) in this page. Development only. */
export async function tune(): Promise<void> {
  const { mountTuner } = await import("./tuner");
  mountTuner(api);
}

export { tunerWanted };
