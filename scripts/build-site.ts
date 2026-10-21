// Builds the website into site-dist/: plain HTML, one stylesheet, no framework, no third-party requests.
//   bun run build && bun run site:build
// The site URL comes from SITE_URL, else site/config.json. Change the domain there.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const cfg = JSON.parse(readFileSync("site/config.json", "utf8")) as { url: string; name: string; github: string; npm: string; extension: { chromeStoreUrl: string; chromeStoreId: string; status: "review" | "live"; zip: string } };
const EXT_VERSION = (JSON.parse(readFileSync("extension/manifest.json", "utf8")) as { version: string }).version;
// SITE_URL wins; on Vercel the production domain (your custom domain once attached) is used; else config.json
const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "";
const SITE = (process.env.SITE_URL ?? (vercelUrl || cfg.url)).replace(/\/$/, "");
const VERSION = (JSON.parse(readFileSync("package.json", "utf8")) as { version: string }).version;
const OUT = process.env.SITE_OUT ?? "site-dist";
const CDN = "https://unpkg.com/perch-pet@0.1/dist/perch.js";
const TODAY = new Date().toISOString().slice(0, 10);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync("site/static", OUT, { recursive: true });
for (const f of ["perch.js", "perch-tuner.js"]) cpSync(join("dist", f), join(OUT, f));
mkdirSync(join(OUT, "assets"), { recursive: true });
for (const f of ["hero.svg", "creatures.svg", "tuner.png", "editor.png", "demo.gif"]) cpSync(join("assets", f), join(OUT, "assets", f));
for (const f of ["schema.json", "llms-full.txt", "AGENTS.md"]) cpSync(f, join(OUT, f));
mkdirSync(join(OUT, "fonts"), { recursive: true });
cpSync("node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2", join(OUT, "fonts/display.woff2"));
cpSync("node_modules/@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-normal.woff2", join(OUT, "fonts/text.woff2"));
// the browser extension: the zip people can download while it is not (yet) in the Chrome Web Store, and its screenshots
if (existsSync("extension-dist/perch-extension.zip")) cpSync("extension-dist/perch-extension.zip", join(OUT, "perch-extension.zip"));
else console.warn("extension-dist/perch-extension.zip is missing: run `bun run extension:build` first");
for (const f of ["ext-popup.png", "ext-page.png", "ext-editor.png"]) if (existsSync(join("extension/store", f))) cpSync(join("extension/store", f), join(OUT, "assets", f));

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const abs = (p: string) => SITE + p;

interface Page { path: string; title: string; description: string; body: string; ld?: object[]; ogType?: string; noperch?: boolean; noask?: boolean; noindex?: boolean }

// the creature on this site asks the same question the extension page answers (it uses the Ask feature of the library)
const pages: Page[] = [];

// "Add to Chrome" once the store URL is in site/config.json, else the beta download
// The extension is promoted only when it can really be installed: when there is a Chrome Web Store link.
// Until then nothing on the site sends people to a download. Set it in site/config.json (extension.chromeStoreUrl).
const EXT_ID = process.env.EXTENSION_STORE_ID ?? cfg.extension.chromeStoreId ?? "";
const EXT_STATUS = process.env.EXTENSION_STATUS ?? cfg.extension.status;
// "live" with an item id gives the public listing URL. In review the listing page does not work yet, so nothing links to it.
const STORE = process.env.EXTENSION_STORE_URL ?? (cfg.extension.chromeStoreUrl || (EXT_STATUS === "live" && EXT_ID ? `https://chromewebstore.google.com/detail/${EXT_ID}` : ""));
const LIVE = !!STORE;

