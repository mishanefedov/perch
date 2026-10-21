# Changelog

## 0.1.1

- **Setup finds every possible place, then asks.** It searches for all root layouts (any depth, so Next.js route groups like `app/(site)/layout.tsx` work), Astro layouts, SvelteKit, Nuxt and HTML pages, in the current folder and in folders below it (monorepos). One clear answer is used straight away. Several: a menu where you pick a number, several numbers (`1,2`), or paste a file or folder path.
- New flags for scripts and agents: `--file <path>` (repeatable), `--public <dir>`, `--yes`. With several equal places and no terminal, it prints a ready-to-run command for each and exits with code 2.
- `detect` now returns every candidate, which one is recommended, and `needsChoice`.
- `set`, `creature` and `--remove` act on every installed place.
- Fix: a Next.js project with only a route-group layout was reported as "not supported".
- `npm run demo` now builds and opens the landing page, which is the demo.
- Tuner: while picking, **↑** selects the parent element and **↓** goes back; the bar shows the selector and how many elements it matches; a "matches N elements" line sits under the Goal and Ignore fields.
- Fix: the selector builder could return a selector that matched many elements (for example `p`). It now always matches exactly the picked element.
- After the creature (re)starts, it goes to the goal first, so a newly picked goal is visible at once.
- Website: landing page, framework guides, an agent guide, `llms.txt`, sitemap and structured data (`site/`, `bun run site:build`).

## 0.1.0

First release.

- One script (`perch.js`, about 10 kB gzipped) that finds headings, text lines, cards, buttons and forms and lets a pixel creature stand on them, ride them while you scroll, jump between them and point at the call to action.
- Six creatures: octopus, blob, cat, ghost, robot, alien. Custom creatures as JSON.
- Localhost tuner: swap creature, pixel editor, sliders, "show floors" overlay, click-to-pick goal and ignore selectors, copy-paste save command.
- `npx perch-pet` setup for Next.js (app and pages router), Astro, SvelteKit, Nuxt, Vite and plain HTML. Also `set`, `creature`, `detect`, `options`, `--remove`, `--dry`.
- `import "perch-pet/auto"` and `import { init } from "perch-pet"` for bundlers, with types.
- `schema.json`, `llms.txt` and `AGENTS.md` for coding agents.
