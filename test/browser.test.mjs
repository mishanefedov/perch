// Real-browser smoke test: serves the demo, loads dist/perch.js, checks the creature lands on
// page elements, survives scrolling, and logs no errors. Skipped when Chrome is not installed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { extname, join } from "node:path";
import { chromium } from "playwright-core";

const root = new URL("..", import.meta.url).pathname;
const types = { ".html": "text/html", ".js": "text/javascript" };
const chrome = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);

test("creature stands on real elements and stays out of trouble", { skip: !chrome || !existsSync(join(root, "dist/perch.js")) }, async () => {
  const server = createServer((req, res) => {
    if (req.url === "/favicon.ico") { res.statusCode = 204; return res.end(); }
    const p = req.url === "/" ? "/demo/index.html" : req.url.split("?")[0];
    try { res.setHeader("content-type", types[extname(p)] ?? "text/plain"); res.end(readFileSync(join(root, p))); } catch { res.statusCode = 404; res.end(); }
  }).listen(0);
  const port = server.address().port;
  const browser = await chromium.launch({ executablePath: chrome });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  try {
    await page.goto(`http://localhost:${port}/`);
    await page.waitForSelector("[data-perch-root]");
    await page.waitForTimeout(5000);

    // feet = top of the layer + 16 sprite rows * 3 px
    const standing = () => page.evaluate(() => {
      const r = document.querySelector("[data-perch-root]").getBoundingClientRect();
      const feet = r.top + 48, x = r.left + r.width / 2;
      const hit = [...document.querySelectorAll("h1,h2,h3,p,li,form,button,input,a,.card")].find((el) => {
        const b = el.getBoundingClientRect();
        return Math.abs(b.top - feet) < 14 && x > b.left && x < b.right;
      });
      return { x, feet, inView: feet > 0 && feet <= innerHeight + 2 && x > 0 && x < innerWidth, on: hit?.tagName ?? null };
    });
    const a = await standing();
    assert.ok(a.inView, "creature is inside the viewport");
    mkdirSync(join(root, "test/.tmp"), { recursive: true });
    await page.screenshot({ path: join(root, "test/.tmp/standing.png") });

    // scroll down in steps: it must still be on screen afterwards
    for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 250); await page.waitForTimeout(150); }
    await page.waitForTimeout(3000);
    const b = await standing();
    assert.ok(b.inView, "creature is inside the viewport after scrolling");
    await page.screenshot({ path: join(root, "test/.tmp/scrolled.png") });

    // it must not block clicks on the page: the CTA button stays clickable
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(500);
    const btn = page.locator("button[type=submit]");
    await btn.click({ timeout: 3000 });

    // the page was not modified beyond the one layer
    const extra = await page.evaluate(() => document.querySelectorAll("[data-perch-root]:not([data-perch-tuner])").length);
    assert.equal(extra, 1);
    assert.deepEqual(errors, []);
    console.log("standing on:", a.on, "| after scroll:", b.on);
  } finally {
    await browser.close();
    server.close();
  }
});

test("tuner: swap creature, paint a pixel, pick an element, copy the command", { skip: !chrome || !existsSync(join(root, "dist/perch-tuner.js")) }, async () => {
  const server = createServer((req, res) => {
    if (req.url === "/favicon.ico") { res.statusCode = 204; return res.end(); }
    const p = req.url === "/" ? "/demo/index.html" : req.url.split("?")[0];
    try { res.setHeader("content-type", types[extname(p)] ?? "text/plain"); res.end(readFileSync(join(root, p))); } catch { res.statusCode = 404; res.end(); }
  }).listen(0);
  const browser = await chromium.launch({ executablePath: chrome });
  const page = await browser.newPage({ viewport: { width: 1200, height: 820 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  try {
    await page.goto(`http://localhost:${server.address().port}/`);
    await page.waitForSelector("[data-perch-tuner]", { state: "attached" });
    const t = (s) => page.locator(`[data-perch-tuner] ${s}`);
    const spec = () => page.evaluate(() => window.Perch.options().creature);

    // swap persona
    await t(".gear").click();
    await t("#creature").selectOption("robot");
    assert.equal(await spec(), "robot");
    assert.equal(await t(".out").inputValue(), "npx perch-pet set creature=robot");
    await t("#stickiness").fill("0.8");
    assert.equal(await t(".out").inputValue(), "npx perch-pet set creature=robot stickiness=0.8");
    await t("#stickiness").fill("0.5"); // back to the default: the key disappears
    assert.equal(await t(".out").inputValue(), "npx perch-pet set creature=robot");

    // paint one pixel in the editor: the live creature changes without restarting
    await t("[data-edit]").click();
    const before = await page.evaluate(() => document.querySelector("[data-perch-root] canvas").toDataURL());
    await t(".ed .era").click(); // eraser, so the click really changes a pixel
    const box = await t(".ed canvas").boundingBox();
    await page.mouse.click(box.x + box.width * (13 / 28), box.y + box.height * (3 / 16)); // a body pixel near the top
    await page.waitForTimeout(150);
    const edited = await spec();
    assert.equal(typeof edited, "object", "creature is now a custom spec");
    assert.ok(edited.body.join("").includes("."), "body still has its shape");
    assert.match(await page.evaluate(() => JSON.stringify(window.Perch.options().creature.body)), /\w/);
    await page.keyboard.press("Escape");
    assert.match(await t(".out").inputValue(), /^npx perch-pet creature \.\/creature\.json/);

    // pick the goal with the picker: the selector it writes must match exactly that element
    await t("[data-pick=goal]").click();
    const btn = await page.locator("button[type=submit]").boundingBox();
    await page.mouse.move(btn.x + 5, btn.y + 5);
    await page.mouse.click(btn.x + 5, btn.y + 5);
    const goal = await t("#goal").inputValue();
    assert.ok(goal.length > 0);
    const hits = await page.evaluate((sel) => [...document.querySelectorAll(sel)].map((el) => el.type), goal);
    assert.deepEqual(hits, ["submit"], `selector "${goal}" matches only the submit button`);

    // selector helper on a few elements
    const sels = await page.evaluate(() => [...document.querySelectorAll("h1, .card h3, input, a.btn")].map((el) => [window.PerchTuner.selectorFor(el), el]).map(([s, el]) => [s, [...document.querySelectorAll(s)].includes(el)]));
    for (const [s, ok] of sels) assert.ok(ok, `selector ${s} matches its element`);

    // the tuner is off for a live site
    assert.equal(await page.evaluate(async () => (await import("/dist/esm/index.js")).tunerWanted("false")), false);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});