// the creature on this site asks about the extension (it uses the Ask feature of the library); the button opens the store listing, or the install steps until there is one
const ASK = { text: "Want me on every website?", buttons: [{ label: "Get the extension", action: "link", value: STORE || "/extension/", ...(STORE ? { newTab: true } : {}) }], delay: 7 };
const SOURCE_STEPS = `<ol class="mini">
<li><a href="${cfg.extension.zip}" download>Download perch-extension.zip</a> and unzip it.</li>
<li>Open <code>chrome://extensions</code> and switch on <strong>Developer mode</strong> (top right).</li>
<li>Press <strong>Load unpacked</strong>, choose the unzipped folder, pin the Perch icon and click it on any site.</li>
</ol>`;
/** One place that says what is going on. In review: the status and a one-minute install. Live: Add to Chrome. */
const installCard = (open: boolean) => STORE
  ? `<div class="ext-install"><p style="margin:0 0 8px"><a class="btn primary big" href="${STORE}" rel="noopener">Add to Chrome</a></p><p class="fine" style="margin:0 0 10px;color:var(--muted)">Free. Works in Chrome, Edge, Brave and Arc.</p><details class="now"><summary>Install from source instead</summary>${SOURCE_STEPS}</details></div>`
  : `<div class="ext-install"><p class="status"><span><strong>Chrome Web Store: in review.</strong> One-click “Add to Chrome” appears here as soon as Google approves it.</span></p><details class="now"${open ? " open" : ""}><summary class="btn primary">Install it now (1 minute)</summary>${SOURCE_STEPS}</details></div>`;

function layout(p: Page): string {
  const url = abs(p.path);
  const ld = [
    { "@context": "https://schema.org", "@type": "WebSite", name: "Perch", url: SITE + "/", description: "A pixel mascot for your website. One script tag." },
    ...(p.ld ?? []),
  ];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.description)}">
<link rel="canonical" href="${url}">
${p.noindex ? '<meta name="robots" content="noindex">\n' : ""}
<meta name="theme-color" content="#0b1020">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/icon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="alternate" type="text/plain" href="/llms.txt" title="llms.txt">
<meta property="og:type" content="${p.ogType ?? "website"}">
<meta property="og:site_name" content="Perch">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(p.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${abs("/og.png")}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="The six Perch pixel creatures: octopus, blob, cat, ghost, robot, alien">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(p.title)}">
<meta name="twitter:description" content="${esc(p.description)}">
<meta name="twitter:image" content="${abs("/og.png")}">
<link rel="preload" href="/fonts/text.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/display.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/site.css">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<div class="wrap">
<header class="nav">
  <a class="brand" href="/"><img src="/logo.svg" width="30" height="24" alt="" aria-hidden="true">perch</a>
  <a href="/extension/">Extension</a>
  <a href="/agents/">For agents</a>
  <a href="${cfg.github}">GitHub</a>
</header>
</div>
<main id="main">
${p.body}
</main>
<footer>
<div class="wrap">
  <p>Guides: <a href="/nextjs/">Next.js</a> <a href="/astro/">Astro</a> <a href="/html/">HTML and no-code</a> <a href="/extension/">Browser extension</a> <a href="/agents/">For agents</a></p>
  <p>Files: <a href="/llms.txt">llms.txt</a> <a href="/schema.json">schema.json</a> <a href="${cfg.npm}">npm</a> <a href="${cfg.github}/issues">Report a problem</a></p>
  <p>Perch v${VERSION}. MIT licence. By <a href="https://github.com/mishanefedov">Michael Nefedov</a>.</p>
