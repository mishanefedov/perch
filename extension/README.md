# Perch browser extension

Puts the Perch creature on any page you visit. Chrome and other Chromium browsers (Manifest V3).

## Use it

1. Click the toolbar icon, then **Show on this page**. Or press `Alt+Shift+P`.
2. **Customize this page** (`Alt+Shift+T`) opens the tuner on the page: swap creatures, draw your own, show floors, pick the goal and things to ignore.
3. **Always on this site** and **On every site** keep it on. Each asks Chrome for permission first.

What is saved where (`chrome.storage.sync`): creature, size, speed, stickiness and a drawn creature are global. Goal, ignore and top space belong to one site (one storage item per site, key `rule:<origin>`).

## Build and load it

```bash
bun install
bun run extension:build          # extension-dist/ and extension-dist/perch-extension.zip
```

Open `chrome://extensions`, switch on Developer mode, **Load unpacked**, choose `extension-dist/`.

## Files

| File | Role |
|---|---|
| `manifest.json` | MV3. Permissions: `activeTab`, `scripting`, `storage`. Optional: all sites |
| `src/background.ts` | Service worker: shortcuts, injects on request, keeps "always on" registrations in step |
| `src/bootstrap.ts` | Content script: starts the creature with the saved settings, mounts the tuner, saves its changes |
| `src/popup.ts`, `popup.html`, `popup.css` | Toolbar popup |
| `src/settings.ts` | Settings shared by all three |
| `../src/entry-ext.ts` | The creature script for the extension: only defines `window.Perch`, never reads script tags, no tuner autoload |

The scripts run in the extension's own isolated world, so the page cannot see or change `window.Perch`. The state sits on one shared object, because the scripts can be injected again.

## Tests

`test/extension.test.mjs` loads the built extension into Playwright's Chromium and checks: injection, isolation from the page, no second creature after a second injection, settings reaching a running creature, the popup (choose, hide, show), the customize panel saving globally and per site without touching the page's own storage, "always on this site" after a reload, and a page the extension cannot access.

Chrome 137 and later ignore `--load-extension` in the branded Chrome build, so tests use Playwright's Chromium: `node node_modules/playwright-core/cli.js install chromium`.

## Release to the Chrome Web Store

1. **Developer account:** https://chrome.google.com/webstore/devconsole, sign in, accept the terms. Chrome charges a one-time registration fee (about $5; check the current amount on the sign-up page).
2. **Bump the version** in `manifest.json` (every upload needs a higher number), then `bun run extension:build`.
3. **Upload** `extension-dist/perch-extension.zip` as a new item.
4. **Store listing** (text below). Screenshots: `extension/store/ext-page.png`, `ext-editor.png`, `ext-popup.png` (1280 x 800 and a 320 wide popup). Small promo tile: `extension/store/promo-small-440x280.png`. Category: Fun, or Developer Tools. Language: English.
5. **Privacy tab:** privacy policy URL `https://gettheperch.com/extension/privacy/`. Single purpose: "Show a pixel creature on web pages the user chooses." Declare: no personal data collected, no remote code. Permission reasons:
   - `activeTab`: add the creature to the tab the user clicks.
   - `scripting`: inject the creature script into that tab.
   - `storage`: save the user's creature and settings.
   - Optional all-sites access: only if the user turns on "On every site" or "Always on this site".
6. **Submit for review.** Reviews can take from hours to several days, and broad host permissions slow them down, which is why the default is `activeTab`.
7. **When it is approved:** copy the store URL into `site/config.json` under `extension.chromeStoreUrl`, run `vercel deploy --prod`. The site buttons change from "Get the extension (beta)" to "Add to Chrome". Add the badge to the README.

Listing text:

```
Name: Perch: a pixel creature on any website
Summary (132 chars max): A pixel creature that stands on the headings, text and buttons of the pages you visit. Free, open source, no tracking.

Description:
Perch puts a small pixel creature on the pages you visit. It stands on the real headings, lines of text, cards and buttons, rides them while you scroll, and points at the main button.

- Click the toolbar icon to show it on this page, or press Alt+Shift+P.
- Six creatures: octopus, blob, cat, ghost, robot, alien. Or draw your own in the pixel editor.
- Press Customize (Alt+Shift+T) to choose the goal and the things to ignore on each site.
- Keep it on for one site, or for every site if you want.

Private by design: no tracking, no analytics, no server. Your settings stay in your browser (and sync through Chrome if you use Chrome sync).

Want the creature on your own website? Run npx perch-pet. Free and open source (MIT): https://github.com/mishanefedov/perch
```

Firefox: the same code can work with a `background.scripts` entry and `browser_specific_settings` in the manifest. Not done yet.
