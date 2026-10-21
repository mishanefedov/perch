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
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 85, maxWidth: 960, maxHeight: 600, everyNthFrame: 1 });
const t = (s) => page.locator(`[data-perch-tuner] ${s}`);
const move = async (x, y, steps = 25) => { await page.mouse.move(x, y, { steps }); };

await page.goto("http://localhost:4173/fixtures/acme.html");
await page.waitForSelector("[data-perch-tuner]", { state: "attached" });
await page.mouse.move(700, 300);
await page.waitForTimeout(2400);
// eyes follow the cursor
await move(120, 420, 30); await page.waitForTimeout(300);
await move(820, 200, 30); await page.waitForTimeout(400);
// click a card: it jumps there
await page.mouse.click(520, 520); await page.waitForTimeout(1500);
// scroll: it rides the elements
for (let i = 0; i < 10; i++) { await page.mouse.wheel(0, 90); await page.waitForTimeout(60); }
await page.waitForTimeout(800);
for (let i = 0; i < 10; i++) { await page.mouse.wheel(0, -90); await page.waitForTimeout(60); }
await page.waitForTimeout(800);
// the tuner
await t(".gear").click(); await page.waitForTimeout(700);
await t("#creature").selectOption("cat"); await page.waitForTimeout(1200);
await t("#floors").check(); await page.waitForTimeout(1500);
await t("#creature").selectOption("alien"); await page.waitForTimeout(1200);
await t("#floors").uncheck();
// the editor
await t("[data-edit]").click(); await page.waitForTimeout(800);
const box = await t(".ed canvas").boundingBox();
const cell = (cx, cy) => [box.x + ((cx + 0.5) / 28) * box.width, box.y + ((cy + 0.5) / 16) * box.height];
await page.locator("[data-perch-tuner] .sw label").nth(1).locator(".pick").click();
for (const [cx, cy] of [[8, 4], [9, 4], [10, 4], [13, 4], [14, 4], [15, 4], [17, 4], [18, 4], [19, 4]]) { const [x, y] = cell(cx, cy); await page.mouse.click(x, y); await page.waitForTimeout(150); }
await page.waitForTimeout(1500);
await page.keyboard.press("Escape"); await page.waitForTimeout(800);
await t("#creature").selectOption("octopus"); await page.waitForTimeout(1800);
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
