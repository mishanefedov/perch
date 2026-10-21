// Builds the website into site-dist/: plain HTML, one stylesheet, no framework, no third-party requests.
//   bun run build && bun run site:build
// The site URL comes from SITE_URL, else site/config.json. Change the domain there.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const cfg = JSON.parse(readFileSync("site/config.json", "utf8")) as { url: string; name: string; github: string; npm: string };
// SITE_URL wins; on Vercel the production domain (your custom domain once attached) is used; else config.json
const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "";
const SITE = (process.env.SITE_URL ?? (vercelUrl || cfg.url)).replace(/\/$/, "");
const VERSION = (JSON.parse(readFileSync("package.json", "utf8")) as { version: string }).version;
const OUT = "site-dist";
const CDN = "https://unpkg.com/perch-pet@0.1/dist/perch.js";
const TODAY = new Date().toISOString().slice(0, 10);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync("site/static", OUT, { recursive: true });
for (const f of ["perch.js", "perch-tuner.js"]) cpSync(join("dist", f), join(OUT, f));
mkdirSync(join(OUT, "assets"), { recursive: true });
for (const f of ["hero.svg", "creatures.svg", "tuner.png", "editor.png", "demo.gif"]) cpSync(join("assets", f), join(OUT, "assets", f));
for (const f of ["schema.json", "llms-full.txt", "AGENTS.md"]) cpSync(f, join(OUT, f));

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const abs = (p: string) => SITE + p;

interface Page { path: string; title: string; description: string; body: string; ld?: object[]; ogType?: string; noperch?: boolean }
const pages: Page[] = [];

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
<link rel="stylesheet" href="/site.css">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<div class="wrap">
<header class="nav">
  <a class="brand" href="/"><img src="/logo.svg" width="30" height="24" alt="" aria-hidden="true">perch</a>
  <a class="hide-sm" href="/nextjs/">Next.js</a>
  <a class="hide-sm" href="/astro/">Astro</a>
  <a class="hide-sm" href="/html/">HTML &amp; no-code</a>
  <a href="/agents/">For agents</a>
  <a class="gh" href="${cfg.github}">GitHub</a>
</header>
</div>
<main id="main">
${p.body}
</main>
<footer>
<div class="wrap">
<div class="cols">
  <span><strong>perch</strong> v${VERSION} · MIT · by <a href="https://github.com/mishanefedov">Michael Nefedov</a></span>
  <a href="${cfg.github}">GitHub</a>
  <a href="${cfg.npm}">npm</a>
  <a href="/agents/">For AI agents</a>
  <a href="/llms.txt">llms.txt</a>
  <a href="/schema.json">schema.json</a>
  <a href="${cfg.github}/issues">Report a problem</a>
</div>
</div>
</footer>
${p.noperch ? "" : `<script src="/perch.js" data-goal="#install" data-stickiness="0.6" defer></script>`}
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
  ["What is Perch?", "Perch is a free, open-source pixel creature for websites. One script makes a small animated mascot that stands on your real headings, text and buttons, rides them while visitors scroll, and points at your call to action."],
  ["How do I add a mascot to my website?", "Run npx perch-pet in your project folder. It finds your layout file, copies the script into your public folder and adds one script tag. Without a repo, paste one script tag before the closing body tag."],
  ["Does Perch work with Next.js, Astro, SvelteKit, Nuxt and Vite?", "Yes. The setup command edits the right file for Next.js (app and pages router, including route groups), Astro, SvelteKit, Nuxt, Vite and plain HTML. For anything else, such as WordPress, Webflow or Shopify, paste the script tag."],
  ["Will it slow down my site?", "The script is about 27 kB, 10 kB gzipped. It draws one small canvas, pauses in background tabs, adds no layout shift and makes no network requests. The tuner panel is a separate file that only loads on localhost."],
  ["Does it track my visitors?", "No. There is no tracking and no analytics. The only request it can make is one optional fetch of your own creature file."],
  ["Can I make my own character?", "Yes. On localhost, the tuner has a pixel editor for the body, legs, arms, colors and eyes. Download the JSON and run npx perch-pet creature ./creature.json."],
  ["Does it work on phones?", "Yes. It uses a smaller size on touch screens and follows taps and scrolling. You can turn it off on phones with data-mobile=\"false\"."],
  ["Can an AI coding agent install it?", "Yes. The setup is a deterministic command, not a prompt. Agents run npx perch-pet detect to see what it found, then npx perch-pet, and use --file when there is more than one place to choose."],
  ["Is it free?", "Yes. Perch is MIT licensed. The source is on GitHub."],
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
<section class="hero" style="padding-top:40px">
  <span class="eyebrow">free · open source · MIT</span>
  <h1>A pixel creature that lives on <em>your website.</em></h1>
  <p class="lead">Perch stands on your <strong>real headings, text and buttons</strong>, rides them while you scroll, and points at your call to action. One script tag. Tune it live on localhost.</p>
  <div id="install" class="install"><span class="dollar" aria-hidden="true">$</span><code>npx perch-pet</code>${copy("npx perch-pet")}</div>
  <div class="cta-row">
    <a class="btn primary" href="${cfg.github}">View on GitHub</a>
    <a class="btn" href="/?perch=tune">Tune the creature on this page</a>
  </div>
  <p class="fine">Next.js · Astro · SvelteKit · Nuxt · Vite · plain HTML · 10 kB gzipped · no tracking</p>
  <div class="hero-art"><img src="/assets/hero.svg" width="960" height="300" alt="A pixel octopus hopping between a heading, text lines, a card and a button on a web page"></div>
  <div class="chips" role="group" aria-label="Try another creature on this page">Try another one on this page:
    ${["octopus", "blob", "cat", "ghost", "robot", "alien"].map((c) => `<button type="button" data-creature="${c}" aria-pressed="${c === "octopus"}">${c}</button>`).join("\n    ")}
  </div>