</div>
</footer>
${p.noperch ? "" : `<script src="/perch.js" data-goal="#install" data-stickiness="0.6" data-tuner="true"${p.noask ? "" : ` data-ask="${esc(JSON.stringify(ASK))}"`} defer></script>`}
<script src="/site.js" defer></script>
</body>
</html>
`;
}

const copy = (text: string, label = "Copy") => `<button type="button" data-copy="${esc(text)}">${label}</button>`;
const crumbs = (...items: [string, string][]) => `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a>${items.map(([h, t]) => ` / <a href="${h}">${t}</a>`).join("")}</nav>`;
const breadcrumbLd = (name: string, path: string) => ({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Perch", item: SITE + "/" }, { "@type": "ListItem", position: 2, name, item: abs(path) }] });
const howTo = (name: string, steps: string[]) => ({ "@context": "https://schema.org", "@type": "HowTo", name, step: steps.map((t, i) => ({ "@type": "HowToStep", position: i + 1, text: t })) });

// ---------------------------------------------------------------- home
const FAQ: [string, string][] = [
  ["What is Perch?", "A free, open-source pixel creature for websites. One script makes a small animated mascot that stands on your real headings, text and buttons, rides them while visitors scroll, and points at your call to action."],
  ["Which frameworks does it work with?", "The setup command edits the right file for Next.js (app and pages router, including route groups), Astro, SvelteKit, Nuxt, Vite and plain HTML. For WordPress, Webflow, Shopify and anything else, paste one script tag."],
  ["Will it slow down my site?", "The script is 34 kB, 13 kB gzipped. It draws one small canvas, stops in background tabs, adds no layout shift and makes no network requests. The settings panel is a separate file that never loads for visitors."],
  ["Does it track my visitors?", "No. There is no tracking and no analytics."],
  ["Can I make my own character?", "Yes. The settings panel on localhost has a pixel editor for the body, legs, arms, colors and eyes. Download the JSON and run npx perch-pet creature ./creature.json."],
];

pages.push({
  path: "/",
  title: "Perch: a pixel mascot for your website, one script tag",
  description: "Free, open-source pixel mascot for any website. It stands on your real headings and buttons and points at your call to action. Setup: npx perch-pet.",
  ld: [
    {
      "@context": "https://schema.org", "@type": "SoftwareApplication", name: "Perch", alternateName: "perch-pet",
      applicationCategory: "DeveloperApplication", operatingSystem: "Any (runs in the browser)", softwareVersion: VERSION,
      description: "A pixel creature that lives on your website: it stands on your real elements and points at your call to action. One script tag, tuned live on localhost.",
      url: SITE + "/", downloadUrl: cfg.npm, codeRepository: cfg.github, license: "https://opensource.org/licenses/MIT", isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      author: { "@type": "Person", name: "Michael Nefedov", url: "https://github.com/mishanefedov" },
      sameAs: [cfg.github, cfg.npm], image: abs("/og.png"),
      keywords: "website mascot, pixel art mascot, animated mascot, web pet, landing page mascot, Next.js, Astro, SvelteKit, Nuxt, Vite, llms.txt",
    },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
    howTo("Add a pixel mascot to your website", ["Run npx perch-pet in your project folder.", "Open your site on localhost and click the gear button to tune the creature.", "Run the command the panel shows, for example npx perch-pet set creature=cat, to save your choices."]),
  ],
  body: `
<div class="wrap">
<section class="hero">
  <h1>A pixel creature that lives on your website.</h1>
  <p class="lead">It stands on your real headings, text and buttons, and points at your call to action. One script tag. Free and open source.</p>
  <div id="install" class="install"><code><span aria-hidden="true">$ </span>npx perch-pet</code>${copy("npx perch-pet")}</div>
  <p class="actions"><a class="btn primary" href="${cfg.github}">GitHub</a><button type="button" class="link" data-open-tuner>Try the settings panel on this page</button></p>
</section>

<figure class="demo">
  <video autoplay muted loop playsinline preload="metadata" width="760" height="475" aria-label="Screen recording of the Perch settings panel: picking the call to action, picking a card to ignore, and the command that saves both"><source src="/demo.mp4" type="video/mp4"><img src="/assets/demo.gif" width="760" height="475" alt="Screen recording of the Perch settings panel" loading="lazy"></video>
  <figcaption>Pick the call to action, pick what to ignore, copy the command that saves both.</figcaption>
</figure>

<section id="how">
  <h2>How it works</h2>
  <ol class="plain">
    <li><strong>Run one command.</strong> It finds your layout file and adds the script tag. Undo any time.<pre>npx perch-pet</pre></li>
    <li><strong>Open your site on localhost and click the gear.</strong> Swap the creature, draw your own, and click your call to action to pick it.</li>
    <li><strong>Run the command the panel prints.</strong><pre>npx perch-pet set creature=cat stickiness=0.8</pre></li>
  </ol>
</section>

<section id="features">
  <h2>What you get</h2>
  <dl class="facts">
    <dt>Stands on your real elements</dt><dd>Headings, lines of text, cards, buttons and forms. It rides them while visitors scroll.</dd>
    <dt>Points at your call to action</dt><dd>It finds a submit button or a “Book a demo” button, or you pick one.</dd>
    <dt>Asks a question</dt><dd>A speech bubble with up to three buttons. The creature stands still, and scrolling closes it.</dd>
    <dt>Six creatures, or your own</dt><dd>Draw one in the pixel editor.</dd>
    <dt>Light and private</dt><dd>13 kB gzipped, no tracking, no network requests.</dd>
  </dl>
  <img class="creatures" src="/assets/creatures.svg" width="980" height="170" loading="lazy" alt="The six Perch creatures: octopus, blob, cat, ghost, robot and alien">
</section>

