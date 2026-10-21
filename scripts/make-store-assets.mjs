// Screenshots for the Chrome Web Store listing and the website, taken from the real built extension.
//   bun run extension:build && node scripts/make-store-assets.mjs
// Needs Playwright's Chromium: node node_modules/playwright-core/cli.js install chromium
import { createServer } from "node:http";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const root = new URL("..", import.meta.url).pathname;
const out = join(root, "extension/store");
mkdirSync(out, { recursive: true });

// a copy that may touch localhost without a toolbar click
const dir = mkdtempSync(join(tmpdir(), "perch-store-"));
cpSync(join(root, "extension-dist"), dir, { recursive: true });
const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
manifest.host_permissions = ["http://localhost/*"];
writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest));

const server = createServer((req, res) => {
  try { res.setHeader("content-type", "text/html"); res.end(readFileSync(join(root, "test/fixtures/hero.html"))); } catch { res.statusCode = 404; res.end(); }
}).listen(0);
const url = `http://localhost:${server.address().port}/`;

const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "perch-profile-")), {
  channel: "chromium", headless: true, viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${dir}`, `--load-extension=${dir}`],
});
const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent("serviceworker", { timeout: 10000 }));
const extId = new URL(sw.url()).host;
const page = await ctx.newPage();
await page.goto(url);
const tabId = await sw.evaluate(async (u) => (await chrome.tabs.query({ url: u + "*" }))[0].id, url);
await sw.evaluate((id) => chrome.scripting.executeScript({ target: { tabId: id }, files: ["perch-ext.js", "perch-tuner.js", "bootstrap.js"] }), tabId);
await page.waitForTimeout(3500);

// 1. the customize panel on a real page
await sw.evaluate((id) => chrome.tabs.sendMessage(id, { type: "perch:tuner" }), tabId);
await page.locator("[data-perch-tuner] .panel").waitFor({ state: "visible" });
await page.locator("[data-perch-tuner] #floors").check();
await page.waitForTimeout(2500);
await page.screenshot({ path: join(out, "ext-page.png") });

// 2. the pixel editor
await page.locator("[data-perch-tuner] #floors").uncheck();
await page.locator("[data-perch-tuner] #creature").selectOption("cat");
await page.locator("[data-perch-tuner] [data-edit]").click();
await page.waitForTimeout(1200);
await page.screenshot({ path: join(out, "ext-editor.png") });
await page.keyboard.press("Escape");

// 3. the popup (opened as a page, aimed at the tab above)
const popup = await ctx.newPage();
await popup.setViewportSize({ width: 320, height: 520 });
await popup.goto(`chrome-extension://${extId}/popup.html?tab=${tabId}`);
await popup.waitForTimeout(500);
const body = popup.locator("body");
await popup.screenshot({ path: join(out, "ext-popup.png"), clip: { x: 0, y: 0, width: 320, height: Math.ceil((await body.boundingBox()).height) }, scale: "device" });
await ctx.close();
server.close();

// 4. small promo tile for the store (440 x 280)
const browser = await chromium.launch({ channel: "chromium" });
const logo = readFileSync(join(root, "site/static/logo.svg"), "utf8").replace(/width="\d+" height="\d+"/, 'width="150" height="auto"');
const tile = await browser.newPage({ viewport: { width: 440, height: 280 } });
await tile.setContent(`<body style="margin:0;width:440px;height:280px;background:#0b1020;color:#fff;font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px"><div>${logo}</div><div style="font-size:44px;font-weight:800;letter-spacing:-2px;line-height:1">perch</div><div style="font-size:18px;color:#9aa6c7">A pixel creature on any website</div></body>`);
await tile.screenshot({ path: join(out, "promo-small-440x280.png") });
await browser.close();
console.log("extension/store: ext-page.png, ext-editor.png, ext-popup.png, promo-small-440x280.png");
