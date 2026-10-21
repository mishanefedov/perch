// A creature is plain data: ASCII pixel rows plus a palette. Draw your own by editing the
// strings. "." is empty, any other character is looked up in `palette`.

export type Face = "look" | "happy" | "blink" | "wow";
export type ArmName = "rest" | "point" | "wave" | "hold" | "brace";

export interface CreatureSpec {
  name: string;
  /** canvas size in sprite pixels */
  cols: number;
  rows: number;
  /** top-left of the body inside the canvas */
  offset: [number, number];
  /** character -> css colour. "." is always empty */
  palette: Record<string, string>;
  body: string[];
  /** two leg frames, drawn under the body. Used for walking and idle wiggle */
  legs: [string[], string[]];
  /** right-arm poses as canvas coordinates; the left arm is the mirror image */
  arms: Record<ArmName, [number, number][]>;
  /** top-left of each 4x4 eye, relative to the canvas */
  eyes: { left: [number, number]; right: [number, number] };
  eyeColors: { white: string; pupil: string };
  /** colour used for arms (defaults to palette.R) */
  armColor?: string;
}

export interface Pose {
  left: ArmName;
  right: ArmName;
  face: Face;
  legs: 0 | 1;
  px: number;
  py: number;
  flip: boolean;
  /** current size in sprite pixels (squash and stretch) */
  w: number;
  h: number;
}

type Grid = (string | null)[][];

export function validate(spec: CreatureSpec): string[] {
  const errs: string[] = [];
  if (!spec.body?.length) errs.push("body is empty");
  for (const [i, f] of (spec.legs ?? []).entries()) if (!f?.length) errs.push(`legs[${i}] is empty`);
  if (!spec.legs || spec.legs.length !== 2) errs.push("legs needs exactly 2 frames");
  for (const n of ["rest", "point", "wave", "hold", "brace"] as const) if (!spec.arms?.[n]) errs.push(`arms.${n} is missing`);
  const used = new Set<string>();
  for (const r of [...(spec.body ?? []), ...(spec.legs?.[0] ?? []), ...(spec.legs?.[1] ?? [])]) for (const c of r) if (c !== ".") used.add(c);
  for (const c of used) if (!spec.palette?.[c]) errs.push(`palette has no colour for "${c}"`);
  return errs;
}

export function buildGrid(spec: CreatureSpec, pose: Pose): Grid {
  const { cols, rows, offset: [ox, oy] } = spec;
  const g: Grid = Array.from({ length: rows }, () => Array(cols).fill(null));
  const put = (x: number, y: number, c: string) => {
    if (x >= 0 && x < cols && y >= 0 && y < rows) g[y][x] = c;
  };
  const arm = spec.armColor ?? spec.palette.R ?? Object.values(spec.palette)[0];
  const paint = (r: string, y: number, dx = 0, dy = 0) =>
    [...r].forEach((c, x) => c !== "." && put(x + ox + dx, y + oy + dy, spec.palette[c]));
  spec.body.forEach((r, y) => paint(r, y));
  spec.legs[pose.legs].forEach((r, y) => paint(r, y, 0, spec.body.length));
  spec.arms[pose.right].forEach(([x, y]) => put(x, y, arm));
  spec.arms[pose.left].forEach(([x, y]) => put(cols - 1 - x, y, arm));
  const { white, pupil } = spec.eyeColors;
  for (const [ex, ey] of [spec.eyes.left, spec.eyes.right]) {
    if (pose.face === "happy") {
      put(ex, ey + 2, pupil); put(ex + 1, ey + 1, pupil); put(ex + 2, ey + 1, pupil); put(ex + 3, ey + 2, pupil);
    } else if (pose.face === "blink") {
      for (let i = 0; i < 4; i++) put(ex + i, ey + 2, pupil);
    } else {
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) put(ex + i, ey + j, white);
      if (pose.face === "wow") put(ex + 1 + Math.max(0, pose.px), ey + 1 + Math.max(0, pose.py), pupil);
      else for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) put(ex + 1 + pose.px + i, ey + 1 + pose.py + j, pupil);
    }
  }
  if (pose.flip) g.forEach((row) => row.reverse());
  return g;
}

/** Draws the pose to a canvas. Squash and stretch resamples the grid to w x h cells
 *  (nearest neighbour), anchored at the feet, so every pixel stays a whole crisp square. */
export function draw(ctx: CanvasRenderingContext2D, spec: CreatureSpec, pose: Pose, scale: number): void {
  const g = buildGrid(spec, pose);
  const { w, h } = pose;
  const { cols, rows } = spec;
  ctx.clearRect(0, 0, cols * scale, rows * scale);
  const left = Math.round(((cols - w) * scale) / 2);
  const top = (rows - h) * scale;
  for (let j = 0; j < h; j++) {
    const sy = Math.floor(((j + 0.5) * rows) / h);
    let run: { c: string; x: number } | null = null;
    for (let i = 0; i <= w; i++) {
      const sx = Math.floor(((i + 0.5) * cols) / w);
      const c = i < w ? g[sy]?.[sx] ?? null : null;
      if (run && c !== run.c) {
        ctx.fillStyle = run.c;
        ctx.fillRect(left + run.x * scale, top + j * scale, (i - run.x) * scale, scale + 0.5);
        run = null;
      }
      if (c && !run) run = { c, x: i };
    }
  }
}