<section id="agents">
  <h2>For coding agents</h2>
  <p>Setup is a command, not a skill file. It makes plain file edits and needs no model. Give your agent this:</p>
  <div class="prompt code"><pre id="agent-prompt">Add the Perch mascot to this site. Run \`npx perch-pet detect\` to see what it found, then \`npx perch-pet\` to install. If it lists several places, rerun with \`--file <path>\`. Open the dev server and check that the creature stands on the page elements and points at the main button.</pre>${copy("Add the Perch mascot to this site. Run `npx perch-pet detect` to see what it found, then `npx perch-pet` to install. If it lists several places, rerun with `--file <path>`. Open the dev server and check that the creature stands on the page elements and points at the main button.")}</div>
  <p class="links"><a href="/agents/">Agent guide</a> <a href="/llms.txt">llms.txt</a> <a href="/schema.json">Options schema</a></p>
</section>

<section id="faq">
  <h2>Questions</h2>
  ${FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("\n  ")}
</section>
</div>`,
});

// ---------------------------------------------------------------- guides
function guide(p: { path: string; name: string; title: string; description: string; h1: string; intro: string; steps: string[]; body: string; faq?: [string, string][] }) {
  pages.push({
    path: p.path, title: p.title, description: p.description,
    ld: [breadcrumbLd(p.name, p.path), howTo(p.h1, p.steps), ...(p.faq ? [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: p.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }] : [])],
    body: `<div class="wrap doc">${crumbs([p.path, p.name])}<h1>${p.h1}</h1><p>${p.intro}</p>${p.body}
<h2>Questions</h2>${(p.faq ?? []).map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}
<p style="margin-top:36px"><a class="btn primary" href="/">What is Perch?</a> <a class="btn" href="${cfg.github}">GitHub</a></p></div>`,
  });
}

guide({
  path: "/nextjs/", name: "Next.js",
  title: "Add a pixel mascot to a Next.js site with Perch",
  description: "Add an animated pixel mascot to a Next.js app in one command. Works with the app router, route groups and the pages router. No code changes.",
  h1: "Add a pixel mascot to a Next.js site",
  intro: "Perch edits the right Next.js file for you, including layouts inside route groups like <code>app/(site)/layout.tsx</code>.",
  steps: ["In your Next.js project folder, run npx perch-pet.", "If it lists more than one layout, pick one, or pass --file with the layout path.", "Run npm run dev, open localhost and click the gear button to tune the creature.", "Run the command the panel prints to save your settings."],
  body: `<h2>1. Run the command</h2>
<div class="code"><pre>cd your-next-app
npx perch-pet</pre></div>
<p>It looks for every root layout (a <code>layout.tsx</code> that renders <code>&lt;html&gt;</code> and <code>&lt;body&gt;</code>), in <code>app/</code> and <code>src/app/</code>, at any depth. One root layout is picked for you. Several (one per route group) become a menu.</p>
<h2>2. What it changes</h2>
<ul>
<li>Copies <code>perch.js</code> and <code>perch-tuner.js</code> to <code>public/</code>.</li>
<li>App router: adds <code>import Script from "next/script"</code> and one <code>&lt;Script src="/perch.js" strategy="afterInteractive" /&gt;</code> before <code>&lt;/body&gt;</code>.</li>
<li>Pages router: adds a script tag to <code>pages/_document</code> (creates it if missing).</li>
</ul>
<p>Preview it first with <code>npx perch-pet --dry</code>. Undo with <code>npx perch-pet --remove</code>.</p>
<h2>3. Choose the layout yourself</h2>
<div class="code"><pre>npx perch-pet --file "app/(marketing)/layout.tsx"
# several route groups:
npx perch-pet --file "app/(marketing)/layout.tsx" --file "app/(app)/layout.tsx"</pre></div>
<h2>4. Tune it</h2>
<p>Run <code>npm run dev</code>. A gear button appears at the bottom left on localhost. Swap the creature, show floors, pick your call to action with a click. Then run the command it shows, for example:</p>
<div class="code"><pre>npx perch-pet set creature=cat stickiness=0.8 goal=".hero a"</pre></div>
<div class="note">The tuner file is deployed with your site but is only loaded on localhost, local-network addresses and <code>?perch=tune</code>. Visitors on your live site never get it. This demo site is the one exception: it opts in with <code>data-tuner="true"</code>.</div>`,
  faq: [
    ["Does it work with the Next.js app router and route groups?", "Yes. It finds root layouts at any depth, including layouts inside route groups such as app/(site)/layout.tsx."],
    ["Does it need a client component?", "No. It uses next/script with strategy afterInteractive, so your layout stays a server component."],
    ["Will it work with a strict Content Security Policy?", "Yes, if script-src allows your own origin. The script loads from /perch.js on your site."],
  ],
});

