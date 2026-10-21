// Finding where the tag can go: every candidate, auto-pick, menu for people, --file for agents.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { run, findCandidates, autoPick, candidateFromFile } from "../cli/run.mjs";

function project(files) {
  const dir = mkdtempSync(join(tmpdir(), "perch-"));
  for (const [p, c] of Object.entries(files)) { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), c); }
  return dir;
}
const pkg = (deps) => JSON.stringify({ dependencies: deps });
const layout = (extra = "") => `export default function L({ children }) {\n  return (\n    <html>\n      <body>\n        {children}${extra}\n      </body>\n    </html>\n  );\n}\n`;
const capture = async (args, dir, io) => { const l = []; const code = await run(args, dir, (x) => l.push(x), io); return { code, text: l.join("\n") }; };
const noTty = { isTTY: false, ask: async () => { throw new Error("must not ask"); } };
const tty = (...answers) => ({ isTTY: true, ask: async () => answers.shift() ?? "" });

test("next app with only a route-group layout (no app/layout.tsx) is found", async () => {
  const dir = project({ "package.json": pkg({ next: "16" }), "app/(site)/layout.tsx": layout(), "app/(site)/page.tsx": "export default () => null" });
  const list = findCandidates(dir);
  assert.equal(list.length, 1);
  assert.equal(list[0].kind, "next-app");
  assert.match(list[0].file, /app\/\(site\)\/layout\.tsx$/);
  assert.equal(autoPick(list).id, 1);
  assert.equal((await capture([], dir, noTty)).code, 0);
  assert.match(readFileSync(join(dir, "app/(site)/layout.tsx"), "utf8"), /<Script src="\/perch\.js"/);
  assert.ok(existsSync(join(dir, "public/perch.js")));
});

test("a real root layout beats nested route-group layouts", async () => {
  const dir = project({ "package.json": pkg({ next: "16" }), "app/layout.tsx": layout(), "app/(shop)/layout.tsx": layout(), "app/blog/layout.tsx": "export default function B({ children }) { return children; }" });
  const list = findCandidates(dir);
  assert.deepEqual(list.map((c) => c.file.replace(dir + "/", "")), ["app/layout.tsx", "app/(shop)/layout.tsx"]); // blog/layout has no <body>, so it is not a candidate
  assert.equal(autoPick(list).file, join(dir, "app/layout.tsx"));
});

const TWO_GROUPS = { "package.json": pkg({ next: "16" }), "app/(marketing)/layout.tsx": layout(), "app/(app)/layout.tsx": layout() };

test("several equal choices: a script gets a clear list and exit code 2, nothing is written", async () => {
  const dir = project(TWO_GROUPS);
  const r = await capture([], dir, noTty);
  assert.equal(r.code, 2);
  assert.match(r.text, /npx perch-pet --file "app\/\(app\)\/layout\.tsx"/);
  assert.match(r.text, /npx perch-pet --file "app\/\(marketing\)\/layout\.tsx"/);
  assert.ok(!existsSync(join(dir, "public/perch.js")));
});

test("detect lists every candidate as JSON and says a choice is needed", async () => {
  const dir = project(TWO_GROUPS);
  const j = JSON.parse((await capture(["detect"], dir, noTty)).text);
  assert.equal(j.needsChoice, true);
  assert.equal(j.framework, null);
  assert.equal(j.candidates.length, 2);
  assert.deepEqual(j.candidates.map((c) => c.id), [1, 2]);
  assert.ok(j.candidates.every((c) => c.kind === "next-app" && c.installed === false));
});

test("--file picks one, repeated --file picks several, --yes takes the first", async () => {
  const one = project(TWO_GROUPS);
  assert.equal((await capture(["--file", "app/(app)/layout.tsx"], one, noTty)).code, 0);
  assert.match(readFileSync(join(one, "app/(app)/layout.tsx"), "utf8"), /perch\.js/);
  assert.doesNotMatch(readFileSync(join(one, "app/(marketing)/layout.tsx"), "utf8"), /perch\.js/);

  const both = project(TWO_GROUPS);
  await capture(["--file", "app/(app)/layout.tsx", "--file", "app/(marketing)/layout.tsx"], both, noTty);
  for (const g of ["app", "marketing"]) assert.match(readFileSync(join(both, `app/(${g})/layout.tsx`), "utf8"), /perch\.js/);

  const yes = project(TWO_GROUPS);
  assert.equal((await capture(["--yes"], yes, noTty)).code, 0);
  const hits = ["app", "marketing"].filter((g) => /perch\.js/.test(readFileSync(join(yes, `app/(${g})/layout.tsx`), "utf8")));
  assert.equal(hits.length, 1);
});

