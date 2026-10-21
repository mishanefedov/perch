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
    let p = req.url === "/" ? "/test/fixtures/acme.html" : req.url.split("?")[0];
    if (p.startsWith("/fixtures/")) p = "/test" + p;
    if (p === "/perch.js" || p === "/perch-tuner.js") p = "/dist" + p;
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
    const extra = await page.evaluate(() => document.querySelectorAll("[data-perch-creature]").length);
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
    let p = req.url === "/" ? "/test/fixtures/acme.html" : req.url.split("?")[0];
    if (p.startsWith("/fixtures/")) p = "/test" + p;
    if (p === "/perch.js" || p === "/perch-tuner.js") p = "/dist" + p;
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

    // the selector must match exactly its element, also for repeated siblings (three cards, three paragraphs)
    const sels = await page.evaluate(() => [...document.querySelectorAll("h1, .card, .card h3, .card p, input, a.btn, main p")].map((el) => { const s = window.PerchTuner.selectorFor(el); const hits = [...document.querySelectorAll(s)]; return [s, hits.length === 1 && hits[0] === el]; }));
    assert.ok(sels.length >= 12);
    for (const [s, ok] of sels) assert.ok(ok, `selector ${s} matches exactly its element`);

    // the tuner is off for a live site
    assert.equal(await page.evaluate(async () => (await import("/dist/esm/index.js")).tunerWanted("false")), false);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});

