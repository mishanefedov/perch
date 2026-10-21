import type { CreatureSpec } from "../creature";

export const ghost: CreatureSpec = {
  name: "ghost",
  cols: 28,
  rows: 16,
  offset: [4, 2],
  palette: { W: "#c7d2fe", S: "#818cf8" },
  body: [
    "......WWWWWWWW......",
    "....WWWWWWWWWWWW....",
    "...WWWWWWWWWWWWWW...",
    "..WWWWWWWWWWWWWWWW..",
    "..WWWWWWWWWWWWWWWW..",
    "..WWWWWWWWWWWWWWWW..",
    "..WWWWWWWWWWWWWWWW..",
    "..WWWWWWWWWWWWWWWW..",
    "..WWWWWWWWWWWWWWWW..",
    "..WWWWWWWWWWWWWWWW..",
  ],
  legs: [
    ["..WWWWWWWWWWWWWWWW..", "..WW.WWW.WWW.WWW.WW.", "..W...W...W...W...W."],
    ["..WWWWWWWWWWWWWWWW..", "..WWW.WWW.WWW.WWW.W.", "..W...W...W...W...W."],
  ],
  arms: {
    rest: [[22, 10], [23, 11], [23, 12]],
    point: [[22, 9], [23, 9], [24, 9], [25, 9], [26, 9]],
    wave: [[22, 8], [23, 7], [23, 6], [24, 5], [24, 4]],
    hold: [[22, 10], [23, 11], [24, 12]],
    brace: [[22, 8], [23, 7], [23, 6], [23, 5], [23, 4], [23, 3]],
  },
  eyes: { left: [9, 6], right: [15, 6] },
  eyeColors: { white: "#ffffff", pupil: "#1e1b4b" },
  armColor: "#c7d2fe",
};
