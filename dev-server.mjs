import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 4173);

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".otf": "font/otf",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".xml": "application/xml; charset=utf-8"
};

const headers = {
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff"
};

createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://localhost");
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const candidates = extname(safePath)
    ? [safePath]
    : [safePath, `${safePath}.html`, join(safePath, "index.html")];
  let file;
  let status = 200;

  for (const candidate of candidates) {
    const candidateFile = join(root, candidate);
    try {
      const info = await stat(candidateFile);
      if (info.isFile()) {
        file = candidateFile;
        break;
      }
    } catch {
      // Try the next clean-URL candidate.
    }
  }

  if (!file) {
    file = join(root, "404.html");
    status = 404;
  }

  response.writeHead(status, {
    ...headers,
    "Content-Type": types[extname(file).toLowerCase()] || "application/octet-stream"
  });
  createReadStream(file).pipe(response);
}).listen(port, "127.0.0.1", () => {
  console.log(`Local: http://127.0.0.1:${port}/`);
});
