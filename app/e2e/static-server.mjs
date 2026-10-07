/**
 * Serves the landing page (repo root) the way Vercel does with cleanUrls:
 * /playbook -> playbook.html. Used only by Playwright; no dependencies.
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const PORT = Number(process.env.PORT || 4000);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath).replace(/^\/+/, "");
  const candidates = clean === "" ? ["index.html"] : [clean, `${clean}.html`];
  for (const c of candidates) {
    const file = join(ROOT, c);
    const rel = relative(ROOT, file);
    // Stay inside the landing site: no escaping the root, no serving the app.
    if (rel.startsWith("..") || isAbsolute(rel) || rel.split(sep)[0] === "app") continue;
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  return null;
}

createServer((req, res) => {
  const file = resolveFile(new URL(req.url, "http://x").pathname);
  if (!file) {
    res.writeHead(404).end("Not found");
    return;
  }
  res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`landing on http://localhost:${PORT}`));
