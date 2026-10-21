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

What blocks a real "Add to Chrome" link is only Google: Chrome installs extensions from its store, and a store listing needs your developer account and a review. Everything else is prepared in this folder.

**1. Developer account (once, about 10 minutes).** https://chrome.google.com/webstore/devconsole: sign in with the Google account that should own the listing, accept the terms, pay the one-time registration fee (about $5; the page shows the current amount) and complete the identity or contact verification it asks for.

**2. New item.** Upload `extension-dist/perch-extension.zip` (`bun run extension:build` makes it). The version comes from `manifest.json`; every later upload needs a higher number.

**3. Store listing tab.**

| Field | Use |
|---|---|
| Name, summary, description | The listing text below |
| Category | Fun (or Developer Tools) |
| Language | English |
| Icon (128 x 128) | Taken from the zip (`icons/icon-128.png`) |
| Screenshots (up to 5, 1280 x 800) | `store/ext-popup-1280x800.png`, `store/ext-page.png`, `store/ext-pick.png`, `store/ext-editor.png`, `store/ext-blog.png` |
| Small promo tile (440 x 280) | `store/promo-small-440x280.png` |
| Marquee promo tile (1400 x 560, optional, used when featured) | `store/promo-marquee-1400x560.png` |
| Promo video (optional) | A YouTube link. Not needed for approval |
| Homepage / support URL | `https://gettheperch.com/extension/` and `https://github.com/mishanefedov/perch/issues` |

**4. Privacy tab.**

- Privacy policy URL: `https://gettheperch.com/extension/privacy/`
- Single purpose: "Show a pixel creature on the web pages the user chooses."
- Permission reasons:
  - `activeTab`: add the creature to the tab the user clicks.
  - `scripting`: inject the creature script into that tab.
  - `storage`: save the user's creature and settings.
  - Optional access to all sites: only if the user turns on "On every site" or "Always on this site", so the creature can show up without a click.
- Remote code: No. All code is inside the package.
- Data usage: collects no user data. Tick the three certifications (not sold, not used for unrelated purposes, not used for creditworthiness).

**5. Test instructions** (the reviewer notes field):

```
No account or login is needed. After installing, open any normal web page (for example https://example.com), click the Perch toolbar icon and press "Show on this page". A small pixel creature appears and walks on the page's headings and text. Press "Customize this page" to open the settings panel (swap creature, pixel editor, pick goal). "Always on this site" and "On every site" ask for host permission first. The extension collects no data and makes no network requests. Source: https://github.com/mishanefedov/perch/tree/main/extension
```

**6. Distribution.** Visibility: Public. Regions: all. Submit for review. Reviews can take hours to several days, and broad host permissions slow them down, which is why the default is `activeTab`.

**7. When it is approved (about two minutes of work).** Copy the listing URL into `site/config.json` under `extension.chromeStoreUrl`, then `vercel deploy --prod`. Until that URL is set, the site does not promote the extension at all (no home page section, no nav link, no speech bubble; the `/extension/` page says it is coming and is not indexed). Once it is set, all of that appears, with "Add to Chrome" linking to the store. Add the store badge to the README.

**Also publish to Microsoft Edge Add-ons.** The same zip works unchanged. The dev account at https://partner.microsoft.com/dashboard/microsoftedge is free. It gives Edge users a one-click link too.

**Later releases can be automated.** After the first upload, the Chrome Web Store API can publish new versions from CI (it needs an OAuth client and refresh token stored as repository secrets). Not set up yet.

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
