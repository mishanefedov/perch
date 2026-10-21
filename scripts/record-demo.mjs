// Records assets/demo.gif: the real demo page, the real script, driven by Playwright.
//   bun run build && (bun run demo &) && node scripts/record-demo.mjs
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const chrome = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome"].find(existsSync);
const dir = join(process.cwd(), "test/.tmp/video");
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

const browser = await chromium.launch({ executablePath: chrome });
const ctx = await browser.newContext({ viewport: { width: 960, height: 600 } });
await ctx.addInitScript(() => {
  addEventListener("DOMContentLoaded", () => {
    const c = document.createElement("div");
    c.style.cssText = "position:fixed;left:0;top:0;width:18px;height:18px;border-radius:50%;background:#0006;border:2px solid #fff;box-shadow:0 0 0 1px #0008;pointer-events:none;z-index:2147483647;transform:translate(-100px,-100px)";
    document.body.appendChild(c);
    addEventListener("mousemove", (e) => { c.style.transform = `translate(${e.clientX - 9}px,${e.clientY - 9}px)`; }, { passive: true });
  });
});
const page = await ctx.newPage();
// screencast frames with their real timestamps, so the GIF plays at the speed it ran
const cdp = await ctx.newCDPSession(page);
const frames = [];
cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
  frames.push({ t: metadata.timestamp, data });
  await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 85, maxWidth: 1000, maxHeight: 640, everyNthFrame: 1 });
const t = (s) => page.locator(`[data-perch-tuner] ${s}`);
const wait = (ms) => page.waitForTimeout(ms);
const move = (x, y, steps = 24) => page.mouse.move(x, y, { steps });
const center = async (sel) => { const b = await page.locator(sel).first().boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };

await page.goto("http://localhost:4173/fixtures/hero.html");
await page.waitForSelector("[data-perch-tuner]", { state: "attached" });
await page.mouse.move(820, 330);
await wait(2600);                                   // it lands on the form and points at the button

// open the tuner and look at what it found
await move(40, 600); await t(".gear").click(); await wait(500);
await t("#floors").check(); await wait(1800);       // blue floors, green goal

// pick the goal with a click
await t("[data-pick=goal]").click(); await wait(500);
for (const sel of ["h1", ".card >> nth=1", "form button", "a.btn"]) { const [x, y] = await center(sel); await move(x, y, 22); await wait(450); }
const [gx, gy] = await center("a.btn");
await page.mouse.click(gx, gy);                     // "Book a demo" is the new goal
await wait(6200);                                   // it walks over and points at it

// pick something to ignore
await t("[data-pick=ignore]").click(); await wait(500);
const [ix, iy] = await center(".card >> nth=0");
await move(ix, iy + 8, 26); await wait(900);        // hovering the text inside the card
await page.keyboard.press("ArrowUp"); await wait(1400); // ↑ selects the whole card
await page.mouse.click(ix, iy + 8);                 // the first card is now off limits
await wait(3600);

// the saved command
await t(".out").scrollIntoViewIfNeeded().catch(() => {});
await wait(2600);
await cdp.send("Page.stopScreencast");
await ctx.close();
await browser.close();

mkdirSync("assets", { recursive: true });
const list = [];
frames.forEach((f, i) => {
  const name = join(dir, `f${String(i).padStart(5, "0")}.jpg`);
  writeFileSync(name, Buffer.from(f.data, "base64"));
  const next = frames[i + 1]?.t ?? f.t + 0.1;
  list.push(`file '${name}'`, `duration ${Math.min(0.5, Math.max(0.01, next - f.t)).toFixed(3)}`);
});
list.push(`file '${join(dir, `f${String(frames.length - 1).padStart(5, "0")}.jpg`)}'`);
writeFileSync(join(dir, "list.txt"), list.join("\n"));
execFileSync("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", join(dir, "list.txt"), "-vf", "fps=12,scale=760:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4", "-loop", "0", "assets/demo.gif"], { stdio: "ignore" });
console.log(`assets/demo.gif from ${frames.length} frames`);
