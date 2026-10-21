<div align="center">

<img src="https://raw.githubusercontent.com/mishanefedov/perch/main/assets/hero.svg" alt="A pixel octopus hopping between a heading, text lines, a card and a button on a web page" width="760">

# perch

**A pixel creature that lives on your website.**<br>
It stands on your real headings, text, cards and buttons, rides them while you scroll, and points at your call to action.<br>
One script tag. Tune it live on localhost. Octopus, cat, robot, ghost, alien, blob, or draw your own.

[![npm](https://img.shields.io/npm/v/perch-pet?color=cb3837)](https://www.npmjs.com/package/perch-pet)
[![CI](https://github.com/mishanefedov/perch/actions/workflows/ci.yml/badge.svg)](https://github.com/mishanefedov/perch/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/perch-pet)](LICENSE)
[![gzip size](https://img.shields.io/badge/script-10%20kB%20gzip-2563eb)](#how-small-is-it)
[![no tracking](https://img.shields.io/badge/network%20calls-0-16a34a)](#privacy-performance-accessibility)

<img src="https://raw.githubusercontent.com/mishanefedov/perch/main/assets/demo.gif" alt="Demo: the creature stands on page elements, jumps to a clicked card, rides the page while scrolling, then the tuner swaps it for a cat and an alien and edits its pixels" width="760">

</div>

## Install

Run one command in your project folder:

```bash
npx perch-pet
```

It detects your framework, copies `perch.js` into your public folder and adds one `<script>` tag to your layout. It prints every change. Undo with `npx perch-pet --remove`. Preview first with `--dry`.

Start your dev server. A gear button appears at the bottom left: that is the [tuner](#tune-it-on-localhost).

No repo, or a site builder like WordPress, Webflow or Shopify? Upload [`perch.js`](https://unpkg.com/perch-pet/dist/perch.js) and paste this before `</body>`:

```html
<script src="/perch.js" defer></script>
```

Using a bundler and want no script tag? One line:

```js
import "perch-pet/auto";
```

That is the whole setup. The defaults work on most sites.

## For AI coding agents

Do not write this by hand and do not add a skill file. Run the command. It is deterministic: no network, no model, plain file edits.

```bash
npx perch-pet detect          # JSON: framework, layout file, public folder, installed?, current options
npx perch-pet --dry           # preview the exact change
npx perch-pet                 # install
npx perch-pet set stickiness=0.8 creature=cat   # change options (validated against schema.json)
npx perch-pet options         # every option, type, limit and default as JSON Schema
npx perch-pet --remove        # undo
```

Prompt to give an agent: `Add perch-pet to this site: run npx perch-pet detect, then npx perch-pet, then open the dev server and check that the creature stands on the page elements.`

Machine-readable docs: [`llms.txt`](llms.txt), [`llms-full.txt`](llms-full.txt), [`schema.json`](schema.json), [`AGENTS.md`](AGENTS.md).

## Tune it on localhost

On `localhost`, `127.0.0.1`, `*.local`, `*.test` and local-network addresses, `perch.js` also loads a small panel. Visitors on your live site never download it.

<table>
<tr>
<td width="50%"><img src="https://raw.githubusercontent.com/mishanefedov/perch/main/assets/tuner.png" alt="The tuner panel with a cat selected, sliders, and blue floor lines over the page"></td>
<td width="50%"><img src="https://raw.githubusercontent.com/mishanefedov/perch/main/assets/editor.png" alt="The pixel editor showing the cat sprite, palette and eye controls"></td>
</tr>
</table>

- **Swap creature.** Six built in. The change is live.
- **Draw or edit.** A pixel editor for the body, both leg frames and all five arm poses. Change colours, eye colours and eye position. Undo. Your edits stay in the browser while you tune.
- **Show floors.** Draws what the scanner found: blue lines are floors, green boxes are call-to-action spots. This is how you see why it stands where it stands.
- **Pick with a click.** "Pick" next to Goal or Ignore lets you click an element on the page. It writes a short, stable CSS selector for you.
- **Sliders** for stickiness, speed and size. Toggles for drag, element dip and phones.
- **Save.** The panel shows one command, for example `npx perch-pet set creature=cat stickiness=0.8`. Run it in your project folder. Or copy the script tag or the JSON.

For a creature you drew: press "Download JSON", then run `npx perch-pet creature ./creature.json`.

## Creatures

<img src="https://raw.githubusercontent.com/mishanefedov/perch/main/assets/creatures.svg" alt="The six built-in creatures: octopus, blob, cat, ghost, robot, alien" width="760">

`octopus` (default), `blob`, `cat`, `ghost`, `robot`, `alien`. Set one with `data-creature="cat"` or `npx perch-pet set creature=cat`.

## Options

Set them as `data-*` attributes on the script tag, with `npx perch-pet set key=value`, or in JS with `Perch.init({ ... })`. Full list with limits: [`schema.json`](schema.json).

| Option | Default | What it does |
|---|---|---|
| `creature` | `octopus` | `octopus`, `blob`, `cat`, `ghost`, `robot`, `alien` |
| `creatureUrl` | none | URL of a creature JSON file. `npx perch-pet creature file.json` sets it up |
| `stickiness` | `0.5` | 0 to 1. How long it stays on a spot before it moves on |
| `speed` | `1` | Walk speed. 0.2 to 4 |
| `scale` | `3` (`2` on phones) | Size of one sprite pixel. 1 to 8 |
| `goal` | automatic | CSS selector of the call to action it points at |
| `platforms` | automatic | Extra CSS selector for things it may stand on |
| `ignore` | none | CSS selector for things it must avoid. `data-perch-ignore` on any element works too |
| `topOffset` | automatic | Pixels kept free at the top. Fixed headers are found on their own |
| `mobile` | `true` | `false` turns it off on phones and touch screens |
| `draggable` | `true` | Visitors can drag and throw it |
| `bounce` | `true` | Elements dip a few pixels when it lands on them |
| `zIndex` | `9999` | Layer order |
| `tuner` | auto | Script tag only. `true` or `false` forces the panel on or off |

```html
<script src="/perch.js" data-creature="robot" data-stickiness="0.8" data-goal=".hero a.cta" defer></script>
```

## How it finds things

No AI, no config file. It reads the page in the visitor's browser.

- **Floors:** headings, paragraphs, list items, images, tables, forms, buttons, inputs, and links that look like buttons. On text it stands on the first line of the letters, not on the box around them.
- **Call to action:** a submit button in a form, or a button whose text says things like "sign up", "get started", "book a demo", "join the waitlist". Override with `data-perch` on the element or the `goal` option.
- **Stays out of the way:** it skips anything hidden, covered by a modal or cookie banner, or inside a fixed header. It re-scans when the page changes, so single-page apps work.
- **Behaviour:** rides the floor it stands on while you scroll, gets squashed and knocked off when the page pushes it into the top, hops between nearby elements, heads for the goal, taps buttons, looks at your cursor. Click anywhere and it jumps there. Drag and throw it.

## Frameworks

`npx perch-pet` edits the right file for:

| Framework | File it edits | Public folder |
|---|---|---|
| Next.js, app router | `app/layout.*` (adds `<Script>`) | `public/` |
| Next.js, pages router | `pages/_document.*` (creates it if missing) | `public/` |
| Astro | the layout with `</body>` | `public/` |
| SvelteKit | `src/app.html` | `static/` |
| Nuxt 3 | adds `plugins/perch.client.ts` | `public/` |
| Vite, plain HTML | `index.html` | `public/` or next to it |

Anything else (Remix, Gatsby, Docusaurus, WordPress, Webflow, Shopify): copy `perch.js` to your static folder and paste the one script tag.

## Use it from JavaScript

```js
import { init, update, destroy, celebrate, debug } from "perch-pet";

init({ creature: "cat", stickiness: 0.8 });
update({ speed: 1.5 });   // change options while it runs
celebrate();              // after a signup: it throws a little party
debug(true);              // show floors and goals
destroy();
```

`window.dispatchEvent(new Event("perch:celebrate"))` does the same as `celebrate()`. Types are included.

## Draw your own creature

A creature is data: ASCII rows and a palette. `.` is empty. Draw it in the tuner, or copy [`src/creatures/blob.ts`](src/creatures/blob.ts) and edit the strings. Then:

```bash
npx perch-pet creature ./creature.json
```

It validates the file, copies it to your public folder and points the tag at it.

## Privacy, performance, accessibility

- **No tracking and no network calls.** The only request is one optional fetch of your own creature JSON file.
- **Never blocks the page.** One fixed canvas with `pointer-events: none`. Only the creature itself takes the pointer.
- **No layout shift**, no changes to your markup. The only thing it touches on your elements is a short `transform` animation when it lands, and it skips elements that already have a transform.
- **Reduced motion:** with `prefers-reduced-motion` it sits still near the call to action. It pauses in background tabs.
- **Screen readers:** the layer is `aria-hidden`. It is decoration.
- **Strict CSP:** the tag loads `/perch.js` from your own origin, so `script-src 'self'` is enough.

### How small is it

`perch.js` is about 27 kB, 10 kB gzipped, with all six creatures. The tuner (`perch-tuner.js`, about 23 kB) loads only in development.

## Known limits

- Tuned on a handful of real pages so far. Sticky headers, popups, iframes and canvas-only pages are the weak spots. Use `ignore` and `goal` when it picks wrong, and [open an issue](https://github.com/mishanefedov/perch/issues/new/choose) with the page URL.
- Only the main document: it does not walk into iframes or shadow DOM.
- The Nuxt and Next pages-router setups are tested on generated projects, not yet on many real ones.

## Compared with

- **[page-mascot](https://github.com/nilbuild/page-mascot):** a character at the top of the page that watches the cursor and blinks. Perch moves around the page and uses your elements as floors.
- **Rive mascots:** a great way to make a polished character, but you build the animation in their editor and wire the runtime yourself. Perch is pixel art and zero wiring.
- **Neko-style cursor pets:** follow the pointer. Perch does not follow it; it lives on the page.

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). New creatures are an easy first PR.

## License

MIT. Made by [Michael Nefedov](https://github.com/mishanefedov).