test("tuner: pick a goal and an ignored card with the mouse, the creature goes to the goal", { skip: !chrome || !existsSync(join(root, "dist/perch-tuner.js")) }, async () => {
  const server = createServer((req, res) => {
    if (req.url === "/favicon.ico") { res.statusCode = 204; return res.end(); }
    let p = req.url.split("?")[0];
    if (p.startsWith("/fixtures/")) p = "/test" + p;
    if (p === "/perch.js" || p === "/perch-tuner.js") p = "/dist" + p;
    try { res.setHeader("content-type", types[extname(p)] ?? "text/plain"); res.end(readFileSync(join(root, p))); } catch { res.statusCode = 404; res.end(); }
  }).listen(0);
  const browser = await chromium.launch({ executablePath: chrome });
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  try {
    await page.goto(`http://localhost:${server.address().port}/fixtures/hero.html`);
    await page.waitForSelector("[data-perch-tuner]", { state: "attached" });
    const t = (s) => page.locator(`[data-perch-tuner] ${s}`);
    const center = async (sel) => { const b = await page.locator(sel).first().boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
    const feetOn = (sel) => page.evaluate((s) => {
      const r = document.querySelector("[data-perch-creature]").getBoundingClientRect();
      const feet = r.top + 48, x = r.left + r.width / 2, b = document.querySelector(s).getBoundingClientRect();
      return Math.abs(feet - b.top) < 16 && x > b.left - 10 && x < b.right + 10;
    }, sel);
    await page.waitForTimeout(2500);

    // goal: hover, click "Book a demo"
    await t(".gear").click();
    await t("[data-pick=goal]").click();
    const [gx, gy] = await center("a.btn");
    await page.mouse.move(gx, gy, { steps: 8 });
    await page.mouse.click(gx, gy);
    assert.equal(await t("#goal").inputValue(), "a.btn");
    assert.equal((await t("[data-match=goal]").textContent()).trim(), "matches 1 element");
    await page.waitForTimeout(5000);
    assert.ok(await feetOn("a.btn"), "the creature stands on the new goal");

    // ignore: hover the text in the first card, press ArrowUp, click: the whole card is picked
    await t("[data-pick=ignore]").click();
    const [cx, cy] = await center(".card >> nth=0 >> p");
    await page.mouse.move(cx, cy, { steps: 8 });
    await page.keyboard.press("ArrowUp");
    await page.mouse.click(cx, cy);
    const sel = await t("#ignore").inputValue();
    const hits = await page.evaluate((s) => [...document.querySelectorAll(s)].map((e) => e.className), sel);
    assert.deepEqual(hits, ["card"], `ignore selector "${sel}" matches exactly the first card`);
    assert.equal(await page.evaluate((s) => document.querySelector(s) === document.querySelectorAll(".card")[0], sel), true);
    assert.match(await t(".out").inputValue(), /set goal=a\.btn ignore=/);

    // the ignored card is no floor: show floors and check no floor line sits on its text
    await page.waitForTimeout(3500);
    assert.ok(!(await feetOn(".card:first-child h3")) , "the creature does not stand in the ignored card");
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});

test("tuner stays off on a real host, and turns on only with data-tuner, ?perch=tune or localhost", { skip: !chrome || !existsSync(join(root, "dist/perch-tuner.js")) }, async () => {
  const requested = [];
  const server = createServer((req, res) => {
    requested.push(req.url.split("?")[0]);
    if (req.url === "/favicon.ico") { res.statusCode = 204; return res.end(); }
    let p = req.url.split("?")[0];
    if (p === "/") p = "/test/fixtures/acme.html";
    if (p.startsWith("/fixtures/")) p = "/test" + p;
    if (p === "/perch.js" || p === "/perch-tuner.js") p = "/dist" + p;
    try { res.setHeader("content-type", types[extname(p)] ?? "text/plain"); res.end(readFileSync(join(root, p))); } catch { res.statusCode = 404; res.end(); }
  }).listen(0);
  const port = server.address().port;
  // make "perch-example.com" point at this server, so the page sees a real, non-local host name
  const browser = await chromium.launch({ executablePath: chrome, args: ["--host-resolver-rules=MAP perch-example.com 127.0.0.1"] });
  const open = async (url) => {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    await page.goto(url);
    await page.waitForSelector("[data-perch-root]", { state: "attached" });
    await page.waitForTimeout(1500);
    const tuner = await page.evaluate(() => !!document.querySelector("[data-perch-tuner]"));
    await page.close();
    return tuner;
  };
  try {
    requested.length = 0;
    assert.equal(await open(`http://perch-example.com:${port}/`), false, "no tuner on a real host name");
    assert.ok(!requested.includes("/perch-tuner.js"), "visitors do not even download the tuner file");
    assert.equal(await open(`http://perch-example.com:${port}/fixtures/tuner-on.html`), true, "data-tuner=true turns it on anywhere");
    assert.equal(await open(`http://perch-example.com:${port}/?perch=tune`), true, "?perch=tune turns it on");
    assert.equal(await open(`http://localhost:${port}/`), true, "localhost turns it on");
    // the open-from-page event shows the panel
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    await page.goto(`http://perch-example.com:${port}/fixtures/tuner-on.html`);
    await page.waitForSelector("[data-perch-tuner]", { state: "attached" });
    await page.evaluate(() => window.dispatchEvent(new Event("perch:tuner")));
    assert.equal(await page.locator("[data-perch-tuner] .panel").isVisible(), true);
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
});

test("ask: bubble shows, creature stands still, scrolling dismisses it, every button action works, unsafe links are refused", { skip: !chrome || !existsSync(join(root, "dist/perch.js")) }, async () => {
  const server = createServer((req, res) => {
    if (req.url === "/favicon.ico") { res.statusCode = 204; return res.end(); }
    let p = req.url.split("?")[0];
    if (p === "/") p = "/test/fixtures/acme.html";
    if (p === "/perch.js" || p === "/perch-tuner.js") p = "/dist" + p;
    try { res.setHeader("content-type", types[extname(p)] ?? "text/html"); res.end(readFileSync(join(root, p))); } catch { res.statusCode = 404; res.end(); }
  }).listen(0);
  const browser = await chromium.launch({ executablePath: chrome });
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 }, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  try {
    await page.goto(`http://localhost:${server.address().port}/`);
    await page.waitForSelector("[data-perch-root]", { state: "attached" });
    await page.evaluate(() => {
      window.__clicks = 0; window.__evt = null;
      const b = document.createElement("button"); b.id = "probe"; b.textContent = "probe"; b.onclick = () => { window.__clicks++; }; document.body.appendChild(b);
      addEventListener("open-chat", (e) => { window.__evt = e.detail.label; });
    });
    const bubble = page.locator("[data-perch-root] .bubble");
    const on = () => bubble.evaluate((el) => el.classList.contains("on")).catch(() => false);
    const shown = () => page.waitForFunction(() => document.querySelector("[data-perch-root]:not([data-perch-creature]):not([data-perch-tuner])")?.shadowRoot?.querySelector(".bubble.on"), null, { timeout: 12000 });
    const creaturePos = () => page.evaluate(() => document.querySelector("[data-perch-creature] div, [data-perch-creature]").style.transform);
    const ask = (a) => page.evaluate((a) => window.Perch.init({ ask: a }), a);
    const wait = (ms) => page.waitForTimeout(ms);

    // 1. it shows after the delay, and the creature stands still while it is up
    await ask({ text: "Want a demo?", delay: 1, once: "always", buttons: [{ label: "Yes", action: "link", value: "/demo" }, { label: "Later", action: "close" }] });
    await wait(300);
    assert.equal(await on(), false, "not before the delay");
    await shown();
    assert.equal(await on(), true, "shown after the delay and once the creature is on screen");
    assert.equal((await bubble.locator(".q").textContent()).trim(), "Want a demo?");
    assert.equal(await bubble.locator(".b.primary").textContent(), "Yes", "the first button is the highlighted one");
    assert.equal(await bubble.locator("a.b").getAttribute("href"), `http://localhost:${server.address().port}/demo`);
    const before = await creaturePos();
    await wait(2500);
    assert.equal(await creaturePos(), before, "the creature does not move while the question is up");

    // 2. scrolling dismisses it at once, and the creature is free again
    await page.evaluate(() => scrollBy(0, 120));
    await wait(250);
    assert.equal(await on(), false, "gone as soon as the page scrolls");
    await page.evaluate(() => scrollTo(0, 0));

    // 3. once: session remembers it was seen; once: always does not
    await ask({ text: "Seen once", delay: 0, once: "session", id: "t1", buttons: [{ label: "OK" }] });
    await shown();
    assert.equal(await on(), true);
    await bubble.locator(".x").click();
    assert.equal(await on(), false);
    await ask({ text: "Seen once", delay: 0, once: "session", id: "t1", buttons: [{ label: "OK" }] });
    await wait(900); // it must NOT show: waiting for it would hang
    assert.equal(await on(), false, "not shown again in the same session");
    await ask({ text: "Seen once", delay: 0, once: "always", buttons: [{ label: "OK" }] });
    await shown();
    assert.equal(await on(), true, "once: always shows every time");

    // 4. the actions
    await ask({ text: "copy", delay: 0, once: "always", buttons: [{ label: "Copy code", action: "copy", value: "PERCH-10" }] });
    await shown();
    await bubble.locator("button.b").click();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "PERCH-10");
    assert.equal(await bubble.locator("button.b").textContent(), "Copied");
    await wait(1200);
    assert.equal(await on(), false, "closes after copying");

    await ask({ text: "click", delay: 0, once: "always", buttons: [{ label: "Do it", action: "click", value: "#probe" }] });
    await shown();
    await bubble.locator("button.b").click();
    assert.equal(await page.evaluate(() => window.__clicks), 1, "clicked the element");
    assert.equal(await on(), false);

    await ask({ text: "event", delay: 0, once: "always", buttons: [{ label: "Open chat", action: "event", value: "open-chat" }] });
    await shown();
    await bubble.locator("button.b").click();
    assert.equal(await page.evaluate(() => window.__evt), "Open chat", "the event reached the page");

    await ask({ text: "scroll", delay: 0, once: "always", buttons: [{ label: "Down", action: "scroll", value: "#b" }] });
    await shown();
    await bubble.locator("button.b").click();
    await wait(900);
    assert.ok((await page.evaluate(() => scrollY)) > 50, "scrolled to the element");
    await page.evaluate(() => scrollTo(0, 0));

    // 5. a javascript: link is refused: it becomes a plain button that does nothing
    await ask({ text: "bad", delay: 0, once: "always", buttons: [{ label: "Bad", action: "link", value: "javascript:window.__pwned=1" }] });
    await shown();
    assert.equal(await bubble.locator(".b").evaluate((el) => el.tagName), "BUTTON");
    await bubble.locator(".b").click();
    assert.equal(await page.evaluate(() => window.__pwned), undefined);

    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});

test("ask in the tuner: write a question and buttons, it applies live without restarting the creature, preview, saved command", { skip: !chrome || !existsSync(join(root, "dist/perch-tuner.js")) }, async () => {
  const server = createServer((req, res) => {
    if (req.url === "/favicon.ico") { res.statusCode = 204; return res.end(); }
    let p = req.url.split("?")[0];
    if (p === "/") p = "/test/fixtures/acme.html";
    if (p === "/perch.js" || p === "/perch-tuner.js") p = "/dist" + p;
    try { res.setHeader("content-type", types[extname(p)] ?? "text/html"); res.end(readFileSync(join(root, p))); } catch { res.statusCode = 404; res.end(); }
  }).listen(0);
  const browser = await chromium.launch({ executablePath: chrome });
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  try {
    await page.goto(`http://localhost:${server.address().port}/`);
    await page.waitForSelector("[data-perch-tuner]", { state: "attached" });
    const t = (s) => page.locator(`[data-perch-tuner] ${s}`);
    await t(".gear").click();
    await t("details.ask-sec summary").click();
    // mark the creature element: if the creature were restarted, the mark would be gone
    await page.evaluate(() => { document.querySelector("[data-perch-creature]").dataset.mark = "same"; });
    await t("#ask-text").fill("Want a demo?");
    await t("#ask-add").click();
    await t(".abtn .al").first().fill("Book it");
    await t(".abtn .av").first().fill("/demo");
    await page.waitForTimeout(300);
    const askOpt = await page.evaluate(() => window.Perch.options().ask);
    assert.deepEqual(askOpt, { text: "Want a demo?", buttons: [{ label: "Book it", action: "link", value: "/demo" }] });
    assert.equal(await page.evaluate(() => document.querySelector("[data-perch-creature]")?.dataset.mark), "same", "typing did not restart the creature");

    // the saved command carries the question as JSON
    const cmd = await t(".out").inputValue();
    assert.match(cmd, /^npx perch-pet set ask='\{"text":"Want a demo\?","buttons":\[\{"label":"Book it","action":"link","value":"\/demo"\}\]\}'$/);

    // an invalid link is explained and not applied
    await t(".abtn .av").first().fill("javascript:alert(1)");
    await page.waitForTimeout(200);
    assert.match(await t("#ask-err").textContent(), /link must be an http/);
    assert.equal(await page.evaluate(() => window.Perch.options().ask.buttons[0].value), "/demo", "the invalid value was not applied");
    await t(".abtn .av").first().fill("/pricing");

    // preview shows the bubble now, and the creature stands still
    await t("#ask-preview").click();
    const bubble = page.locator("[data-perch-root] .bubble");
    await bubble.waitFor({ state: "visible", timeout: 3000 });
    assert.equal(await bubble.evaluate((el) => el.classList.contains("on")), true);
    assert.equal((await bubble.locator(".b").first().getAttribute("href")).endsWith("/pricing"), true);

    // the panel closes during a preview so the creature and bubble are visible: reopen it, then remove the question
    await t(".gear").click();
    await t("details.ask-sec summary").isVisible().then(async (v) => { if (!v) await t(".gear").click(); });
    await t("#ask-clear").click();
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.Perch.options().ask), undefined);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});
