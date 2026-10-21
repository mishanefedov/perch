// perch-tuner.js: the panel as its own file, loaded only in development.
import { mountTuner } from "./tuner";
import { selectorFor } from "./selector";

(window as unknown as { PerchTuner: unknown }).PerchTuner = { mount: mountTuner, selectorFor };
