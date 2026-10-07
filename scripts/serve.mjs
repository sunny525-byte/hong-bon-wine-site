#!/usr/bin/env node
/**
 * Local preview server with caching disabled.
 *
 * Why not `python -m http.server`: it sends Last-Modified but no Cache-Control,
 * so browsers fall back to heuristic caching and will serve a stale assets/app.js
 * against a freshly edited page. That looks like a code bug (the page renders but
 * its JS-driven parts misbehave) and costs real debugging time. This sends
 * no-store and omits Last-Modified entirely.
 *
 * Usage:  node scripts/serve.mjs [port] [root]
 *         node scripts/serve.mjs 8931 .
 */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const PORT = Number(process.argv[2] || 8931);
const ROOT = resolve(process.argv[3] || '.');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
};

const isFile = async p => {
  try {
    return (await stat(p)).isFile();
  } catch {
    return false;
  }
};

/** Resolve a URL to a file, mirroring Netlify's directory-index + pretty-URL behaviour. */
async function resolveFile(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath.split('?')[0].split('#')[0]));
  if (clean.includes('..')) return null;              // no traversal
  const base = join(ROOT, clean);

  // exact hit, or a directory with an index.html
  try {
    const s = await stat(base);
    if (s.isFile()) return base;
    if (s.isDirectory()) {
      const idx = join(base, 'index.html');
      if (await isFile(idx)) return idx;
    }
  } catch {
    /* fall through to the pretty-URL forms */
  }

  // Netlify also serves /privacy for /privacy.html and /red-wine for /red-wine/
  for (const candidate of [base + '.html', join(base, 'index.html')]) {
    if (await isFile(candidate)) return candidate;
  }
  return null;
}

const server = createServer(async (req, res) => {
  const file = await resolveFile(req.url || '/');
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('404 Not Found');
  }
  res.writeHead(200, {
    'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
    // no-store, and deliberately no Last-Modified, so nothing is cached heuristically
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    Pragma: 'no-cache',
    Expires: '0',
  });
  createReadStream(file).pipe(res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`serving ${ROOT}`);
  console.log(`  http://127.0.0.1:${PORT}      (zh-TW)`);
  console.log(`  http://127.0.0.1:${PORT}/en/  (English)`);
  console.log('  caching disabled (no-store, no Last-Modified)');
});
