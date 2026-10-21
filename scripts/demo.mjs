// `npm run demo` / `bun run demo`: build everything and open the landing page at http://localhost:4173/
// The landing page is the demo: the creature lives on it, and the gear button opens the tuner.
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { extname, join, normalize } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const port = Number(process.env.PORT) || 4173;

// build first (needs bun); if bun is missing, use an existing dist/
try {
  execFileSync("bun", ["run", "build"], { cwd: root, stdio: "inherit" });
  execFileSync("bun", ["run", "site:build"], { cwd: root, stdio: "inherit", env: { ...process.env, SITE_URL: `http://localhost:${port}` } });
} catch {
  if (!existsSync(join(root, "site-dist/index.html"))) { console.error("Could not build the site and there is no site-dist/. Install bun (https://bun.sh), then run `bun install && bun run demo`."); process.exit(1); }
}

const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".gif": "image/gif", ".mp4": "video/mp4", ".txt": "text/plain; charset=utf-8", ".md": "text/plain; charset=utf-8", ".xml": "application/xml" };
const server = createServer((req, res) => {
  let path = decodeURIComponent((req.url ?? "/").split("?")[0]);
  if (path.startsWith("/fixtures/")) path = "/test" + path; // test pages used by the screenshot scripts
  else path = "/site-dist" + (path.endsWith("/") ? path + "index.html" : path);
  const file = normalize(join(root, path));
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) { res.statusCode = path === "/favicon.ico" ? 204 : 404; return res.end(); }
  res.setHeader("content-type", types[extname(file)] ?? "application/octet-stream");
  res.setHeader("cache-control", "no-store");
  res.end(readFileSync(file));
});
server.on("error", (e) => { console.error(e.code === "EADDRINUSE" ? `Port ${port} is busy. Try: PORT=4174 npm run demo` : e.message); process.exit(1); });
server.listen(port, () => {
  const url = `http://localhost:${port}/`;
  console.log(`\nPerch demo: ${url}\nA gear button (bottom left) opens the tuner. Ctrl+C to stop.`);
  const open = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  if (!process.env.CI) spawn(open, [url], { stdio: "ignore", detached: true, shell: process.platform === "win32" }).on("error", () => {}).unref();
});
