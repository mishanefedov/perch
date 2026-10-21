# Contributing

Thanks for helping. This is a small project, so the rules are short.

## Setup

```
bun install
bun run build      # dist/
bun run typecheck
bun run test       # needs Chrome for the browser tests; they skip themselves if it is missing
bun run demo       # http://localhost:4173/demo/  (the gear button is the tuner)
```

## Layout

- `src/engine.ts`: physics and behaviour. `src/scanner.ts`: which elements count as floors and goals.
- `src/creature.ts` and `src/creatures/*.ts`: the sprite format and the built-in creatures.
- `src/tuner.ts`, `src/editor.ts`, `src/selector.ts`: the localhost panel. Loaded only in development.
- `cli/run.mjs`: the `perch-pet` command. `schema.json` is the source of truth for option names, types and limits.
- `scripts/`: build, README assets (`bun run assets`), demo GIF.

## Add a creature

1. Copy `src/creatures/blob.ts`, change the name, palette and ASCII rows.
2. Register it in `src/config.ts` and add its name to `creature.enum` in `schema.json`.
3. `bun run test`. The tests check that every row has the same width, the eyes sit inside the body, and the arms stay on the canvas.
4. `bun run assets` to refresh the README lineup.

## Pull requests

- One change per PR. Say what changed and how you tested it.
- Behaviour changes need a test. Setup command changes need a case in `test/cli.test.mjs` or `test/commands.test.mjs`.
- If a site looks wrong with the creature on, include the URL and the output of `npx perch-pet detect`. A fix that works through a general rule beats a per-site rule.
