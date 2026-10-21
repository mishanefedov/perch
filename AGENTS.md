# AGENTS.md

Two jobs an agent does with this repo: add perch-pet to someone's site, or change perch-pet itself.

## Add perch-pet to a site

Run the command. Do not hand-write the script tag, do not add a skill file.

```bash
npx perch-pet detect                 # JSON: candidates[] (every place found), recommended one, needsChoice, installed, options
npx perch-pet --dry                  # preview
npx perch-pet                        # install: copies perch.js (+ localhost tuner), adds one tag
npx perch-pet --file <path>          # install into this exact file (repeat for several)
npx perch-pet --yes                  # several places, nobody to ask: use the recommended one
npx perch-pet set stickiness=0.8     # change options on every installed tag; validated against schema.json
npx perch-pet --remove               # undo
```

Exit codes: `0` done, `1` nothing found, `2` several equal places and no terminal: the output lists `npx perch-pet --file "<path>"` for each. Pick one and rerun, or add `--yes`.

- It only edits files inside the project folder. It prints each change.
- If `detect` finds nothing, use `--file <path>` for your layout or page, or add `<script src="https://unpkg.com/perch-pet@0.1/dist/perch.js" defer></script>` before `</body>`.
- Verify in the browser: the creature should stand on headings, text and cards and point at the main button. If it picks wrong, use `set goal=".selector"` or `set ignore=".selector"`. The tuner (gear button on localhost) has "Show floors" and click-to-pick selectors.
- Full option list: `npx perch-pet options` or `schema.json`. Everything in one text file: `llms-full.txt`.

## Change perch-pet itself

```bash
bun install
bun run typecheck
bun run build          # dist/perch.js, dist/perch-tuner.js, dist/esm, dist/types
bun run test           # CLI tests (generated projects) + Chrome tests (skipped without Chrome)
bun run demo           # builds and opens the landing page (the demo) at http://localhost:4173/
```

Rules:

- `schema.json` is the source of truth for option names, types and limits. The CLI reads it. Keep `src/config.ts` in step (a test checks the creature list).
- The runtime must stay dependency-free and make no network calls. The tuner stays out of `perch.js`: it is its own bundle, loaded only in development.
- The creature stands still while a question (`ask`) is up and the question closes on scroll: keep both rules when changing the engine or `src/ask.ts`.
- Do not edit the page's markup from the runtime. The creature layer is one fixed canvas.
- Every CLI change needs a case in `test/cli.test.mjs` or `test/commands.test.mjs`. Every behaviour change in the engine or tuner needs a check in `test/browser.test.mjs`.
- A new creature: copy `src/creatures/blob.ts`, register it in `src/config.ts`, add it to `schema.json`, run the tests (they check row widths, eye and arm placement), then `bun run assets`.
- README visuals come from `bun run assets` (SVGs) and `scripts/record-demo.mjs`, `scripts/make-images.mjs` (GIF and screenshots; they need the demo server running). Do not hand-edit generated files in `assets/`.
- Git: small commits on a branch, open a PR. Never force-push `main`.

## Layout

- `src/engine.ts` physics and behaviour, `src/scanner.ts` floors and goals, `src/creature.ts` sprite format, `src/creatures/` built-ins
- `src/tuner.ts`, `src/editor.ts`, `src/selector.ts` the localhost panel
- `src/api.ts` public API, `src/entry-iife.ts` script-tag entry, `src/auto.ts` and `src/index.ts` bundler entries
- `cli/run.mjs` the `perch-pet` command (candidate discovery, menu, install, set, creature, detect)
- `extension/`, `scripts/build-extension.ts` the Chrome extension (`bun run extension:build`, test: `test/extension.test.mjs`)
- `site/`, `scripts/build-site.ts` the website (`bun run site:build` -> `site-dist/`), `vercel.json` its deploy config
