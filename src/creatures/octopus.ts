import type { CreatureSpec } from "../creature";

export const octopus: CreatureSpec = {
  name: "octopus",
  cols: 28,
  rows: 17,
  offset: [4, 2],
  palette: { R: "#e5484d", D: "#b8323a" },
  body: [
    "......RRRRRRRR......",
    "....RRRRRRRRRRRR....",
    "...RRRRDRRRRRRRRR...",
    "..RRRRRRRRRRRRDRRR..",
    "..RRRRRRRRRRRRRRRR..",
    "..RRRRRRRRRRRRRRRR..",
    "..RRRRRRRRRRRRRRRR..",
    "..RRRRRRRRRRRRRRRR..",
    "...RRRRRRRRRRRRRR...",
    "...RRRRRRRRRRRRRR...",
  ],
  legs: [
    ["...RRRRRRRRRRRRRR...", "..RR.RR.RR.RR.RR.RR.", ".RR..R...RR...R..RR.", ".R...R...R....R...R."],
    ["...RRRRRRRRRRRRRR...", "..RR.RR.RR.RR.RR.RR.", "..RR.R..RR..R..RR...", "...R.R...R..R...R..."],
  ],
  arms: {
    rest: [[22, 10], [23, 11], [23, 12], [22, 13]],
    point: [[22, 9], [23, 9], [24, 9], [25, 9], [26, 8], [26, 9], [26, 10]],
    wave: [[22, 8], [23, 7], [23, 6], [24, 5], [24, 4], [25, 3]],
    hold: [[22, 10], [23, 11], [24, 12], [25, 13]],
    brace: [[22, 8], [23, 7], [23, 6], [23, 5], [23, 4], [23, 3], [22, 2], [23, 2], [24, 2]],
  },
  eyes: { left: [9, 6], right: [15, 6] },
  eyeColors: { white: "#ffffff", pupil: "#0d1526" },
};