</section>
</div>

<div class="wrap">
<section id="how">
  <h2>Three steps. No code changes.</h2>
  <p class="sub">Perch is a package, not a rewrite. The command adds one script tag. Everything else happens in a panel on localhost.</p>
  <ol class="steps">
    <li><h3>Run one command</h3><p>It finds your layout file and adds the tag. If it finds more than one place, it asks you. Undo any time.</p><pre>npx perch-pet</pre></li>
    <li><h3>Click the gear</h3><p>Open your site on localhost. Swap creatures, draw your own, switch on “show floors”, and click your call to action to pick it.</p><pre>localhost:3000  ⚙</pre></li>
    <li><h3>Save with one command</h3><p>The panel prints the exact command for your choices. Paste it in your terminal.</p><pre>npx perch-pet set creature=cat stickiness=0.8</pre></li>
  </ol>
</section>

<section id="demo">
  <h2>See it work</h2>
  <p class="sub">It jumps to what you click, rides the page while you scroll, and gets squashed when the page pushes it into the top. Then the tuner swaps it for a cat and an alien and edits its pixels.</p>
  <div class="demo"><video autoplay muted loop playsinline preload="metadata" width="760" height="475" aria-label="Screen recording of the Perch demo and tuner"><source src="/demo.mp4" type="video/mp4"><img src="/assets/demo.gif" width="760" height="475" alt="Screen recording of the Perch demo and tuner" loading="lazy"></video></div>
  <div class="pair">
    <img src="/assets/tuner.png" loading="lazy" width="1000" height="700" alt="The Perch tuner panel on localhost with sliders, a creature picker and blue floor lines over the page">
    <img src="/assets/editor.png" loading="lazy" width="1000" height="700" alt="The pixel editor in the Perch tuner with a palette and eye controls">
  </div>
</section>

<section id="features">
  <h2>Made to be left alone</h2>
  <p class="sub">Defaults that work on most sites, and the small things that stop it from becoming a problem.</p>
  <div class="grid">
    <div class="card"><span class="ico" aria-hidden="true">🧱</span><h3>Stands on your real elements</h3><p>Headings, text lines, cards, buttons, forms. It stands on the letters, not on the box around them.</p></div>
    <div class="card"><span class="ico" aria-hidden="true">🎯</span><h3>Finds your call to action</h3><p>A submit button, or a button that says “sign up” or “book a demo”. Point it somewhere else with one selector.</p></div>
    <div class="card"><span class="ico" aria-hidden="true">🎛️</span><h3>Tune it live</h3><p>Stickiness, speed and size. “Show floors” draws what it found, so you see why it stands where it stands.</p></div>
    <div class="card"><span class="ico" aria-hidden="true">🎨</span><h3>Draw your own</h3><p>A pixel editor for the body, legs, arms, colors and eyes. Six creatures are built in.</p></div>
    <div class="card"><span class="ico" aria-hidden="true">🪶</span><h3>Light and private</h3><p>10 kB gzipped. No tracking, no network calls, no layout shift. The tuner never loads for visitors.</p></div>
    <div class="card"><span class="ico" aria-hidden="true">♿</span><h3>Polite</h3><p>Never blocks clicks. Sits still with “reduce motion”. Hidden from screen readers. Skips popups and fixed headers.</p></div>
  </div>
