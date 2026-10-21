import type { ResolvedOptions } from "./config";
import type { CreatureSpec } from "./creature";
import { draw, type ArmName, type Face, type Pose } from "./creature";
import { PRESS, ROOT_ATTR, Scanner, type Plat } from "./scanner";

// The behaviour: a small physics loop where real page elements are the floor. It rides them
// while you scroll, gets squashed and knocked off when scrolling pushes it into the top of
// the screen, jumps between them, heads for the call to action and points at it. The eyes
// follow the cursor. You can drag and throw it.

export interface Handle {
  destroy(): void;
  celebrate(): void;
  /** draws what the scanner found: blue lines are floors, green boxes are call-to-action spots */
  debug(on: boolean): void;
  /** swaps the drawing without restarting. Returns false when the new creature has another size */
  setCreature(spec: CreatureSpec): boolean;
}

type Mode = "fall" | "idle" | "walk" | "jump" | "drag" | "party";

export function start(cfg: ResolvedOptions): Handle {
  let spec = cfg.spec;
  const S = cfg.scale;
  const COLS = spec.cols, ROWS = spec.rows;
  const W = COLS * S, H = ROWS * S;
  const FOOT = (spec.offset[1] + spec.body.length + spec.legs[0].length) * S; // feet line inside the canvas
  const m = 0.4 + 1.2 * cfg.stickiness; // 1 at the default stickiness of 0.5
  const wait = (ms: number) => ms * m;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- DOM: one fixed layer that never blocks the page ----------
  const root = document.createElement("div");
  root.setAttribute(ROOT_ATTR, "");
  root.setAttribute("aria-hidden", "true");
  root.style.cssText = `position:fixed;left:0;top:0;z-index:${cfg.zIndex};pointer-events:none;transform:translate(-200px,-200px);will-change:transform;contain:layout style;`;
  const canvas = document.createElement("canvas");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.setAttribute("data-perch-body", "");
  canvas.style.cssText = `display:block;width:${W}px;height:${H}px;image-rendering:pixelated;user-select:none;-webkit-user-select:none;touch-action:none;` +
    (cfg.draggable ? "pointer-events:auto;cursor:grab;" : "pointer-events:none;");
  root.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  document.body.appendChild(root);

  const scanner = new Scanner(cfg, W);
  let pose: Pose = { left: "rest", right: "rest", face: "look", legs: 0, px: 0, py: 0, flip: false, w: COLS, h: ROWS };
  let poseKey = "";
  const render = (p: Pose) => {
    const k = `${p.left}${p.right}${p.face}${p.legs}${p.px}${p.py}${p.flip ? 1 : 0}${p.w}x${p.h}`;
    if (k === poseKey) return;
    poseKey = k;
    pose = p;
    draw(ctx, spec, p, S);
  };
  render(pose);

  const cleanups: (() => void)[] = [];
  const listen = <K extends keyof WindowEventMap>(t: K, f: (e: WindowEventMap[K]) => void, o?: AddEventListenerOptions) => {
    addEventListener(t, f as EventListener, o);
    cleanups.push(() => removeEventListener(t, f as EventListener));
  };

  // keep the platform list fresh: on a timer, on DOM changes, on resize
  scanner.refresh();
  let refreshQueued = 0;
  const queueRefresh = () => {
    if (refreshQueued) return;
    refreshQueued = window.setTimeout(() => { refreshQueued = 0; scanner.refresh(); }, 120);
  };
  const timer = window.setInterval(() => scanner.refresh(), 300);
  const mo = new MutationObserver(queueRefresh);
  mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden"] });
  listen("resize", queueRefresh);
  cleanups.push(() => { clearInterval(timer); clearTimeout(refreshQueued); mo.disconnect(); root.remove(); });

  // ---------- reduced motion: sit still on the nearest call to action ----------
  if (reduced) {
    let raf = 0;
    const place = () => {
      raf = 0;
      scanner.refresh();
      const g = scanner.plats(Math.random()).filter((p) => p.goal).sort((a, b) => Math.abs(a.top - innerHeight / 2) - Math.abs(b.top - innerHeight / 2))[0];
      root.style.transform = g ? `translate(${Math.round(g.right - W * 0.9)}px, ${Math.round(g.top - FOOT + 2)}px)` : "translate(-200px,-200px)";
    };
    const sched = () => { if (!raf) raf = requestAnimationFrame(place); };
    place();
    listen("scroll", sched, { passive: true });
    listen("resize", sched);
    canvas.style.pointerEvents = "none";
    return { destroy: () => cleanups.forEach((c) => c()), celebrate: () => {}, debug: () => {}, setCreature: () => false };
  }

  // ---------- debug overlay: shows exactly which elements count as floors ----------
  let dbg: HTMLCanvasElement | null = null;
  const sizeDebug = () => {
    if (!dbg) return;
    dbg.width = innerWidth * dpr; dbg.height = innerHeight * dpr;
    dbg.getContext("2d")!.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const drawDebug = () => {
    if (!dbg) return;
    const c = dbg.getContext("2d")!;
    c.clearRect(0, 0, innerWidth, innerHeight);
    c.font = "11px ui-monospace, monospace";
    for (const p of scanner.plats(frameNo)) {
      c.fillStyle = c.strokeStyle = p.goal ? "#22c55e" : "#3b82f6";
      c.lineWidth = p.goal ? 2 : 1.5;
      if (p.goal) {
        const r = p.el.getBoundingClientRect();
        c.globalAlpha = 0.12; c.fillRect(r.left, r.top, r.width, r.height); c.globalAlpha = 1;
        c.strokeRect(r.left, r.top, r.width, r.height);
        c.fillText("goal", r.left + 4, r.top - 4);
      }
      c.beginPath(); c.moveTo(p.left, p.top); c.lineTo(p.right, p.top); c.stroke();
    }
    c.fillStyle = "#ef4444";
    c.fillRect(0, scanner.topLimit - 1, 14, 2); // the line it must stay below
  };
  const setDebug = (on: boolean) => {
    if (on && !dbg) {
      dbg = document.createElement("canvas");
      dbg.setAttribute(ROOT_ATTR, "");
      dbg.setAttribute("aria-hidden", "true");
      dbg.style.cssText = `position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:${cfg.zIndex - 1};`;
      document.body.appendChild(dbg);
      sizeDebug();
    } else if (!on && dbg) { dbg.remove(); dbg = null; }
  };
  listen("resize", sizeDebug);
  cleanups.push(() => setDebug(false));

  // ---------- physics state (viewport coordinates, feet at y) ----------
  let frameNo = 0;
  const G = 0.55;
  const st = {
    x: innerWidth * 0.62, y: -40, vx: 0, vy: 0,
    on: null as Element | null, target: null as Element | null, tTop: 0, sx: 1, sy: 1, svx: 0, svy: 0,
    mode: "fall" as Mode,
    walkTo: 0, next: performance.now() + 1200, step: 0, legs: 0 as 0 | 1, party: 0,
    mouse: { x: innerWidth / 2, y: innerHeight / 2 }, drag: { dx: 0, dy: 0, lx: 0, ly: 0, t: 0, vx: 0, vy: 0 },
    scrollY: scrollY, scrollV: 0, idleAct: "", actUntil: 0, look: null as null | { x: number; y: number },
    happy: false, reading: false, taps: 0, lastMove: performance.now(), atGoalSince: 0, interestAt: 0,
    flip: false, arm: "rest" as ArmName, armL: "rest" as ArmName, blinkAt: performance.now() + 3000,
  };

  const plats = () => scanner.plats(frameNo);
  const find = (el: Element | null) => (el ? plats().find((p) => p.el === el) ?? null : null);
  /** the smallest platform that contains this element */
  const platAt = (t: Element | null): Plat | null => {
    if (!t) return null;
    let best: Plat | null = null;
    for (const p of plats()) if (p.el === t || p.el.contains(t)) if (!best || best.el.contains(p.el)) best = p;
    return best;
  };
  const spotOn = (p: Plat, nearX = st.x) => Math.max(p.left + W * 0.4, Math.min(p.right - W * 0.4, nearX + (Math.random() - 0.5) * W));
  const dist = (p: Plat) => Math.hypot((p.left + p.right) / 2 - st.x, p.top - st.y);
  const explore = (ps: Plat[], radius = 520) => {
    // a nearby element, favouring ones close to the cursor
    const options = ps.filter((p) => p.el !== st.on && dist(p) < radius);
    if (!options.length) return false;
    const near = (p: Plat) => dist(p) + Math.hypot((p.left + p.right) / 2 - st.mouse.x, p.top - st.mouse.y) * 0.6 + Math.random() * 260;
    const pick = options.sort((a, b) => near(a) - near(b))[0];
    jumpTo(spotOn(pick), pick.top, pick.el);
    return true;
  };
  const goalSpot = (p: Plat) => {
    const btn = scanner.pressable(p.el).getBoundingClientRect();
    if (btn.top < p.top + 4 && btn.left > p.left + W) return { x: btn.left - W * 0.35, toward: 1 };
    return { x: p.right - W * 0.6, toward: -1 };
  };
  const dip = (el: Element, px: number, ms: number, frames?: Keyframe[]) => {
    if (!cfg.bounce || !(el as HTMLElement).animate) return;
    if (getComputedStyle(el).transform !== "none") return; // never fight the page's own transforms
    (el as HTMLElement).animate(frames ?? [{ transform: "translateY(0)" }, { transform: `translateY(${px.toFixed(1)}px)` }, { transform: `translateY(${(-px * 0.25).toFixed(1)}px)` }, { transform: "translateY(0)" }], { duration: ms, easing: "ease-out" });
  };

  const jumpUp = () => {
    const lim = scanner.topLimit;
    const score = (p: Plat) => Math.abs(p.top - innerHeight * 0.4) + Math.abs((p.left + p.right) / 2 - st.x) * 0.3;
    const up = plats().filter((p) => p.el !== st.on && p.top < st.y - 60 && p.top > lim + 20).sort((a, b) => score(a) - score(b))[0];
    if (up) { jumpTo(spotOn(up), up.top, up.el); return true; }
    return false;
  };
  const jumpTo = (tx: number, ty: number, target: Element | null = null) => {
    const apex = Math.min(st.y, ty) - 50 - Math.random() * 30;
    const up = Math.max(1, st.y - apex), down = Math.max(1, ty - apex);
    st.vy = -Math.sqrt(2 * G * up);
    const T = Math.sqrt((2 * up) / G) + Math.sqrt((2 * down) / G);
    st.vx = (tx - st.x) / T;
    st.on = null; st.mode = "jump"; st.target = target; st.tTop = target ? (find(target)?.top ?? ty) : ty;
    st.sy = 0.66; st.sx = 1.3; // crouch before take-off
    st.flip = st.vx < 0;
  };
  const land = (p: Plat, impact: number) => {
    dip(p.el, Math.min(7, 1.5 + impact * 0.45), 340);
    st.on = p.el; st.y = p.top + 2; st.vy = 0; st.vx = 0; st.mode = "idle";
    st.reading = p.text || p.el.matches("table");
    if (p.el.matches(PRESS) || p.el.matches("[data-perch]")) st.taps = 2;
    const k = Math.min(0.5, 0.12 + impact * 0.05);
    st.sy = 1 - k; st.sx = 1 + k;
    st.next = performance.now() + 500 + Math.random() * 900;
  };

  const think = (now: number) => {
    const ps = plats();
    const here = ps.find((p) => p.el === st.on) ?? null;
    const goal = ps.filter((p) => p.goal).sort((a, b) => Math.abs(a.top - innerHeight * 0.55) - Math.abs(b.top - innerHeight * 0.55))[0];
    st.arm = "rest"; st.armL = "rest";
    if (st.taps > 0 && here) {
      // tap the button it is sitting on
      st.taps--; st.arm = "hold";
      dip(here.el, 3, 180, [{ transform: "translateY(0)" }, { transform: "translateY(3px)" }, { transform: "translateY(0)" }]);
      st.next = now + 320; return;
    }
    if (here?.goal) {
      if (!st.atGoalSince) st.atGoalSince = now;
      const s = goalSpot(here);
      if (Math.abs(st.x - s.x) > 12) { st.mode = "walk"; st.walkTo = s.x; return; }
      if (now - st.atGoalSince > wait(6000 + Math.random() * 4000) && explore(ps)) { st.atGoalSince = 0; return; }
      const r = Math.random();
      st.arm = s.toward > 0 ? (r < 0.65 ? "point" : "wave") : "hold";
      st.armL = s.toward < 0 ? (r < 0.65 ? "point" : "wave") : "rest";
      st.flip = false; st.next = now + wait(1600 + Math.random() * 1800); return;
    }
    st.atGoalSince = 0;
    if (!here) {
      if (goal) { const s = goalSpot(goal); return jumpTo(s.x, goal.top, goal.el); }
      if (explore(ps, 2000)) return;
      st.next = now + 900; return;
    }
    // little things to do while standing around
    if (Math.random() < 0.35) {
      const acts = ["stretch", "hop", "look", "wiggle", "wave", "turn"];
      const act = acts[Math.floor(Math.random() * acts.length)];
      st.idleAct = act; st.actUntil = now + 900;
      if (act === "stretch") { st.sy = 1.35; st.sx = 0.78; }
      if (act === "hop") { jumpTo(st.x + (Math.random() - 0.5) * 30, here.top, here.el); return; }
      if (act === "look") st.look = { x: st.x + (Math.random() < 0.5 ? -400 : 400), y: st.y - 100 + Math.random() * 300 };
      if (act === "wave") st.arm = "wave";
      if (act === "turn") st.flip = !st.flip;
      st.next = now + wait(900 + Math.random() * 700); return;
    }
    const r = Math.random();
    if (goal && r < 0.5 / m) { const s = goalSpot(goal); return jumpTo(s.x, goal.top, goal.el); }
    if (r < 0.7) { st.mode = "walk"; st.walkTo = spotOn(here, here.left + Math.random() * (here.right - here.left)); return; }
    if (explore(ps)) return;
    st.arm = "wave"; st.next = now + wait(1400 + Math.random() * 1600);
  };

  let raf = 0;
  let lastTick = 0;
  const lastTop = new Map<Element, number>();
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    if (now - lastTick < 15) return; // the tuning is per 60 fps tick; do not run double speed on 120 Hz
    lastTick = now;
    frameNo++;
    const TOP = scanner.topLimit;
    // how fast the page is scrolling
    const sv = scrollY - st.scrollY; st.scrollY = scrollY; st.scrollV += (sv - st.scrollV) * 0.35;
    const pushed = Math.abs(st.scrollV) > 7 && st.mode !== "drag";
    if (st.mode === "drag") {
      st.sy += (1.18 - st.sy) * 0.3; st.sx += (0.86 - st.sx) * 0.3;
    } else if (!st.on && st.mode === "idle" && st.y >= innerHeight - 7) {
      if (Math.abs(st.scrollV) > 1.5 ? !jumpUp() && now > st.next : now > st.next) think(now);
    } else if (st.on) {
      const p = find(st.on);
      if (!p) { st.on = null; st.mode = "fall"; if (st.y > innerHeight * 0.6) jumpUp(); }
      else if (st.scrollV < -2 && p.top > innerHeight * 0.7 && st.mode !== "jump" && jumpUp()) { /* jumped */ }
      else {
        // ride the platform while the page scrolls
        const dy = p.top + 2 - st.y;
        st.y = p.top + 2;
        if (dy < -14) { st.sy = Math.max(0.6, st.sy - 0.12); st.sx = Math.min(1.35, st.sx + 0.1); } // pushed up fast: squash
        if (st.x < p.left + W * 0.3 || st.x > p.right - W * 0.3) { st.on = null; st.mode = "fall"; st.vx = st.x < p.left ? -1 : 1; }
        if (st.y - FOOT < TOP) { st.on = null; st.mode = "fall"; st.vy = 3; st.sy = 0.6; st.sx = 1.4; } // knocked off at the top
      }
      if (st.mode === "walk") {
        const d = st.walkTo - st.x;
        st.flip = d < 0;
        st.x += Math.sign(d) * Math.min(Math.abs(d), 1.3 * cfg.speed);
        if (++st.step % Math.max(2, Math.round(8 / cfg.speed)) === 0) st.legs = st.legs ? 0 : 1;
        if (Math.abs(d) < 1.5) { st.mode = "idle"; st.next = now + 600; }
      } else if (st.mode === "idle" && now > st.next) think(now);
    } else {
      // in the air
      if (st.mode === "jump" && st.target) { const tp = find(st.target); if (tp) { st.y += tp.top - st.tTop; st.tTop = tp.top; } }
      const prev = st.y;
      st.vy = Math.min(st.vy + G, 30); if (st.mode !== "jump") st.vx *= 0.995;
      if (st.mode === "jump" && st.target) { const tp = find(st.target); if (tp && st.vy > 0 && st.y > tp.top + 40) { st.mode = "fall"; st.target = null; } }
      st.x += st.vx; st.y += st.vy;
      if (st.x < W / 2) { st.x = W / 2; st.vx = Math.abs(st.vx) * 0.6; }
      if (st.x > innerWidth - W / 2) { st.x = innerWidth - W / 2; st.vx = -Math.abs(st.vx) * 0.6; }
      if (st.mode === "jump" && st.target && !find(st.target)) { st.mode = "fall"; st.target = null; }
      if (st.vy > 0) {
        for (const p of plats()) {
          if (st.mode === "jump" && st.target && p.el !== st.target) continue;
          const was = lastTop.get(p.el) ?? p.top; // the platform may have moved this frame too
          if (st.x > p.left + W * 0.25 && st.x < p.right - W * 0.25 && prev - was <= 3 && st.y >= p.top) { land(p, st.vy); break; }
        }
      }
      if (!st.on && st.y > innerHeight - 6) {
        st.y = innerHeight - 6;
        if (st.vy > 2) { const k = Math.min(0.5, st.vy * 0.05); st.sy = 1 - k; st.sx = 1 + k; st.vy = -st.vy * 0.3; st.vx *= 0.6; }
        else { st.vy = 0; st.vx *= 0.8; if (st.mode !== "idle") { st.mode = "idle"; st.next = now + 700; } else if (now > st.next) think(now); }
      }
      if (!st.on) { st.sy += ((1 + Math.min(0.22, Math.abs(st.vy) * 0.018)) - st.sy) * 0.25; st.sx += ((1 - Math.min(0.15, Math.abs(st.vy) * 0.012)) - st.sx) * 0.25; }
    }
    if (st.mode === "party" && st.on && now > st.next) { if (st.party-- > 0) { const p = find(st.on); if (p) jumpTo(st.x, p.top, p.el); } else st.mode = "idle"; }

    // squash spring back to 1
    if (st.mode !== "drag") {
      const grounded = !!st.on || st.y >= innerHeight - 7;
      let ry = 1, rx = 1;
      if (grounded) { const b = Math.sin(now / 420) * 0.045; ry = 1 + b; rx = 1 - b * 0.7; } // breathing
      if (st.mode === "walk") { const b = Math.abs(Math.sin(now / 90)) * 0.12; ry = 0.94 + b; rx = 1.06 - b * 0.6; }
      if (pushed) { const k = Math.min(0.42, Math.abs(st.scrollV) * 0.02); ry = 1 - k; rx = 1 + k * 0.8; }
      st.svx = (st.svx + (rx - st.sx) * 0.2) * 0.74; st.svy = (st.svy + (ry - st.sy) * 0.2) * 0.74;
      st.sx += st.svx; st.sy += st.svy;
    }

    // eyes: follow the cursor, or the call to action when the cursor is still
    const cx = st.x, cy = st.y - H * 0.6;
    let lx = st.mouse.x, ly = st.mouse.y;
    if (now - st.lastMove > 3000) {
      const t = scanner.goalTarget(plats())?.getBoundingClientRect();
      if (t) { lx = t.left + t.width / 2; ly = t.top + t.height / 2; }
    }
    if (st.reading && st.on && now - st.lastMove > 1200) { lx = cx; ly = cy + 200; }
    if (st.look && now < st.actUntil) { lx = st.look.x; ly = st.look.y; } else st.look = null;
    const ax = lx - cx, ay = ly - cy;
    let px = Math.abs(ax) < 40 ? 0 : ax > 0 ? 1 : -1;
    const py = Math.abs(ay) < 40 ? 0 : ay > 0 ? 1 : -1;
    if (st.flip) px = -px;
    const blink = now > st.blinkAt && now < st.blinkAt + 140;
    if (now > st.blinkAt + 140) st.blinkAt = now + 2500 + Math.random() * 3500;
    const airborne = !st.on && st.mode !== "drag";
    const face: Face = st.mode === "drag" || (pushed && Math.abs(st.scrollV) > 25) ? "wow" : st.happy || st.mode === "party" ? "happy" : blink ? "blink" : "look";
    const right: ArmName = pushed ? "brace" : st.mode === "drag" || airborne ? "wave" : st.arm;
    const left: ArmName = pushed ? "brace" : st.mode === "drag" || airborne ? "wave" : st.armL;
    const wiggle = st.idleAct === "wiggle" && now < st.actUntil ? Math.floor(now / 110) % 2 : Math.floor(now / 700) % 2;
    render({
      w: Math.max(8, Math.round(COLS * st.sx)), h: Math.max(6, Math.round(ROWS * st.sy)), left, right, face,
      legs: st.mode === "walk" ? st.legs : (wiggle as 0 | 1), px: Math.max(-1, Math.min(1, px)), py: Math.max(-1, Math.min(1, py)), flip: st.flip,
    });

    if (!st.on) { lastTop.clear(); for (const p of plats()) lastTop.set(p.el, p.top); }
    root.style.transform = `translate(${Math.round(st.x - W / 2)}px, ${Math.round(st.y - FOOT)}px)`;
    drawDebug();
  };
  raf = requestAnimationFrame(frame);

  // ---------- input ----------
  const move = (e: PointerEvent) => {
    st.mouse = { x: e.clientX, y: e.clientY }; st.lastMove = performance.now();
    if (st.mode === "drag") {
      const t = performance.now(), d = st.drag;
      d.vx = (e.clientX - d.lx) / Math.max(1, t - d.t) * 16; d.vy = (e.clientY - d.ly) / Math.max(1, t - d.t) * 16;
      d.lx = e.clientX; d.ly = e.clientY; d.t = t;
      st.x = e.clientX + d.dx; st.y = e.clientY + d.dy;
    }
  };
  const down = (e: PointerEvent) => {
    if (!cfg.draggable || !(e.target as Element).closest?.("[data-perch-body]")) return;
    e.preventDefault();
    st.mode = "drag"; st.on = null;
    st.drag = { dx: st.x - e.clientX, dy: st.y - e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), vx: 0, vy: 0 };
  };
  const up = () => {
    if (st.mode !== "drag") return;
    st.mode = "fall"; st.vx = Math.max(-25, Math.min(25, st.drag.vx)); st.vy = Math.max(-25, Math.min(25, st.drag.vy));
    st.next = performance.now() + 1500;
  };
  const focus = (e: FocusEvent) => {
    const p = platAt(e.target as Element);
    st.happy = !!p?.goal;
    if (p?.goal && st.on !== p.el && st.mode !== "drag") { const s = goalSpot(p); jumpTo(s.x, p.top, p.el); }
  };
  const sendTo = (p: Plat | null, x: number) => {
    if (p && p.el !== st.on && (st.mode === "idle" || st.mode === "walk")) { jumpTo(spotOn(p, x), p.top, p.el); return true; }
    return false;
  };
  const click = (e: MouseEvent) => {
    const t = e.target as Element;
    if (t.closest?.(`a, button, input, label, select, textarea, [${ROOT_ATTR}]`)) return;
    const hit = platAt(t) ?? document.elementsFromPoint(e.clientX, e.clientY).map(platAt).find(Boolean) ?? null;
    if (sendTo(hit, e.clientX)) return;
    // empty space: the element nearest to the click
    const near = plats().filter((p) => p.el !== st.on).sort((a, b) => Math.hypot((a.left + a.right) / 2 - e.clientX, a.top - e.clientY) - Math.hypot((b.left + b.right) / 2 - e.clientX, b.top - e.clientY))[0];
    sendTo(near ?? null, e.clientX);
  };
  const over = (e: PointerEvent) => {
    const now = performance.now();
    const t = e.target as Element;
    const p = platAt(t);
    if (p && !p.goal && now > st.interestAt && Math.random() < Math.min(0.9, 0.35 / m)) { st.interestAt = now + 2500; sendTo(p, e.clientX); }
    if (p?.goal && t.closest?.(PRESS) && st.mode === "idle") { st.arm = "point"; st.happy = true; }
    else if (!platAt(document.activeElement)?.goal) st.happy = false;
  };
  const celebrate = () => { st.happy = true; st.mode = "party"; st.party = 3; st.next = 0; };
  const hide = () => { cancelAnimationFrame(raf); if (!document.hidden) raf = requestAnimationFrame(frame); };

  listen("pointermove", move, { passive: true });
  listen("pointerdown", down);
  listen("pointerup", up);
  listen("pointercancel", up);
  listen("pointerover", over, { passive: true });
  listen("click", click);
  addEventListener("perch:celebrate", celebrate);
  document.addEventListener("focusin", focus);
  document.addEventListener("visibilitychange", hide);
  cleanups.push(() => {
    cancelAnimationFrame(raf);
    removeEventListener("perch:celebrate", celebrate);
    document.removeEventListener("focusin", focus);
    document.removeEventListener("visibilitychange", hide);
  });

  const setCreature = (next: CreatureSpec) => {
    const same = next.cols === spec.cols && next.rows === spec.rows && next.offset[0] === spec.offset[0] && next.offset[1] === spec.offset[1] &&
      next.body.length === spec.body.length && next.legs[0].length === spec.legs[0].length && next.legs[1].length === spec.legs[1].length;
    if (!same) return false;
    spec = next;
    poseKey = ""; // force a redraw
    render(pose);
    return true;
  };
  return { destroy: () => cleanups.forEach((c) => c()), celebrate, debug: setDebug, setCreature };
}
