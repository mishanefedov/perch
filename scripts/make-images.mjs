// Screenshots for the README and the GitHub social preview.
//   bun run build && (bun run demo &) && node scripts/make-images.mjs
import { chromium } from "playwright-core";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const chrome = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome"].find(existsSync);
const browser = await chromium.launch({ executablePath: chrome });

// the tuner and the editor on the demo page
const page = await browser.newPage({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: 1.5 });
await page.goto("http://localhost:4173/fixtures/acme.html");
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
// icons and the Open Graph image for the website (site/static)
const logoSvg = readFileSync("site/static/logo.svg", "utf8");
const icon = async (size, name, pad) => {
  const p = await browser.newPage({ viewport: { width: size, height: size } });
  await p.setContent(`<body style="margin:0;width:${size}px;height:${size}px;background:#0b1020;display:grid;place-items:center"><div style="width:${size - pad * 2}px">${logoSvg.replace(/width="\d+" height="\d+"/, 'width="100%" height="auto"')}</div></body>`);
  await p.screenshot({ path: `site/static/${name}` });
  await p.close();
};
await icon(180, "apple-touch-icon.png", 24);
await icon(512, "icon-512.png", 70);
await icon(32, "icon-32.png", 2);
const og = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await og.setContent(`<body style="margin:0;width:1200px;height:630px;background:#0b1020;color:#fff;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;overflow:hidden">
  <div style="font-size:112px;font-weight:800;letter-spacing:-4px;line-height:1">perch</div>
  <div style="font-size:36px;color:#cbd5e1;text-align:center;max-width:960px;line-height:1.3">A pixel mascot for your website.<br>One script tag.</div>
  <div style="margin-top:8px;transform:scale(1.0)">${lineup}</div>
  <div style="font:600 24px ui-monospace,Menlo,monospace;color:#94a3b8">npx perch-pet</div>
</body>`);
await og.waitForTimeout(300);
await og.screenshot({ path: "site/static/og.png" });
await browser.close();
console.log("assets/tuner.png, assets/editor.png, assets/social-preview.png, site/static icons and og.png");