</section>

<section id="creatures">
  <h2>Six creatures, or your own</h2>
  <p class="sub">Octopus is the default. Pick one with <code>data-creature="cat"</code> or in the tuner.</p>
  <img src="/assets/creatures.svg" width="980" height="170" loading="lazy" alt="The six Perch creatures: octopus, blob, cat, ghost, robot and alien">
</section>

<section id="agents">
  <div class="agent">
    <h2>Built for coding agents</h2>
    <p class="sub">The setup is a command, not a skill file and not a prompt. It is deterministic: no network, no model, plain file edits. Give your agent this:</p>
    <div class="prompt code"><pre id="agent-prompt">Add the Perch mascot to this site. Run \`npx perch-pet detect\` to see what it found, then \`npx perch-pet\` to install. If it lists several places, rerun with \`--file <path>\`. Open the dev server and check that the creature stands on the page elements and points at the main button.</pre>${copy("Add the Perch mascot to this site. Run `npx perch-pet detect` to see what it found, then `npx perch-pet` to install. If it lists several places, rerun with `--file <path>`. Open the dev server and check that the creature stands on the page elements and points at the main button.")}</div>
    <div class="links"><a href="/agents/">Agent guide</a><a href="/llms.txt">llms.txt</a><a href="/llms-full.txt">llms-full.txt</a><a href="/schema.json">Options schema</a><a href="/AGENTS.md">AGENTS.md</a></div>
  </div>
</section>

<section id="faq">
  <h2>Questions</h2>
  ${FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("\n  ")}
</section>

<section style="text-align:center">
  <h2>Give your site a pet.</h2>
  <div id="install-2" class="install"><span class="dollar" aria-hidden="true">$</span><code>npx perch-pet</code>${copy("npx perch-pet")}</div>
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
<div class="note">The tuner file is deployed with your site but is only loaded on localhost, local-network addresses and <code>?perch=tune</code>.</div>`,
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

// ---------------------------------------------------------------- write
const write = (rel: string, text: string) => { const f = join(OUT, rel); mkdirSync(join(f, ".."), { recursive: true }); writeFileSync(f, text); };
for (const p of pages) write(p.path === "/" ? "index.html" : join(p.path, "index.html"), layout(p));
write("404.html", layout({ path: "/404.html", title: "Not found · Perch", description: "This page does not exist.", body: `<div class="wrap doc"><h1>Not found</h1><p>The octopus looked everywhere. <a href="/">Go home</a>.</p></div>`, noperch: false }).replace(`<link rel="canonical" href="${abs("/404.html")}">`, `<meta name="robots" content="noindex">`));

write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((p) => `  <url><loc>${abs(p.path)}</loc><lastmod>${TODAY}</lastmod></url>`).join("\n")}\n</urlset>\n`);
write("robots.txt", `User-agent: *\nAllow: /\n\n# AI crawlers and assistants are welcome\n${["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "Claude-SearchBot", "anthropic-ai", "PerplexityBot", "Google-Extended", "Applebot-Extended", "CCBot"].map((b) => `User-agent: ${b}\nAllow: /\n`).join("\n")}\nSitemap: ${abs("/sitemap.xml")}\n`);
write("llms.txt", `${readFileSync("llms.txt", "utf8").trimEnd()}\n\n## Website\n\n- [Home](${abs("/")}): what it is, install, FAQ\n- [For agents](${abs("/agents/")}): commands, JSON output, flags, exit codes\n- [Next.js guide](${abs("/nextjs/")})\n- [Astro guide](${abs("/astro/")})\n- [HTML, WordPress, Webflow, Shopify](${abs("/html/")})\n`);
write("vercel-headers-check.txt", "ok\n");
rmSync(join(OUT, "vercel-headers-check.txt"));

console.log(`site-dist/: ${pages.length} pages + 404, site url ${SITE}`);
if (!existsSync(join(OUT, "index.html"))) process.exit(1);
