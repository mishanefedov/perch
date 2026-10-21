import type { CreatureSpec } from "../creature";

// A second creature, mostly to prove the format: a green blob with stub feet.
export const blob: CreatureSpec = {
  name: "blob",
  cols: 28,
  rows: 16,
  offset: [4, 2],
  palette: { G: "#3fb950", D: "#2a8a3b" },
  body: [
    "......GGGGGGGG......",
    "....GGGGGGGGGGGG....",
    "...GGGGGGGGGGGGGG...",
    "..GGGGGGGGGGGGGGGG..",
    "..GGGGGGGGGGGGGGGG..",
    "..GGGGGGGGGGGGGGGG..",
    "..GGGGGGGGGGGGGGGG..",
    "..GGGGGGGGGGGGGGGG..",
    "...GGGGGGGGGGGGGG...",
    "...GGGGGGGGGGGGGG...",
  ],
  legs: [
    ["...GGGGGGGGGGGGGG...", "...GGG........GGG...", "...DDD........DDD..."],
    ["...GGGGGGGGGGGGGG...", "....GGG......GGG....", "....DDD......DDD...."],
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
  armColor: "#3fb950",
};
