import type { CreatureSpec } from "../creature";

export const robot: CreatureSpec = {
  name: "robot",
  cols: 28,
  rows: 16,
  offset: [4, 2],
  palette: { M: "#94a3b8", D: "#64748b", B: "#38bdf8" },
  body: [
    ".........BB.........",
    "..MMMMMMMMMMMMMMMM..",
    "..MMMMMMMMMMMMMMMM..",
    "..MMMMMMMMMMMMMMMM..",
    "..DMMMMMMMMMMMMMMD..",
    "..DMMMMMMMMMMMMMMD..",
    "..DMMMMMMMMMMMMMMD..",
    "..DMMMMMMMMMMMMMMD..",
    "..MMMMMMMMMMMMMMMM..",
    "..DDDDDDDDDDDDDDDD..",
  ],
  legs: [
    ["...DDDDDDDDDDDDDD...", "...MMM........MMM...", "..MMMM........MMMM.."],
    ["...DDDDDDDDDDDDDD...", "....MMM......MMM....", "...MMMM......MMMM..."],
  ],
  arms: {
    rest: [[22, 10], [23, 11], [23, 12]],
    point: [[22, 9], [23, 9], [24, 9], [25, 9], [26, 9]],
    wave: [[22, 8], [23, 7], [23, 6], [24, 5], [24, 4]],
    hold: [[22, 10], [23, 11], [24, 12]],
    brace: [[22, 8], [23, 7], [23, 6], [23, 5], [23, 4], [23, 3]],
  },
  eyes: { left: [9, 6], right: [15, 6] },
  eyeColors: { white: "#e0f2fe", pupil: "#0c4a6e" },
  armColor: "#94a3b8",
};
