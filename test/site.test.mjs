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

test("site without a store link: no extension promotion, extension page is a quiet 'coming soon'", { skip: !ready }, () => {
  const site = build("");
  const home = site.read("index.html");
  assert.doesNotMatch(home, /id="extension"/, "no extension section on the home page");
  assert.doesNotMatch(home, /data-ask/, "no speech bubble that points at an extension nobody can install");
  assert.doesNotMatch(home, /href="\/extension\/"/, "no link to the extension page from the home page");
  const page = site.read("extension/index.html");
  assert.match(page, /noindex/, "the coming-soon page is not indexed");
  assert.doesNotMatch(page, /Add to Chrome/);
  assert.match(page, /<details id="manual">/, "the manual install is tucked away for developers");
  assert.match(page, /coming to the Chrome Web Store/);
  assert.doesNotMatch(site.read("sitemap.xml"), /\/extension\/<\/loc>/, "the coming-soon page is not in the sitemap (the privacy page may be)");
  assert.doesNotMatch(site.read("llms.txt"), /Browser extension/);
  assert.ok(site.exists("perch-extension.zip"), "the zip is still served for developers");
});

test("site with a store link: Add to Chrome everywhere, the creature asks about it, page is indexed", { skip: !ready }, () => {
  const url = "https://chromewebstore.google.com/detail/perch/abcdef";
  const site = build(url);
  const home = site.read("index.html");
  assert.match(home, /id="extension"/);
  assert.match(home, new RegExp(`href="${url}"[^>]*>Add to Chrome`));
  const ask = JSON.parse(home.match(/data-ask="([^"]*)"/)[1].replace(/&quot;/g, '"'));
  assert.equal(ask.text, "Want me on every website?");
  assert.equal(ask.buttons[0].value, "/extension/");
  assert.match(home, /href="\/extension\/">Extension/);
  const page = site.read("extension/index.html");
  assert.doesNotMatch(page, /noindex/);
  assert.match(page, new RegExp(`href="${url}"[^>]*>Add to Chrome`));
  assert.match(page, /"@type":"SoftwareApplication"/);
  assert.match(site.read("sitemap.xml"), /\/extension\/<\/loc>/);
  assert.match(site.read("llms.txt"), /Browser extension/);
});
