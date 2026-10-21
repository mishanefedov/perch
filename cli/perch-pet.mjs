#!/usr/bin/env node
import { run } from "./run.mjs";

try {
  process.exit(await run(process.argv.slice(2), process.cwd()));
} catch (e) {
  console.error("perch-pet: " + (e instanceof Error ? e.message : e));
  process.exit(1);
}
