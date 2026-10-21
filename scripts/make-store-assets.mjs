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
  const name = req.url.startsWith("/blog") ? "blog.html" : "hero.html";
  try { res.setHeader("content-type", "text/html"); res.end(readFileSync(join(root, "test/fixtures", name))); } catch { res.statusCode = 404; res.end(); }
}).listen(0);
const base = `http://localhost:${server.address().port}`;
const url = `${base}/`;

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
await page.locator("[data-perch-tuner] [data-back], [data-perch-tuner] .x[data-back]").first().click();
await page.locator("[data-perch-tuner] #creature").selectOption("octopus");

// 2b. picking the goal: the element under the cursor is outlined and its selector shown
await page.locator("[data-perch-tuner] [data-pick=goal]").click();
const target = await page.locator("a.btn").first().boundingBox();
await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
await page.waitForTimeout(600);
await page.screenshot({ path: join(out, "ext-pick.png") });
await page.keyboard.press("Escape");

// 2c. a different kind of page: the creature on a blog post, no panel
const blog = await ctx.newPage();
await blog.setViewportSize({ width: 1280, height: 800 });
await blog.goto(`${base}/blog`);
const blogTab = await sw.evaluate(async (u) => (await chrome.tabs.query({ url: u + "*" }))[0].id, `${base}/blog`);
await sw.evaluate((id) => chrome.scripting.executeScript({ target: { tabId: id }, files: ["perch-ext.js", "perch-tuner.js", "bootstrap.js"] }), blogTab);
await blog.waitForTimeout(4000);
await blog.screenshot({ path: join(out, "ext-blog.png") });

// 3. the popup (opened as a page, aimed at the tab above)
const popup = await ctx.newPage();
await popup.setViewportSize({ width: 320, height: 520 });
await popup.goto(`chrome-extension://${extId}/popup.html?tab=${tabId}`);
await popup.waitForTimeout(500);
const body = popup.locator("body");
await popup.screenshot({ path: join(out, "ext-popup.png"), clip: { x: 0, y: 0, width: 320, height: Math.ceil((await body.boundingBox()).height) }, scale: "device" });
// 3b. the popup as it looks in the toolbar: composite on the blog page (the store wants 1280 x 800)
const popupPng = readFileSync(join(out, "ext-popup.png")).toString("base64");
const blogPng = readFileSync(join(out, "ext-blog.png")).toString("base64");
const comp = await ctx.newPage();
await comp.setViewportSize({ width: 1280, height: 800 });
await comp.setContent(`<body style="margin:0;width:1280px;height:800px;position:relative;background:#222;overflow:hidden">
  <img src="data:image/png;base64,${blogPng}" style="position:absolute;inset:0;width:1280px;height:800px">
  <div style="position:absolute;top:0;left:0;right:0;height:44px;background:#dee1e6"></div>
  <div style="position:absolute;top:8px;right:20px;width:28px;height:28px;border-radius:6px;background:#cfd3da;display:grid;place-items:center"><img src="data:image/png;base64,${readFileSync(join(root, "extension/icons/icon-32.png")).toString("base64")}" width="22" height="22"></div>
  <img src="data:image/png;base64,${popupPng}" style="position:absolute;top:50px;right:14px;width:320px;border-radius:10px;box-shadow:0 10px 40px #0007">
</body>`);
await comp.waitForTimeout(300);
await comp.screenshot({ path: join(out, "ext-popup-1280x800.png") });
await ctx.close();
server.close();

// 4. small promo tile for the store (440 x 280)
const browser = await chromium.launch({ channel: "chromium" });
const logo = readFileSync(join(root, "site/static/logo.svg"), "utf8").replace(/width="\d+" height="\d+"/, 'width="150" height="auto"');
const tile = await browser.newPage({ viewport: { width: 440, height: 280 } });
await tile.setContent(`<body style="margin:0;width:440px;height:280px;background:#0b1020;color:#fff;font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px"><div>${logo}</div><div style="font-size:44px;font-weight:800;letter-spacing:-2px;line-height:1">perch</div><div style="font-size:18px;color:#9aa6c7">A pixel creature on any website</div></body>`);
await tile.screenshot({ path: join(out, "promo-small-440x280.png") });
const marquee = await browser.newPage({ viewport: { width: 1400, height: 560 } });
const logoBig = readFileSync(join(root, "site/static/logo.svg"), "utf8").replace(/width="\d+" height="\d+"/, 'width="260" height="auto"');
await marquee.setContent(`<body style="margin:0;width:1400px;height:560px;background:#0b1020;color:#fff;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;gap:64px"><div>${logoBig}</div><div><div style="font-size:120px;font-weight:800;letter-spacing:-5px;line-height:1">perch</div><div style="font-size:38px;color:#cbd5e1;margin-top:14px">A pixel creature on any website.</div><div style="font:600 24px ui-monospace,Menlo,monospace;color:#94a3b8;margin-top:22px">Free. Open source. No tracking.</div></div></body>`);
await marquee.screenshot({ path: join(out, "promo-marquee-1400x560.png") });
await browser.close();
console.log("extension/store: screenshots ext-page, ext-editor, ext-pick, ext-blog, ext-popup-1280x800 (+ ext-popup for the site), promo tiles");