guide({
  path: "/astro/", name: "Astro",
  title: "Add a pixel mascot to an Astro site with Perch",
  description: "Add an animated pixel mascot to an Astro site in one command. It finds your layout and adds one inline script tag.",
  h1: "Add a pixel mascot to an Astro site",
  intro: "Perch finds the Astro layout that renders your <code>&lt;body&gt;</code> and adds one script tag.",
  steps: ["In your Astro project folder, run npx perch-pet.", "Pick the layout if it asks.", "Run npm run dev and click the gear button on localhost.", "Save your choices with the command the panel prints."],
  body: `<h2>1. Run the command</h2>
<div class="code"><pre>cd your-astro-site
npx perch-pet</pre></div>
<p>It lists <code>.astro</code> files under <code>src/</code> that contain <code>&lt;/body&gt;</code>. Files in a <code>layouts/</code> folder rank first.</p>
<h2>2. What it changes</h2>
<ul><li>Copies <code>perch.js</code> and <code>perch-tuner.js</code> to <code>public/</code>.</li><li>Adds <code>&lt;script is:inline src="/perch.js" defer&gt;&lt;/script&gt;</code> before <code>&lt;/body&gt;</code> in the layout.</li></ul>
<h2>3. Pick a different file</h2>
<div class="code"><pre>npx perch-pet --file src/layouts/Base.astro</pre></div>
<h2>4. Tune and save</h2>
<p>On localhost, click the gear button. Then run the command it shows, for example <code>npx perch-pet set creature=robot</code>.</p>`,
  faq: [["Does Astro bundle the script?", "No. It uses is:inline so Astro leaves the tag as it is and the browser loads /perch.js from your public folder."]],
});

guide({
  path: "/html/", name: "HTML, WordPress, Webflow, Shopify",
  title: "Add a pixel mascot to any website: HTML, WordPress, Webflow",
  description: "Add an animated pixel mascot to any website with one script tag. Works on plain HTML, Vite, WordPress, Webflow, Shopify and anything that lets you add a script.",
  h1: "Add a pixel mascot to any website with one script tag",
  intro: "No repo, no build step, no framework needed. If your site lets you add a script, Perch works.",
  steps: ["Paste the script tag before the closing body tag.", "Open your site: the creature appears.", "Add data attributes to change creature, speed and stickiness."],
  body: `<h2>The one-line install</h2>
<div class="code"><pre>&lt;script src="${CDN}" defer&gt;&lt;/script&gt;</pre></div>
<p>${copy(`<script src="${CDN}" defer></script>`, "Copy the tag")} Paste it before <code>&lt;/body&gt;</code>, or into your site builder's footer or custom-code box.</p>
<h2>Where to paste it</h2>
<ul>
<li><strong>Plain HTML or Vite:</strong> before <code>&lt;/body&gt;</code> in <code>index.html</code>. Or run <code>npx perch-pet</code> and it does this for you.</li>
<li><strong>WordPress:</strong> a footer-scripts plugin, or your theme's <code>footer.php</code> before <code>wp_footer()</code> ends.</li>
<li><strong>Webflow:</strong> Project settings, Custom code, Footer code.</li>
<li><strong>Shopify:</strong> <code>theme.liquid</code>, before <code>&lt;/body&gt;</code>.</li>
<li><strong>Squarespace, Wix, Ghost:</strong> the code injection or custom code area for the footer.</li>
</ul>
<h2>Change the creature and the behavior</h2>
<div class="code"><pre>&lt;script src="${CDN}"
  data-creature="cat"
  data-stickiness="0.8"
  data-goal=".hero a.cta"
  defer&gt;&lt;/script&gt;</pre></div>
<p>All options: creature, stickiness, speed, scale, goal, platforms, ignore, topOffset, mobile, draggable, bounce. See the <a href="${cfg.github}#options">option table</a> or <a href="/schema.json">schema.json</a>.</p>
<h2>Tune it live</h2>
<p>Add <code>?perch=tune</code> to your page URL. The tuner panel opens in the page. Swap creatures, draw your own and copy the script tag with your settings.</p>
<div class="note">The unpkg link follows the 0.1 release line. To host the file yourself, download <code>perch.js</code> from the npm package and use <code>src="/perch.js"</code>.</div>`,
  faq: [["Can I use it without npm?", "Yes. The script tag loads the file from a CDN. You do not need npm, a build step or a repo."], ["Does it work on a site I do not control the code of?", "It works anywhere you can add a script. Many site builders have a custom-code box for this."]],
});

