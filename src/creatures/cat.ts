import type { CreatureSpec } from "../creature";

export const cat: CreatureSpec = {
  name: "cat",
  cols: 28,
  rows: 16,
  offset: [4, 2],
  palette: { O: "#f59e0b", D: "#b45309", P: "#fbcfe8" },
  body: [
    "..OPO..........OPO..",
    "..OOOO........OOOO..",
    "..OOODOOOOOOOODOOO..",
    "..OOOOOOOOOOOOOOOO..",
    "..OOOOOOOOOOOOOOOO..",
    "..OOOOOOOOOOOOOOOO..",
    "..OOOOOOOOOOOOOOOO..",
    "..OOOOOOOOOOOOOOOO..",
    "...OOOOOOOOOOOOOO...",
    "...OOOOOOOOOOOOOO...",
  ],
  legs: [
    ["...OOOOOOOOOOOOOO...", "...OOO........OOO...", "...DDD........DDD..."],
    ["...OOOOOOOOOOOOOO...", "....OOO......OOO....", "....DDD......DDD...."],
  ],
  arms: {
    rest: [[22, 10], [23, 11], [23, 12]],
    point: [[22, 9], [23, 9], [24, 9], [25, 9], [26, 9]],
    wave: [[22, 8], [23, 7], [23, 6], [24, 5], [24, 4]],
    hold: [[22, 10], [23, 11], [24, 12]],
    brace: [[22, 8], [23, 7], [23, 6], [23, 5], [23, 4], [23, 3]],
  },
  eyes: { left: [9, 6], right: [15, 6] },
  eyeColors: { white: "#ffffff", pupil: "#0d1526" },
  armColor: "#f59e0b",
};