test("a person at the terminal gets a menu: number, several numbers, pasted path, Enter", async () => {
  const menu = await capture([], project(TWO_GROUPS), tty("1"));
  assert.match(menu.text, /Found 2 places/);
  assert.match(menu.text, /1\) Next\.js layout \(route group\)\s+app\/\(app\)\/layout\.tsx\s+\(recommended\)/);

  const two = project(TWO_GROUPS);
  await capture([], two, tty("1,2"));
  for (const g of ["app", "marketing"]) assert.match(readFileSync(join(two, `app/(${g})/layout.tsx`), "utf8"), /perch\.js/);

  const enter = project(TWO_GROUPS);
  await capture([], enter, tty(""));
  assert.match(readFileSync(join(enter, "app/(app)/layout.tsx"), "utf8"), /perch\.js/);

  const pasted = project({ ...TWO_GROUPS, "public/landing.html": "<html><body><h1>x</h1></body></html>" });
  await capture([], pasted, tty(join(pasted, "public/landing.html")));
  assert.match(readFileSync(join(pasted, "public/landing.html"), "utf8"), /<script src="\/perch\.js" defer><\/script>/);

  const bad = project(TWO_GROUPS);
  const r = await capture([], bad, tty("9", "1"));
  assert.match(r.text, /Choose numbers between 1 and 2/);
  assert.match(readFileSync(join(bad, "app/(app)/layout.tsx"), "utf8"), /perch\.js/);
});

test("pasting a folder finds the project inside it", async () => {
  const dir = project({ "readme.md": "x", "web/package.json": pkg({ next: "16" }), "web/app/layout.tsx": layout(), "docs/package.json": pkg({ astro: "5" }), "docs/src/layouts/Base.astro": "<html><body><slot/></body></html>" });
  const list = findCandidates(dir);
  assert.equal(list.length, 2); // a monorepo root: both projects are offered
  const r = await capture([], dir, tty(join(dir, "web")));
  assert.match(readFileSync(join(dir, "web/app/layout.tsx"), "utf8"), /perch\.js/);
  assert.ok(existsSync(join(dir, "web/public/perch.js")));
  assert.doesNotMatch(readFileSync(join(dir, "docs/src/layouts/Base.astro"), "utf8"), /perch\.js/);
  assert.match(r.text, /Found 2 places/);
});

test("run from a repo root: a project one folder down is found, even with one candidate", async () => {
  const dir = project({ "landing/site/package.json": pkg({ next: "16" }), "landing/site/app/(site)/layout.tsx": layout() });
  assert.equal(findCandidates(dir).length, 1);
  assert.equal((await capture([], dir, noTty)).code, 0);
  assert.ok(existsSync(join(dir, "landing/site/public/perch.js")));
});

test("set, remove and creature act on every installed place", async () => {
  const dir = project(TWO_GROUPS);
  await capture(["--file", "app/(app)/layout.tsx", "--file", "app/(marketing)/layout.tsx", "--creature", "blob"], dir, noTty);
  await capture(["set", "stickiness=0.9"], dir, noTty);
  for (const g of ["app", "marketing"]) assert.match(readFileSync(join(dir, `app/(${g})/layout.tsx`), "utf8"), /data-stickiness="0\.9"/);
  const j = JSON.parse((await capture(["detect"], dir, noTty)).text);
  assert.equal(j.installed, true);
  assert.deepEqual(j.candidates.map((c) => c.installed), [true, true]);
  await capture(["--remove"], dir, noTty);
  for (const g of ["app", "marketing"]) assert.doesNotMatch(readFileSync(join(dir, `app/(${g})/layout.tsx`), "utf8"), /perch/);
  assert.ok(!existsSync(join(dir, "public/perch.js")));
});

test("--file rejects a file with no <body>, and --public changes the folder", async () => {
  const dir = project({ "package.json": pkg({ next: "16" }), "app/nested/layout.tsx": "export default function N({ children }) { return children; }", "app/layout.tsx": layout() });
  await assert.rejects(run(["--file", "app/nested/layout.tsx"], dir, () => {}, noTty), /no <\/body>/);
  await capture(["--public", "static-files"], dir, noTty);
  assert.ok(existsSync(join(dir, "static-files/perch.js")));
  assert.ok(!existsSync(join(dir, "public/perch.js")));
});

test("candidateFromFile infers the kind from the project", () => {
  const dir = project({ "package.json": pkg({ astro: "5" }), "src/pages/index.astro": "<html><body></body></html>" });
  const c = candidateFromFile(join(dir, "src/pages/index.astro"));
  assert.equal(c.kind, "html");
  assert.equal(c.inline, "is:inline ");
  assert.equal(c.publicDir, join(dir, "public"));
});

test("nothing found: says where it looked and how to point at a file", async () => {
  const r = await capture([], project({ "notes.txt": "x" }), noTty);
  assert.equal(r.code, 1);
  assert.match(r.text, /--file path\/to\/layout-or-page/);
});
