// Build for the browser extension: only exposes window.Perch. It never reads script tags and never
// loads the tuner, so a page that happens to have a script with "perch" in its URL cannot affect it.
import { api } from "./api";

const w = window as unknown as { Perch?: unknown };
if (!w.Perch) w.Perch = api; // injected twice: keep the first instance, so there is never a second creature
