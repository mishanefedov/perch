// Screenshots for the README and the GitHub social preview.
//   bun run build && (python3 -m http.server 4173 &) && node scripts/make-images.mjs
import { chromium } from "playwright-core";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const chrome = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome"].find(existsSync);
const browser = await chromium.launch({ executablePath: chrome });

// the tuner and the editor on the demo page
const page = await browser.newPage({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: 1.5 });
await page.goto("http://localhost:4173/demo/");
await page.waitForSelector("[data-perch-tuner]", { state: "attached" });
const t = (s) => page.locator(`[data-perch-tuner] ${s}`);
await page.waitForTimeout(2500);
await t(".gear").click();
await t("#creature").selectOption("cat");
await t("#stickiness").fill("0.8");
await t("#floors").check();
await page.waitForTimeout(3500);
await page.screenshot({ path: "assets/tuner.png" });
await t("[data-edit]").click();
await page.waitForTimeout(500);
await page.screenshot({ path: "assets/editor.png" });
await page.close();

// social preview, 1280x640
const lineup = readFileSync("assets/creatures.svg", "utf8");
const social = await browser.newPage({ viewport: { width: 1280, height: 640 } });
await social.setContent(`<body style="margin:0;width:1280px;height:640px;background:#0b1020;color:#fff;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;overflow:hidden">
  <div style="font-size:120px;font-weight:800;letter-spacing:-4px;line-height:1">perch</div>
  <div style="font-size:34px;color:#cbd5e1;text-align:center;max-width:980px;line-height:1.3">A pixel creature that lives on your website.<br>One script tag. Tune it live on localhost.</div>
  <div style="margin-top:12px;transform:scale(1.05)">${lineup.replace('width="980"', 'width="980"')}</div>
</body>`);
await social.waitForTimeout(400);
await social.screenshot({ path: "assets/social-preview.png" });
await browser.close();
console.log("assets/tuner.png, assets/editor.png, assets/social-preview.png");