pages.push({
  path: "/agents/", title: "Install Perch with an AI coding agent: commands and prompt",
  description: "How Claude Code, Cursor, Codex and other coding agents install the Perch mascot: deterministic commands, JSON output, flags for choosing a file, exit codes.",
  ld: [breadcrumbLd("For agents", "/agents/"), howTo("Install Perch with an AI coding agent", ["Run npx perch-pet detect and read the JSON.", "Run npx perch-pet --dry to preview.", "Run npx perch-pet, with --file if there is more than one place.", "Open the dev server and check the creature.", "Run npx perch-pet set key=value to change options."])],
  body: `<div class="wrap doc">${crumbs(["/agents/", "For agents"])}<h1>Install Perch with an AI coding agent</h1>
<p>Do not write the integration by hand and do not add a skill file. Run the command. It is deterministic: no network, no model, plain file edits inside the project folder.</p>
<h2>Prompt to give your agent</h2>
<div class="prompt code"><pre>Add the Perch mascot to this site. Run \`npx perch-pet detect\` to see what it found, then \`npx perch-pet\` to install. If it lists several places, rerun with \`--file &lt;path&gt;\`. Open the dev server and check that the creature stands on the page elements and points at the main button.</pre>${copy("Add the Perch mascot to this site. Run `npx perch-pet detect` to see what it found, then `npx perch-pet` to install. If it lists several places, rerun with `--file <path>`. Open the dev server and check that the creature stands on the page elements and points at the main button.")}</div>
<h2>Commands</h2>
<div class="code"><pre>npx perch-pet detect                 # JSON: every place it found, which is recommended, what is installed
npx perch-pet --dry                  # preview the exact change
npx perch-pet                        # install
npx perch-pet --file app/layout.tsx  # install into this file (repeat --file for several)
npx perch-pet --yes                  # several places and no one to ask: take the recommended one
npx perch-pet set stickiness=0.8     # change options, validated against schema.json
npx perch-pet options                # every option, type and limit as JSON Schema
npx perch-pet --remove               # undo</pre></div>
<h2>What detect returns</h2>
<div class="code"><pre>{
  "framework": "next-app",
  "layoutFile": "app/(site)/layout.tsx",
  "publicDir": "public",
  "installed": false,
  "options": {},
  "needsChoice": false,
  "candidates": [
    { "id": 1, "kind": "next-app", "label": "Next.js layout (route group)",
      "file": "app/(site)/layout.tsx", "publicDir": "public", "recommended": true, "installed": false }
  ]
}</pre></div>
<h2>Exit codes</h2>
<ul><li><code>0</code> done.</li><li><code>1</code> nothing found. The message says how to point at a file with <code>--file</code>.</li><li><code>2</code> several equal places and no terminal to ask in. The output lists a ready-to-run command for each. Pick one, or add <code>--yes</code>.</li></ul>
<h2>Check your work</h2>
<p>Start the dev server. On localhost, a gear button appears at the bottom left. Open it, switch on “Show floors”: blue lines are floors, green boxes are call-to-action spots. If it points at the wrong thing, run <code>npx perch-pet set goal=".selector"</code> or <code>ignore=".selector"</code>.</p>
<h2>Machine-readable docs</h2>
<ul><li><a href="/llms.txt">/llms.txt</a>: index for LLMs</li><li><a href="/llms-full.txt">/llms-full.txt</a>: everything in one text file</li><li><a href="/schema.json">/schema.json</a>: JSON Schema for every option</li><li><a href="/AGENTS.md">/AGENTS.md</a>: install and contribute notes</li></ul>
<p style="margin-top:36px"><a class="btn primary" href="/">What is Perch?</a> <a class="btn" href="${cfg.github}">GitHub</a></p></div>`,
});

