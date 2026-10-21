// The setup command, run against throwaway projects for each supported framework.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { run } from "../cli/run.mjs";

const quiet = () => {};

function project(files) {
  const dir = mkdtempSync(join(tmpdir(), "perch-"));
  for (const [p, c] of Object.entries(files)) { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), c); }
  return dir;
}
const read = (dir, p) => readFileSync(join(dir, p), "utf8");
const pkg = (deps) => JSON.stringify({ dependencies: deps });

const CASES = {
  "next app router": {
    files: { "package.json": pkg({ next: "16" }), "app/layout.tsx": `"use client";\nimport type { ReactNode } from "react";\n\nexport default function L({ children }: { children: ReactNode }) {\n  return (\n    <html>\n      <body>\n        {children}\n      </body>\n    </html>\n  );\n}\n`, "public/.keep": "" },
    layout: "app/layout.tsx", expect: [/import Script from "next\/script"; \/\/ perch-pet/, /<Script src="\/perch\.js" strategy="afterInteractive"/],
  },
  "next app router in src with existing Script import": {
    files: { "package.json": pkg({ next: "16" }), "src/app/layout.jsx": `import Script from "next/script";\nexport default function L({ children }) {\n  return <html><body>{children}</body></html>;\n}\n` },
    layout: "src/app/layout.jsx", expect: [/<Script src="\/perch\.js"/], notExpect: [/perch-pet/],
  },
  "next pages router": {
    files: { "package.json": pkg({ next: "14" }), "pages/_document.js": `import { Html, Head, Main, NextScript } from "next/document";\nexport default function D() {\n  return (\n    <Html>\n      <Head />\n      <body>\n        <Main />\n        <NextScript />\n      </body>\n    </Html>\n  );\n}\n` },
    layout: "pages/_document.js", expect: [/<NextScript \/>\n\s+<script src="\/perch\.js" defer[^>]*><\/script>/],
  },
  "astro": {
    files: { "package.json": pkg({ astro: "5" }), "src/layouts/Base.astro": `---\n---\n<html>\n  <body>\n    <slot />\n  </body>\n</html>\n` },
    layout: "src/layouts/Base.astro", expect: [/<script is:inline src="\/perch\.js" defer[^>]*><\/script>/], pub: "public/perch.js",
  },
  "sveltekit": {
    files: { "package.json": pkg({ "@sveltejs/kit": "2" }), "src/app.html": `<!doctype html>\n<html>\n<body>\n  <div>%sveltekit.body%</div>\n</body>\n</html>\n` },
    layout: "src/app.html", expect: [/<script src="\/perch\.js" defer[^>]*><\/script>/], pub: "static/perch.js",
  },
  "vite": {
    files: { "package.json": pkg({ vite: "6" }), "vite.config.ts": "export default {}", "index.html": `<html>\n<body>\n  <div id="root"></div>\n</body>\n</html>\n` },
    layout: "index.html", expect: [/<script src="\/perch\.js" defer[^>]*><\/script>/], pub: "public/perch.js",
  },
  "plain html": {
    files: { "index.html": `<html><body><h1>Hi</h1></body></html>` },
    layout: "index.html", expect: [/<script src="\/perch\.js" defer[^>]*><\/script><\/body>/], pub: "perch.js",
  },
  "nuxt": {
    files: { "package.json": pkg({ nuxt: "3" }) },
    layout: "plugins/perch.client.ts", expect: [/defineNuxtPlugin/, /document\.createElement\("script"\)/], pub: "public/perch.js",
  },
};

for (const [name, c] of Object.entries(CASES)) {
  test(`installs, is idempotent and removes cleanly: ${name}`, async () => {
    const dir = project(c.files);
    const before = existsSync(join(dir, c.layout)) ? read(dir, c.layout) : null;
    assert.equal(await run(["--dry"], dir, quiet), 0);
    assert.ok(!existsSync(join(dir, c.pub ?? "public/perch.js")), "dry run writes nothing");
    assert.equal(await run(["--creature", "blob", "--stickiness", "0.8"], dir, quiet), 0);
    const after = read(dir, c.layout);
    for (const re of c.expect) assert.match(after, re);
    for (const re of c.notExpect ?? []) assert.doesNotMatch(after, re);
    assert.match(after, /data-creature="blob"|"data-creature", "blob"/);
    assert.ok(existsSync(join(dir, c.pub ?? "public/perch.js")), "perch.js copied");
    await run([], dir, quiet);
    assert.equal(read(dir, c.layout).split("/perch.js").length - 1, after.split("/perch.js").length - 1, "second run adds nothing");
    assert.equal(await run(["--remove"], dir, quiet), 0);
    assert.ok(!existsSync(join(dir, c.pub ?? "public/perch.js")), "perch.js removed");
    if (before !== null) assert.equal(read(dir, c.layout), before, "layout file is back to the original");
    else assert.ok(!existsSync(join(dir, c.layout)), "created file is removed");
  });
}

test("next pages router without _document creates one", async () => {
  const dir = project({ "package.json": pkg({ next: "14" }), "pages/index.js": "export default () => null" });
  await run([], dir, quiet);
  assert.match(read(dir, "pages/_document.js"), /<script src="\/perch\.js" defer/);
  await run(["--remove"], dir, quiet);
  assert.ok(!existsSync(join(dir, "pages/_document.js")));
});

test("unknown project: prints the manual line and fails soft", async () => {
  const dir = project({ "readme.txt": "x" });
  const lines = [];
  assert.equal(await run([], dir, (l) => lines.push(l)), 1);
  assert.match(lines.join("\n"), /<script src="\/perch\.js" defer/);
});
