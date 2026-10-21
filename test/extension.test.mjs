// The browser extension, loaded for real into Chromium: injection, isolation, settings, popup, always-on.
// Needs Playwright's Chromium (node node_modules/playwright-core/cli.js install chromium). Skipped without it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { chromium } from "playwright-core";

const root = new URL("..", import.meta.url).pathname;
const dist = join(root, "extension-dist");
const have = existsSync(join(dist, "manifest.json")) && existsSync(chromium.executablePath());

const COLORS = { octopus: [229, 72, 77], cat: [245, 158, 11], robot: [148, 163, 184], blob: [63, 185, 80], alien: [168, 85, 247], ghost: [199, 210, 254] };
const types = { ".html": "text/html", ".js": "text/javascript" };

test("extension: inject, isolate, settings, popup, always on this site, blocked pages", { skip: !have, timeout: 120000 }, async () => {
  // a copy of the build that may touch localhost without a toolbar click (Playwright cannot click the toolbar)
  const dir = mkdtempSync(join(tmpdir(), "perch-ext-"));
  cpSync(dist, dir, { recursive: true });
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  manifest.host_permissions = ["http://localhost/*"];
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest));

  const server = createServer((req, res) => {
    const p = req.url.split("?")[0];
    if (p === "/favicon.ico") { res.statusCode = 204; return res.end(); }
    try { res.setHeader("content-type", types[extname(p)] ?? "text/html"); res.end(readFileSync(join(root, "test/fixtures", p === "/" ? "acme.html" : p))); } catch { res.statusCode = 404; res.end(); }
  }).listen(0);
  const port = server.address().port;

  const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "perch-profile-")), {
    channel: "chromium", headless: true,
    args: [`--disable-extensions-except=${dir}`, `--load-extension=${dir}`, "--host-resolver-rules=MAP other.test 127.0.0.1"],
  });
  try {
    let sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent("serviceworker", { timeout: 10000 }));
    const extId = new URL(sw.url()).host;
    const errors = [];
    const watch = (p) => { p.on("pageerror", (e) => errors.push(String(e))); p.on("console", (m) => m.type() === "error" && errors.push(m.text())); };

    const page = await ctx.newPage(); watch(page);
    await page.goto(`http://localhost:${port}/`);
    const tabId = await sw.evaluate(async (u) => (await chrome.tabs.query({ url: u + "*" }))[0].id, `http://localhost:${port}/`);
    const creatures = () => page.evaluate(() => document.querySelectorAll("[data-perch-creature]").length);
    const which = async () => {
      const px = await page.evaluate(() => {
        const c = document.querySelector("[data-perch-creature] canvas"); if (!c) return null;
        const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
        return n ? [r / n, g / n, b / n] : null;
      });
      if (!px) return null;
      return Object.entries(COLORS).map(([k, c]) => [k, Math.hypot(c[0] - px[0], c[1] - px[1], c[2] - px[2])]).sort((a, b) => a[1] - b[1])[0][0];
    };
    const settle = (ms = 500) => page.waitForTimeout(ms);

    // 1. nothing on the page until asked
    assert.equal(await creatures(), 0);

    // 2. inject (what the popup button and the shortcut do): one creature, and the page cannot see window.Perch
    await sw.evaluate((id) => chrome.scripting.executeScript({ target: { tabId: id }, files: ["perch-ext.js", "perch-tuner.js", "bootstrap.js"] }), tabId);
    await settle();
    assert.equal(await creatures(), 1);
    assert.equal(await page.evaluate(() => typeof window.Perch), "undefined", "the page cannot reach the extension's Perch");
    assert.equal(await which(), "octopus");
    assert.equal(await page.evaluate(() => !!document.querySelector("[data-perch-tuner]")), false, "no tuner in the extension");

    // 3. injecting again never makes a second creature
    await sw.evaluate((id) => chrome.scripting.executeScript({ target: { tabId: id }, files: ["perch-ext.js", "perch-tuner.js", "bootstrap.js"] }), tabId);
    await settle();
    assert.equal(await creatures(), 1, "still one creature after a second injection");

    // 4. a settings change reaches the running creature
    await sw.evaluate(() => chrome.storage.sync.set({ creature: "cat" }));
    await settle(800);
    assert.equal(await which(), "cat");
    assert.equal(await creatures(), 1);

    // 5. the popup: six creatures, choose one, hide, show
    const popup = await ctx.newPage(); watch(popup);
    await popup.goto(`chrome-extension://${extId}/popup.html?tab=${tabId}`);
    assert.equal(await popup.locator("#chips button").count(), 6);
    assert.equal(await popup.locator("#chips button[aria-checked=true]").getAttribute("data-creature"), "cat");
    await popup.locator('#chips button[data-creature="robot"]').click();
    await settle(900);
    assert.equal(await which(), "robot");
    assert.equal(await popup.locator("#toggle").textContent(), "Hide on this page");
    await popup.locator("#toggle").click();
    await settle();
    assert.equal(await creatures(), 0, "hidden");
    assert.equal(await popup.locator("#toggle").textContent(), "Show on this page");
    await popup.locator("#toggle").click();
    await settle(800);
    assert.equal(await creatures(), 1, "shown again");

    // 6. a message toggles it too (this is what the keyboard shortcut sends)
    await sw.evaluate((id) => chrome.tabs.sendMessage(id, { type: "perch:toggle" }), tabId);
    await settle();
    assert.equal(await creatures(), 0);
    await sw.evaluate((id) => chrome.tabs.sendMessage(id, { type: "perch:toggle" }), tabId);
    await settle();
    assert.equal(await creatures(), 1);

    // 6b. customize: the full tuner opens on the page, saves for the extension, never touches the page's storage
    await popup.locator("#customize").click();
    const panel = page.locator("[data-perch-tuner] .panel");
    await panel.waitFor({ state: "visible", timeout: 5000 });
    assert.equal(await page.locator("[data-perch-tuner] .gear").isVisible(), false, "no gear button in the extension");
    assert.equal(await page.locator("[data-perch-tuner] .out").isVisible(), false, "no npx command in the extension");
    const stored = (k) => sw.evaluate(async (key) => (await chrome.storage.sync.get(key))[key], k);
    await page.locator("[data-perch-tuner] #creature").selectOption("alien");
    await settle(900);
    assert.equal(await stored("creature"), "alien", "creature saved for every site");
    assert.equal(await which(), "alien");
    await page.locator("[data-perch-tuner] #stickiness").fill("0.9");
    await settle(500);
    assert.equal(await stored("stickiness"), 0.9);
    // draw: the editor saves a custom creature
    await page.locator("[data-perch-tuner] [data-edit]").click();
    await page.locator("[data-perch-tuner] .ed .era").click();
    const cbox = await page.locator("[data-perch-tuner] .ed canvas").boundingBox();
    await page.mouse.click(cbox.x + cbox.width * (13 / 28), cbox.y + cbox.height * (4 / 16));
    await settle(700);
    assert.equal(await stored("creature"), "custom");
    assert.equal(typeof (await stored("custom")), "object");
    await page.keyboard.press("Escape");
    // a goal typed in the panel belongs to this site only
    await page.locator("[data-perch-tuner] #goal").fill("button");
    await page.locator("[data-perch-tuner] #goal").dispatchEvent("change");
    await settle(700);
    const key = `rule:http://localhost:${port}`;
    assert.deepEqual(await stored(key), { goal: "button" });
    assert.equal(await stored("goal"), undefined, "the goal is not saved globally");
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0, "the page's own storage is untouched");
    // the saved goal comes back after a reload
    await sw.evaluate((id) => chrome.scripting.executeScript({ target: { tabId: id }, files: ["perch-ext.js", "perch-tuner.js", "bootstrap.js"] }), tabId);
    await page.reload(); await settle(500);
    await sw.evaluate((id) => chrome.scripting.executeScript({ target: { tabId: id }, files: ["perch-ext.js", "perch-tuner.js", "bootstrap.js"] }), tabId);
    await sw.evaluate((id) => chrome.tabs.sendMessage(id, { type: "perch:tuner" }), tabId);
    await page.locator("[data-perch-tuner] .panel").waitFor({ state: "visible", timeout: 5000 });
    assert.equal(await page.locator("[data-perch-tuner] #goal").inputValue(), "button");
    assert.equal(await page.locator("[data-perch-tuner] #creature").inputValue(), "__custom");
    await page.keyboard.press("Escape");
    await popup.reload();
    assert.equal(await popup.locator('#chips button[data-creature="custom"]').count(), 1, "the drawn creature is a choice in the popup");
    await popup.locator('#chips button[data-creature="octopus"]').click();
    await settle(900);
    assert.equal(await which(), "octopus");

    // 7. "always on this site": saved, then it appears by itself after a reload
    await popup.locator("#site").check();
    await settle(600);
    const sites = await sw.evaluate(async () => (await chrome.storage.sync.get("sites")).sites);
    assert.deepEqual(sites, [`http://localhost:${port}`]);
    await page.reload();
    await page.waitForSelector("[data-perch-creature]", { state: "attached", timeout: 8000 });
    assert.equal(await creatures(), 1, "registered content script ran on reload without any click");
    await popup.locator("#site").uncheck();
    await settle(600);
    await page.reload(); await settle(1200);
    assert.equal(await creatures(), 0, "turned off again");

    // 8. a page the extension has no access to: clear message, nothing breaks
    const other = await ctx.newPage(); watch(other);
    await other.goto(`http://other.test:${port}/`);
    const otherId = await sw.evaluate(async () => (await chrome.tabs.query({})).find((t) => t.url === undefined)?.id);
    assert.ok(otherId, "found the page without access");
    const blocked = await ctx.newPage(); watch(blocked);
    await blocked.goto(`chrome-extension://${extId}/popup.html?tab=${otherId}`);
    assert.match(await blocked.locator("#msg").textContent(), /does not let extensions run on this page/);
    await blocked.locator("#toggle").click();
    await settle(600);
    assert.match(await blocked.locator("#msg").textContent(), /does not let extensions run on this page/);
    assert.equal(await other.evaluate(() => document.querySelectorAll("[data-perch-root]").length), 0);

    assert.deepEqual(errors.filter((e) => !/favicon|Failed to load resource/.test(e)), []);
  } finally {
    await ctx.close();
    server.close();
  }
});