// ---------------------------------------------------------------- extension
const PRIVACY = "/extension/privacy/";
pages.push({
  path: "/extension/", noask: true, title: "Perch extension: a pixel creature on any website",
  description: "Free Chrome extension that puts a pixel creature on the pages you visit. It stands on real headings and buttons. Draw your own and set a goal per site.",
  ld: [
    breadcrumbLd("Browser extension", "/extension/"),
    { "@context": "https://schema.org", "@type": "SoftwareApplication", name: "Perch browser extension", applicationCategory: "BrowserApplication", operatingSystem: "Chrome, Chromium", softwareVersion: EXT_VERSION, url: abs("/extension/"), description: "A pixel creature that stands on the headings, text and buttons of the pages you visit.", isAccessibleForFree: true, offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, license: "https://opensource.org/licenses/MIT", author: { "@type": "Person", name: "Michael Nefedov", url: "https://github.com/mishanefedov" }, image: abs("/og.png") },
    howTo("Put a pixel creature on any website", ["Install the Perch extension.", "Click the toolbar icon and press Show on this page.", "Press Customize this page to change the creature, the goal and what to ignore."]),
  ],
  body: `<div class="wrap doc" style="max-width:860px">${crumbs(["/extension/", "Browser extension"])}
<h1>Put a pixel creature on any website you visit</h1>
<p>The Perch extension runs the same creature as the <a href="/">library</a> on the pages you open. It stands on the page's real headings, text and buttons, rides them while you scroll, and points at the main button. Free and open source.</p>
<h2 id="install">Install</h2>
${installCard(true)}
<h2>How it works</h2>
<ol>
<li><strong>Click the icon, press Show on this page.</strong> The creature lands on the page and goes to the main button. Press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> to show or hide it.</li>
<li><strong>Press Customize this page</strong> (<kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>T</kbd>). The panel is the one from the library: swap between six creatures, draw your own in the pixel editor, show the floors it found, and pick the goal or things to ignore by clicking them.</li>
<li><strong>Keep it on.</strong> Choose <em>Always on this site</em> or <em>On every site</em>. Both ask Chrome for permission first.</li>
</ol>
<img src="/assets/ext-popup.png" loading="lazy" width="640" height="720" alt="The Perch extension popup with six creatures, sliders and the Show on this page button" style="max-width:320px;border-radius:12px;border:1px solid var(--line)">
<img src="/assets/ext-editor.png" loading="lazy" width="1280" height="800" alt="The pixel editor open on a web page, drawing a custom creature" style="margin-top:18px;border-radius:12px;border:1px solid var(--line)">
<h2>What it can and cannot see</h2>
<table class="perm">
<tr><th>Permission</th><th>Why</th></tr>
<tr><td><code>activeTab</code></td><td>Lets it add the creature to the tab you clicked, and nothing else. It lasts until you leave the page.</td></tr>
<tr><td><code>scripting</code></td><td>To add the creature script to that tab.</td></tr>
<tr><td><code>storage</code></td><td>To save your creature and settings. Chrome can sync them between your devices.</td></tr>
<tr><td>Access to all sites (optional)</td><td>Only asked for if you switch on <em>On every site</em>. You can switch it off again, and Chrome takes the access back.</td></tr>
</table>
<p>It collects nothing and sends nothing anywhere. There is no server. Read the <a href="${PRIVACY}">privacy policy</a> or the <a href="${cfg.github}/tree/main/extension">source</a>.</p>
<h2>Good to know</h2>
<ul>
<li>Chrome does not allow extensions on <code>chrome://</code> pages or the Chrome Web Store.</li>
<li>In <em>On every site</em> mode it skips Google Docs, Figma, Miro and Excalidraw, where a creature on top of a canvas only gets in the way.</li>
<li>The page is never changed. The creature is one overlay layer, and the extension turns the landing animation on page elements off.</li>
<li>Change the shortcuts at <code>chrome://extensions/shortcuts</code>.</li>
</ul>
<h2>Questions</h2>
${[
  ["Is it free?", "Yes. It is MIT licensed, and the source is on GitHub."],
  ["Does it slow pages down?", "The script is about 13 kB gzipped and draws one small canvas. It stops in background tabs. It only runs on pages where you turned it on."],
  ["Can I put it on my own website instead?", "Yes. Run npx perch-pet in your project, or paste one script tag. The extension is only for the pages you visit."],
  ["Does it work in Firefox or Safari?", "Not yet. It works in Chromium browsers such as Chrome, Edge, Brave and Arc."],
].map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}
<p style="margin-top:36px"><a class="btn" href="/">Perch for your own site</a> <a class="btn" href="${cfg.github}">GitHub</a></p></div>`,
});

