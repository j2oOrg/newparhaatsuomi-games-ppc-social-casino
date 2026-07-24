import { copyFile, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const dist = join(root, "dist");
const client = join(dist, "client");
const server = join(dist, "server");

const rootExtensions = new Set([".html", ".webp"]);
const rootFiles = [
  "styles.css",
  "site.js",
  "robots.txt",
  "sitemap.xml",
  "license.pdf",
  "_headers"
];
const assetFiles = ["og.png", "centrallion-nordic-night.webp"];

await rm(dist, { recursive: true, force: true });
await mkdir(client, { recursive: true });
await mkdir(join(client, "assets"), { recursive: true });
await mkdir(server, { recursive: true });

for (const entry of await readdir(root, { withFileTypes: true })) {
  if (!entry.isFile() || !rootExtensions.has(extname(entry.name))) continue;
  await copyFile(join(root, entry.name), join(client, entry.name));
}

for (const file of rootFiles) {
  await copyFile(join(root, file), join(client, file));
}

for (const file of assetFiles) {
  await copyFile(join(root, "assets", file), join(client, "assets", file));
}

const worker = `const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-src https://socialgamesstudio.com; connect-src 'self'; form-action 'self'",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN"
};

function secure(response, status = response.status) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }
  return new Response(response.body, { status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/") {
      url.pathname = "/index.html";
    }

    const assetRequest = url.href === request.url ? request : new Request(url, request);
    let response = await env.ASSETS.fetch(assetRequest);
    if (response.status === 404 && !url.pathname.endsWith("/") && !url.pathname.split("/").pop().includes(".")) {
      const htmlUrl = new URL(url);
      htmlUrl.pathname = url.pathname + ".html";
      response = await env.ASSETS.fetch(new Request(htmlUrl, request));
    }
    if (response.status !== 404) {
      return secure(response);
    }

    const notFoundUrl = new URL("/404.html", request.url);
    const notFound = await env.ASSETS.fetch(new Request(notFoundUrl, request));
    return secure(notFound, 404);
  }
};
`;

const wrangler = {
  main: "index.js",
  compatibility_date: "2026-05-15",
  compatibility_flags: ["nodejs_compat"],
  rules: [{ type: "ESModule", globs: ["**/*.js"] }],
  no_bundle: true,
  assets: { directory: "../client" }
};

await writeFile(join(server, "index.js"), worker, "utf8");
await writeFile(join(server, "wrangler.json"), `${JSON.stringify(wrangler, null, 2)}\n`, "utf8");

console.log(`Built ${client} and ${server}`);
