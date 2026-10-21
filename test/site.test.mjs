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

test("site without a store link: the extension is still promoted, the page shows the install steps right away", { skip: !ready }, () => {
  const site = build("");
  const home = site.read("index.html");
  assert.match(home, /id="extension"/, "extension section on the home page");
  assert.match(home, /href="\/extension\/#install"[^>]*>Get the extension/, "its button opens the install steps");
  assert.match(home, /href="\/extension\/">Extension/, "nav link");
  const ask = JSON.parse(home.match(/data-ask="([^"]*)"/)[1].replace(/&quot;/g, '"'));
  assert.equal(ask.text, "Want me on every website?", "the creature asks about the extension by default");
  assert.equal(ask.buttons[0].value, "/extension/#install");
  const page = site.read("extension/index.html");
  assert.doesNotMatch(page, /noindex/);
  assert.doesNotMatch(page, /Add to Chrome/);
  assert.match(page, /<ol id="manual">/, "the install steps are visible, not hidden");
  assert.match(site.read("sitemap.xml"), /\/extension\/<\/loc>/);
  assert.match(site.read("llms.txt"), /Browser extension/);
  assert.ok(site.exists("perch-extension.zip"));
});

test("site with a store link: Add to Chrome everywhere, the creature asks about it, page is indexed", { skip: !ready }, () => {
  const url = "https://chromewebstore.google.com/detail/perch/abcdef";
  const site = build(url);
  const home = site.read("index.html");
  assert.match(home, /id="extension"/);
  assert.match(home, new RegExp(`href="${url}"[^>]*>Add to Chrome`));
  const ask = JSON.parse(home.match(/data-ask="([^"]*)"/)[1].replace(/&quot;/g, '"'));
  assert.equal(ask.text, "Want me on every website?");
  assert.equal(ask.buttons[0].value, url, "the question opens the store listing");
  assert.equal(ask.buttons[0].newTab, true);
  assert.match(home, /href="\/extension\/">Extension/);
  assert.doesNotMatch(site.read("extension/index.html"), /<ol id="manual">/, "with a store link the page leads with Add to Chrome and the source install is tucked away");
  const page = site.read("extension/index.html");
  assert.doesNotMatch(page, /noindex/);
  assert.match(page, new RegExp(`href="${url}"[^>]*>Add to Chrome`));
  assert.match(page, /"@type":"SoftwareApplication"/);
  assert.match(site.read("sitemap.xml"), /\/extension\/<\/loc>/);
  assert.match(site.read("llms.txt"), /Browser extension/);
});
