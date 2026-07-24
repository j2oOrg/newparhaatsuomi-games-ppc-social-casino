import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
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
const entries = await readdir(root, { withFileTypes: true });
const htmlEntries = entries.filter((entry) => entry.isFile() && extname(entry.name) === ".html");

const requiredPublicCopy = [
  "18+ only",
  "Free social casino",
  "No real-money gambling",
  "No prizes of real-world value",
  "IRONCLAD SYSTEMS LTD",
  "contact@centrallion.com",
  "support@centrallion.com"
];

for (const entry of htmlEntries) {
  const html = await readFile(join(root, entry.name), "utf8");
  const wordmarks = [...html.matchAll(/<span class="brand__type">([^<]+)<\/span>/g)];
  if (!wordmarks.length || wordmarks.some((match) => match[1] !== "Centrallion")) {
    throw new Error(`${entry.name} has an unexpected public wordmark.`);
  }

  if (/\b(?:coin|coins|credit|credits)\b/i.test(html)) {
    throw new Error(`${entry.name} contains a prohibited money-like game-unit name.`);
  }

  for (const copy of requiredPublicCopy) {
    if (!html.includes(copy)) {
      throw new Error(`${entry.name} is missing required public copy: ${copy}`);
    }
  }

  for (const frame of html.matchAll(/<iframe\b[^>]*data-game-frame[^>]*>/gi)) {
    const withoutDeferredSource = frame[0].replace(/\sdata-src\s*=\s*(["']).*?\1/i, "");
    if (/\ssrc\s*=/i.test(withoutDeferredSource)) {
      throw new Error(`${entry.name} eagerly loads a game iframe before age confirmation.`);
    }
  }
}

const siteScript = await readFile(join(root, "site.js"), "utf8");
if (/navigator\.userAgent|Googlebot|AdsBot/i.test(siteScript)) {
  throw new Error("site.js contains user-agent-specific behavior. Keep one experience for people and crawlers.");
}

await rm(dist, { recursive: true, force: true });
await mkdir(client, { recursive: true });
await mkdir(join(client, "assets"), { recursive: true });
await mkdir(server, { recursive: true });
await mkdir(join(dist, ".openai"), { recursive: true });
await copyFile(join(root, ".openai", "hosting.json"), join(dist, ".openai", "hosting.json"));

for (const entry of entries) {
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
  const contentType = headers.get("Content-Type") || "";
  if (contentType.includes("text/html")) {
    headers.set("Cache-Control", "private, no-store, max-age=0");
    headers.set("CDN-Cache-Control", "no-store");
    headers.set("Cloudflare-CDN-Cache-Control", "no-store");
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");
    headers.delete("ETag");
    headers.delete("Last-Modified");
  } else {
    headers.set("Cache-Control", "public, no-cache, max-age=0, must-revalidate");
    headers.set("CDN-Cache-Control", "no-cache");
    headers.set("Cloudflare-CDN-Cache-Control", "no-cache");
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
