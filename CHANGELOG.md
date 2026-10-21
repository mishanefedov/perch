# Changelog

## 0.1.0

First release.

- One script (`perch.js`, about 10 kB gzipped) that finds headings, text lines, cards, buttons and forms and lets a pixel creature stand on them, ride them while you scroll, jump between them and point at the call to action.
- Six creatures: octopus, blob, cat, ghost, robot, alien. Custom creatures as JSON.
- Localhost tuner: swap creature, pixel editor, sliders, "show floors" overlay, click-to-pick goal and ignore selectors, copy-paste save command.
- `npx perch-pet` setup for Next.js (app and pages router), Astro, SvelteKit, Nuxt, Vite and plain HTML. Also `set`, `creature`, `detect`, `options`, `--remove`, `--dry`.
- `import "perch-pet/auto"` and `import { init } from "perch-pet"` for bundlers, with types.
- `schema.json`, `llms.txt` and `AGENTS.md` for coding agents.
