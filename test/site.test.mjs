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

function build(store, stars) {
  const out = mkdtempSync(join(tmpdir(), "perch-site-"));
  const env = { ...process.env, SITE_OUT: out, SITE_URL: "https://example.test", EXTENSION_STORE_URL: store, GITHUB_STARS: stars ?? "0" };
  if (!store) delete env.EXTENSION_STORE_URL;
  execFileSync("bun", ["run", "scripts/build-site.ts"], { cwd: root, env, stdio: "ignore" });
  const read = (p) => readFileSync(join(out, p), "utf8");
  return { read, exists: (p) => existsSync(join(out, p)) };
}

test("site while the store listing is in review: it says so, the install is right there, nothing redirects", { skip: !ready }, () => {
  const site = build("");
  const home = site.read("index.html");
  assert.doesNotMatch(home, /id="extension"/, "no extension section on the home page: the extension page is enough");
  
  assert.match(home, /href="\/extension\/">get the browser extension/);
  const ask = JSON.parse(home.match(/data-ask="([^"]*)"/)[1].replace(/&quot;/g, '"'));
  assert.equal(ask.text, "Want me on every website?");
  assert.equal(ask.buttons[0].value, "/extension/", "the question opens the extension page");
  const page = site.read("extension/index.html");
  assert.match(page, /<details class="now" open>/, "on the extension page the steps are already open");
  assert.match(page, /Chrome Web Store: in review/);
  assert.doesNotMatch(page, /noindex/);
  assert.match(site.read("sitemap.xml"), /\/extension\/<\/loc>/);
  assert.ok(site.exists("perch-extension.zip"));
});

test("site once the listing is live: Add to Chrome everywhere, the question opens the store", { skip: !ready }, () => {
  const url = "https://chromewebstore.google.com/detail/perch/abcdefghijklmnopabcdefghijklmnop";
  const site = build(url);
  const home = site.read("index.html");
  assert.doesNotMatch(home, /in review/);
  const ask = JSON.parse(home.match(/data-ask="([^"]*)"/)[1].replace(/&quot;/g, '"'));
  assert.equal(ask.buttons[0].value, url);
  assert.equal(ask.buttons[0].newTab, true);
  const page = site.read("extension/index.html");
  assert.match(page, new RegExp(`href="${url}"[^>]*>Add to Chrome`));
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

test("star ask: GitHub icon, a reasoned ask, the count only once it is worth showing; creatures sit above See it work", { skip: !ready }, () => {
  const few = build("", "3").read("index.html");
  assert.match(few, /<a class="gh"[^>]*><svg class="icon"[^>]*aria-hidden="true">/, "GitHub icon in the header");
  assert.doesNotMatch(few, /class="count"/, "no star count while it is small");
  assert.match(few, /Star on GitHub/);
  assert.match(few, /Useful\? <a[^>]*>Star it on GitHub<\/a>\. It is the easiest way to help other people find Perch/, "the ask comes with a reason");
  assert.ok(few.indexOf('id="creatures"') > 0 && few.indexOf('id="creatures"') < few.indexOf('id="demo"'), "the six creatures sit directly above See it work");
  assert.match(build("", "1234").read("index.html"), /<span class="count" aria-label="1234 stars">1\.2k<\/span>/, "the count shows once it is large");
});
