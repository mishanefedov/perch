// set / creature / detect / options, plus checks that the built-in creatures and schema agree with the code.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { run, checkOption, readOptions, detect } from "../cli/run.mjs";
import { CREATURES, validate } from "../dist/esm/index.js";

const quiet = () => {};
function project(files) {
  const dir = mkdtempSync(join(tmpdir(), "perch-"));
  for (const [p, c] of Object.entries(files)) { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), c); }
  return dir;
}
const html = { "index.html": `<html>\n<body>\n  <h1>Hi</h1>\n</body>\n</html>\n` };
const capture = async (args, dir) => { const l = []; const code = await run(args, dir, (x) => l.push(x)); return { code, text: l.join("\n") }; };

test("set changes, adds and resets options on the installed tag", async () => {
  const dir = project(html);
  await run(["--creature", "blob"], dir, quiet);
  await run(["set", "stickiness=0.8", "goal=.hero > a"], dir, quiet);
  const tag = readFileSync(join(dir, "index.html"), "utf8").match(/<script[^>]*perch\.js[^>]*>/)[0];
  assert.match(tag, /data-creature="blob"/);
  assert.match(tag, /data-stickiness="0\.8"/);
  assert.match(tag, /data-goal="\.hero &gt; a"/);
  assert.deepEqual(readOptions(detect(dir)), { creature: "blob", stickiness: "0.8", goal: ".hero > a" });
  await run(["set", "creature=cat"], dir, quiet);
  assert.equal(readOptions(detect(dir)).creature, "cat");
  await run(["set", "--reset"], dir, quiet);
  assert.deepEqual(readOptions(detect(dir)), {});
  assert.equal(readFileSync(join(dir, "index.html"), "utf8").split("perch.js").length - 1, 1, "still exactly one tag");
});

test("set refuses bad values and a missing install", async () => {
  const dir = project(html);
  await assert.rejects(run(["set", "stickiness=0.8"], dir, quiet), /not installed/);
  await run([], dir, quiet);
  await assert.rejects(run(["set", "stickiness=2"], dir, quiet), /at most 1/);
  await assert.rejects(run(["set", "creature=dragon"], dir, quiet), /one of/);
  await assert.rejects(run(["set", "colour=red"], dir, quiet), /unknown option/);
  await assert.rejects(run(["set", "mobile=maybe"], dir, quiet), /true or false/);
});

test("creature copies a valid file and points the tag at it", async () => {
  const dir = project(html);
  await run(["--creature", "blob"], dir, quiet);
  writeFileSync(join(dir, "mine.json"), JSON.stringify({ ...CREATURES.ghost, name: "mine" }));
  assert.equal((await capture(["creature", "mine.json"], dir)).code, 0);
  assert.equal(JSON.parse(readFileSync(join(dir, "perch-creature.json"), "utf8")).name, "mine");
  assert.deepEqual(readOptions(detect(dir)), { creatureUrl: "/perch-creature.json" });
  await run(["--remove"], dir, quiet);
  assert.ok(!existsSync(join(dir, "perch-creature.json")) && !existsSync(join(dir, "perch.js")) && !existsSync(join(dir, "perch-tuner.js")));
  writeFileSync(join(dir, "bad.json"), JSON.stringify({ name: "bad", body: [] }));
  await assert.rejects(run(["creature", "bad.json"], dir, quiet), /not a valid creature/);
});

test("install copies the tuner unless --no-tuner", async () => {
  const a = project(html), b = project(html);
  await run([], a, quiet);
  await run(["--no-tuner"], b, quiet);
  assert.ok(existsSync(join(a, "perch-tuner.js")));
  assert.ok(!existsSync(join(b, "perch-tuner.js")));
});

test("detect and options print JSON for agents", async () => {
  const dir = project(html);
  const before = JSON.parse((await capture(["detect"], dir)).text);
  assert.deepEqual(before, { framework: "html", layoutFile: "index.html", publicDir: ".", installed: false, options: {} });
  await run(["--stickiness", "0.3"], dir, quiet);
  const after = JSON.parse((await capture(["detect"], dir)).text);
  assert.equal(after.installed, true);
  assert.deepEqual(after.options, { stickiness: "0.3" });
  const schema = JSON.parse((await capture(["options"], dir)).text);
  assert.ok(schema.properties.stickiness && schema.properties.creature);
  assert.equal((await capture(["detect"], project({ "x.txt": "" }))).code, 1);
});

test("schema.json matches the code: creatures and defaults", async () => {
  const schema = JSON.parse(readFileSync(new URL("../schema.json", import.meta.url), "utf8"));
  assert.deepEqual(schema.properties.creature.enum, Object.keys(CREATURES));
  for (const [k, v] of Object.entries({ stickiness: "0.5", speed: "1" })) assert.equal(checkOption(k, v), v);
});

test("every built-in creature is valid and fits its grid", () => {
  for (const [name, c] of Object.entries(CREATURES)) {
    assert.deepEqual(validate(c), [], name);
    assert.equal(c.name, name);
    const w = c.body[0].length;
    for (const r of [...c.body, ...c.legs[0], ...c.legs[1]]) assert.equal(r.length, w, `${name}: row "${r}" is ${r.length} wide, body is ${w}`);
    assert.equal(c.legs[0].length, c.legs[1].length, `${name}: leg frames differ in height`);
    const [ox, oy] = c.offset;
    assert.ok(ox + w <= c.cols, `${name}: too wide for the canvas`);
    assert.ok(oy + c.body.length + c.legs[0].length <= c.rows, `${name}: too tall for the canvas`);
    for (const [ex, ey] of [c.eyes.left, c.eyes.right]) assert.ok(ex >= ox && ex + 4 <= ox + w && ey >= oy && ey + 4 <= oy + c.body.length, `${name}: eyes outside the body`);
    for (const pose of Object.values(c.arms)) for (const [x, y] of pose) assert.ok(x < c.cols && y < c.rows, `${name}: arm pixel off the canvas`);
  }
});