pages.push({
  path: PRIVACY, noask: true, title: "Perch extension privacy policy",
  description: "The Perch browser extension collects no data and sends nothing to any server. What it stores, where, and why it needs each permission.",
  ld: [breadcrumbLd("Privacy policy", PRIVACY)],
  body: `<div class="wrap doc">${crumbs(["/extension/", "Browser extension"], [PRIVACY, "Privacy"])}
<h1>Perch extension: privacy policy</h1>
<p>Last updated: ${TODAY}.</p>
<h2>Short version</h2>
<p>The Perch extension collects no personal data, has no analytics, and sends nothing to any server. It has no server.</p>
<h2>What it stores</h2>
<ul>
<li>Your settings: the creature you chose, size, speed and stickiness, and a creature you drew if you made one.</li>
<li>Per website, if you use it: the address (origin) of the site, and the goal and ignore selectors you picked there.</li>
<li>The list of sites where you switched on <em>Always on this site</em>.</li>
</ul>
<p>This is saved with Chrome's extension storage (<code>chrome.storage.sync</code>). If you use Chrome sync, Chrome may copy it between your devices through your Google account. We never receive it.</p>
<h2>What it reads</h2>
<p>To find where the creature can stand, the extension reads the layout of the page you turned it on for (the positions of headings, text and buttons) inside your browser. It does not read, store or send the text, forms, cookies or passwords of any page.</p>
<h2>Permissions</h2>
<ul>
<li><code>activeTab</code> and <code>scripting</code>: to add the creature to the tab you click.</li>
<li><code>storage</code>: to save the settings above.</li>
<li>Access to all sites (optional): only if you switch on <em>On every site</em> or <em>Always on this site</em>, so the creature can appear without a click. You can remove it any time.</li>
</ul>
<h2>Remote code</h2>
<p>None. All code is inside the extension package.</p>
<h2>Contact</h2>
<p>Questions or concerns: <a href="${cfg.github}/issues">open an issue on GitHub</a>. The source is at <a href="${cfg.github}/tree/main/extension">github.com/mishanefedov/perch</a>.</p></div>`,
});

// ---------------------------------------------------------------- write
const write = (rel: string, text: string) => { const f = join(OUT, rel); mkdirSync(join(f, ".."), { recursive: true }); writeFileSync(f, text); };
for (const p of pages) write(p.path === "/" ? "index.html" : join(p.path, "index.html"), layout(p));
write("404.html", layout({ path: "/404.html", title: "Not found · Perch", description: "This page does not exist.", body: `<div class="wrap doc"><h1>Not found</h1><p>The octopus looked everywhere. <a href="/">Go home</a>.</p></div>`, noperch: false }).replace(`<link rel="canonical" href="${abs("/404.html")}">`, `<meta name="robots" content="noindex">`));

write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.filter((p) => !p.noindex).map((p) => `  <url><loc>${abs(p.path)}</loc><lastmod>${TODAY}</lastmod></url>`).join("\n")}\n</urlset>\n`);
write("robots.txt", `User-agent: *\nAllow: /\n\n# AI crawlers and assistants are welcome\n${["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "Claude-SearchBot", "anthropic-ai", "PerplexityBot", "Google-Extended", "Applebot-Extended", "CCBot"].map((b) => `User-agent: ${b}\nAllow: /\n`).join("\n")}\nSitemap: ${abs("/sitemap.xml")}\n`);
write("llms.txt", `${readFileSync("llms.txt", "utf8").trimEnd()}\n\n## Website\n\n- [Home](${abs("/")}): what it is, install, FAQ\n- [Browser extension](${abs("/extension/")}): a creature on any website you visit\n- [For agents](${abs("/agents/")}): commands, JSON output, flags, exit codes\n- [Next.js guide](${abs("/nextjs/")})\n- [Astro guide](${abs("/astro/")})\n- [HTML, WordPress, Webflow, Shopify](${abs("/html/")})\n`);
write("vercel-headers-check.txt", "ok\n");
rmSync(join(OUT, "vercel-headers-check.txt"));

console.log(`site-dist/: ${pages.length} pages + 404, site url ${SITE}`);
if (!existsSync(join(OUT, "index.html"))) process.exit(1);
