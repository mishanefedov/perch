// The website build: the browser extension is promoted only when there is a Chrome Web Store link.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
let bun = true;
try { execFileSync("bun", ["--version"], { stdio: "ignore" }); } catch { bun = false; }
const ready = bun && existsSync(join(root, "dist/perch.js")) && existsSync(join(root, "extension-dist/perch-extension.zip"));

function build(store) {
  const out = mkdtempSync(join(tmpdir(), "perch-site-"));
  const env = { ...process.env, SITE_OUT: out, SITE_URL: "https://example.test", EXTENSION_STORE_URL: store };
  if (!store) delete env.EXTENSION_STORE_URL;
  execFileSync("bun", ["run", "scripts/build-site.ts"], { cwd: root, env, stdio: "ignore" });
  const read = (p) => readFileSync(join(out, p), "utf8");
  return { read, exists: (p) => existsSync(join(out, p)) };
}

test("site while the store listing is in review: the extension page says so, the home page stays focused", { skip: !ready }, () => {
  const site = build("");
  const home = site.read("index.html");
  assert.doesNotMatch(home, /id="extension"/, "no extension section on the home page: the extension page is enough");
  assert.match(home, /href="\/extension\/">Extension/, "one link in the header");
  const ask = JSON.parse(home.match(/data-ask="([^"]*)"/)[1].replace(/&quot;/g, '"'));
  assert.equal(ask.text, "Want me on every website?");
  assert.equal(ask.buttons[0].value, "/extension/", "the question opens the extension page");
  assert.match(home, /<video[^>]*autoplay/, "the demo is on the page");
  assert.doesNotMatch(home, /eyebrow|class="chips"|class="card"/, "no kicker chip, creature chips or card grid");
  const page = site.read("extension/index.html");
  assert.match(page, /Chrome Web Store: in review/, "says plainly what is going on");
  assert.match(page, /<details class="now" open>/, "the one-minute install is open");
  assert.doesNotMatch(page, /<a[^>]*>Add to Chrome/, "no button that cannot work yet");
  assert.doesNotMatch(page, /noindex/);
  assert.match(site.read("sitemap.xml"), /\/extension\/<\/loc>/);
  assert.ok(site.exists("perch-extension.zip"));
  assert.ok(site.exists("fonts/display.woff2") && site.exists("fonts/text.woff2"), "fonts are self-hosted");
});

test("site once the listing is live: Add to Chrome on the extension page, the question opens the store", { skip: !ready }, () => {
  const url = "https://chromewebstore.google.com/detail/perch/abcdefghijklmnopabcdefghijklmnop";
  const site = build(url);
  const home = site.read("index.html");
  const ask = JSON.parse(home.match(/data-ask="([^"]*)"/)[1].replace(/&quot;/g, '"'));
  assert.equal(ask.buttons[0].value, url);
  assert.equal(ask.buttons[0].newTab, true);
  const page = site.read("extension/index.html");
  assert.match(page, new RegExp(`href="${url}"[^>]*>Add to Chrome`));
  assert.doesNotMatch(page, /in review/);
  assert.match(page, /"@type":"SoftwareApplication"/);
});

test("status live plus an item id gives the public store URL", { skip: !ready }, () => {
  const out = mkdtempSync(join(tmpdir(), "perch-site-"));
  const id = "abcdefghijklmnopabcdefghijklmnop";
  const env = { ...process.env, SITE_OUT: out, SITE_URL: "https://example.test", EXTENSION_STORE_ID: id, EXTENSION_STATUS: "live" };
  delete env.EXTENSION_STORE_URL;
  execFileSync("bun", ["run", "scripts/build-site.ts"], { cwd: root, env, stdio: "ignore" });
  assert.match(readFileSync(join(out, "extension/index.html"), "utf8"), new RegExp(`href="https://chromewebstore.google.com/detail/${id}"[^>]*>Add to Chrome`));
});
