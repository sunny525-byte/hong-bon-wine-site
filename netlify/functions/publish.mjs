/**
 * Publishing endpoint for the catalogue editor.
 *
 * The admin is a static page: it has no way to write to the site. This function is
 * the only thing that can, and it does so by committing to the repository the site
 * is built from — which triggers the normal Netlify build, so what the editor saves
 * reaches production by the same path as any other change (and `git revert` undoes
 * it).
 *
 *   GET  /api/publish   → { configured, sha, lastCommit }  (status + revision guard)
 *   POST /api/publish   → { ok, commit, files, published } (also used as a dry run)
 *
 * Configuration (Netlify → Site configuration → Environment variables):
 *   GITHUB_TOKEN   fine-grained PAT, Contents: Read and write on GITHUB_REPO only
 *   GITHUB_REPO    "owner/name", e.g. sunny525-byte/hong-bon-wine-site
 *   GITHUB_BRANCH  optional, defaults to "main"
 *   DRY_RUN        "1" validates and reports without writing anything
 *
 * Authorisation reuses the session cookie the /admin gate already sets: it is
 * HttpOnly + Secure + SameSite=Strict, so a cross-site request cannot carry it, and
 * it holds sha256(PROTECTED_PAGE_PASSWORD) — the same secret is readable here, so no
 * second credential is introduced.
 */

const COOKIE = 'hongbon_admin_session';
const MAX_BODY = 5 * 1024 * 1024;
const MAX_WINES = 500;
const MAX_IMAGES = 60;
const UPSTREAM = 'https://api.github.com';

const encoder = new TextEncoder();

const env = (key) => {
  try {
    if (typeof Netlify !== 'undefined' && Netlify.env) return Netlify.env.get(key);
  } catch {
    /* not running on Netlify — fall through to process.env (local tests) */
  }
  return typeof process !== 'undefined' && process.env ? process.env[key] : undefined;
};

const readConfig = () => ({
  token: env('GITHUB_TOKEN') || '',
  repo: env('GITHUB_REPO') || '',
  branch: env('GITHUB_BRANCH') || 'main',
  dryRun: String(env('DRY_RUN') || '') === '1',
  pruneUploads: String(env('PRUNE_UPLOADS') || '1') !== '0',
  password: env('PROTECTED_PAGE_PASSWORD') || '',
});

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

const toBase64 = (bytes) => {
  let out = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(out);
};

const hex = (buffer) =>
  Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('');

async function sha256(value) {
  return hex(await crypto.subtle.digest('SHA-256', typeof value === 'string' ? encoder.encode(value) : value));
}

/**
 * Mirrors digest() in netlify/edge-functions/admin-gate.js exactly, because that is
 * what the browser is given: base64(sha256(password)), not hex. Getting this wrong
 * does not fail loudly — every authorised request just looks like "not signed in".
 */
async function sessionToken(password) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(password)));
  return btoa(String.fromCharCode.apply(null, bytes));
}

/** Constant-time compare, so a wrong cookie cannot be discovered byte by byte. */
function sameSecret(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function sessionCookie(request) {
  const raw = request.headers.get('cookie') || '';
  const found = raw.split(/;\s*/).find((part) => part.startsWith(`${COOKIE}=`));
  return found ? found.slice(COOKIE.length + 1) : '';
}

/**
 * The owner's browser sends Origin on a same-origin POST; a same-site request from
 * another origin would too, but its cookie is SameSite=Strict so it is never sent.
 * Checking the host as well costs nothing and closes the "plain form post from
 * another site" case for older browsers.
 */
function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true; // same-origin requests from fetch may omit it; cookie check still applies
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

async function github(cfg, path, init = {}) {
  const response = await fetch(`${UPSTREAM}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${cfg.token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'hongbon-admin-publish',
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!response.ok) {
    const message = (body && body.message) || text || 'request failed';
    const error = new Error(`GitHub ${response.status}: ${message}`);
    error.status = response.status;
    throw error;
  }
  return body;
}

/** The blob sha of catalog.json on the branch — used as the revision guard. */
async function remoteCatalogSha(cfg) {
  try {
    const file = await github(cfg, `/repos/${cfg.repo}/contents/catalog.json?ref=${encodeURIComponent(cfg.branch)}`);
    return file && file.sha ? file.sha : null;
  } catch (error) {
    if (error.status === 404) return null; // no catalogue yet: nothing to clobber
    throw error;
  }
}

const DATA_URI = /^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/;

/**
 * The editor compresses uploads in the browser and keeps them as base64 data URIs.
 * Inlining those into the catalogue is what makes uploaded photos expensive: the
 * generator copies the value into every <img> on every page showing it (one 146 KB
 * photo cost ~195 KB across 24 pages). So each one is lifted out into a real file
 * under assets/ and the field is rewritten to point at it.
 *
 * The walk is generic rather than a list of known fields, so an image added to a new
 * place in the schema is handled without touching this code.
 */
async function extractImages(catalogue) {
  const files = [];
  const byHash = new Map();
  let seen = 0;

  const walk = async (node) => {
    if (Array.isArray(node)) {
      for (const item of node) await walk(item);
      return node;
    }
    if (!node || typeof node !== 'object') return node;

    for (const key of Object.keys(node)) {
      const value = node[key];
      if (typeof value === 'string') {
        const match = DATA_URI.exec(value);
        if (!match) continue;
        seen += 1;
        if (seen > MAX_IMAGES) throw Object.assign(new Error(`too many inline images (limit ${MAX_IMAGES})`), { status: 413 });
        const bytes = Uint8Array.from(atob(match[2].replace(/\s+/g, '')), (c) => c.charCodeAt(0));
        const hash = (await sha256(bytes)).slice(0, 16);
        const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
        const path = `assets/upload-${hash}.${ext}`;
        if (!byHash.has(path)) {
          byHash.set(path, true);
          files.push({ path, base64: toBase64(bytes), bytes: bytes.length });
        }
        node[key] = `/${path}`;
      } else if (value && typeof value === 'object') {
        await walk(value);
      }
    }
    return node;
  };

  await walk(catalogue);
  return { files, inlined: seen };
}

const UPLOAD = /assets\/upload-[0-9a-f]+\.(?:webp|png|jpe?g|gif)/g;
const UPLOAD_EXACT = /^assets\/upload-[0-9a-f]+\.(?:webp|png|jpe?g|gif)$/;

/** The upload files the catalogue being published actually points at. */
function referencedUploads(serialised) {
  return new Set(serialised.match(UPLOAD) || []);
}

/**
 * Upload files currently on the branch. Up to now the endpoint only ever added files, so a
 * photo that stopped being referenced — replaced, or the wine using it deleted — stayed in
 * the repository and kept being served. Returns null when the listing is truncated, in which
 * case the caller prunes nothing rather than guessing at what exists.
 */
async function existingUploads(cfg) {
  const tree = await github(cfg, `/repos/${cfg.repo}/git/trees/${encodeURIComponent(cfg.branch)}?recursive=1`);
  if (tree.truncated) return null;
  return (tree.tree || []).filter((e) => e.type === 'blob' && UPLOAD_EXACT.test(e.path)).map((e) => e.path);
}

/** Shape checks only — enough to refuse a payload that would break the build. */
function validate(catalogue) {
  if (!catalogue || typeof catalogue !== 'object' || Array.isArray(catalogue)) return 'catalogue must be a JSON object';
  if (!Array.isArray(catalogue.wines)) return 'catalogue.wines must be an array';
  if (catalogue.wines.length === 0) return 'catalogue.wines is empty — refusing to publish an empty catalogue';
  if (catalogue.wines.length > MAX_WINES) return `catalogue.wines has more than ${MAX_WINES} entries`;
  if (!catalogue.ui || typeof catalogue.ui !== 'object' || Array.isArray(catalogue.ui)) return 'catalogue.ui must be an object';
  for (const [index, wine] of catalogue.wines.entries()) {
    if (!wine || typeof wine !== 'object') return `wines[${index}] is not an object`;
    if (!wine.id) return `wines[${index}] has no id — the editor assigns one on creation`;
  }
  return null;
}

/**
 * One commit for the catalogue and every new image, via the Git Data API. Committing
 * file-by-file would queue one Netlify build per file; this way the site rebuilds once.
 */
async function commitFiles(cfg, files, message) {
  const ref = await github(cfg, `/repos/${cfg.repo}/git/ref/heads/${encodeURIComponent(cfg.branch)}`);
  const head = ref.object.sha;
  const parent = await github(cfg, `/repos/${cfg.repo}/git/commits/${head}`);

  const blobs = [];
  for (const file of files) {
    if (file.remove) {
      blobs.push(null); // a deletion needs no blob
      continue;
    }
    blobs.push(await github(cfg, `/repos/${cfg.repo}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: file.base64, encoding: 'base64' }),
    }));
  }

  const tree = await github(cfg, `/repos/${cfg.repo}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({
      base_tree: parent.tree.sha,
      // sha:null is how the Git Data API removes a path
      tree: files.map((file, i) => (file.remove
        ? { path: file.path, mode: '100644', type: 'blob', sha: null }
        : { path: file.path, mode: '100644', type: 'blob', sha: blobs[i].sha })),
    }),
  });

  const commit = await github(cfg, `/repos/${cfg.repo}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message, tree: tree.sha, parents: [head] }),
  });

  await github(cfg, `/repos/${cfg.repo}/git/refs/heads/${encodeURIComponent(cfg.branch)}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });

  return { sha: commit.sha, previous: head };
}

async function status(cfg) {
  const block = {
    configured: Boolean(cfg.token && cfg.repo),
    dryRun: cfg.dryRun,
    repo: cfg.repo || null,
    branch: cfg.branch,
    sha: null,
    lastCommit: null,
  };
  if (!block.configured) return block;
  block.sha = await remoteCatalogSha(cfg);
  try {
    const commits = await github(cfg, `/repos/${cfg.repo}/commits?path=catalog.json&sha=${encodeURIComponent(cfg.branch)}&per_page=1`);
    if (Array.isArray(commits) && commits[0]) {
      block.lastCommit = {
        sha: commits[0].sha,
        date: commits[0].commit?.committer?.date || null,
        message: commits[0].commit?.message || null,
      };
    }
  } catch {
    /* a missing history entry is not worth failing the status call over */
  }
  return block;
}

export default async function handler(request) {
  const cfg = readConfig();

  if (!cfg.password) return json({ error: 'admin password is not configured' }, 503);
  if (!sameSecret(sessionCookie(request), await sessionToken(cfg.password))) {
    return json({ error: 'not signed in — open /admin and sign in first' }, 401);
  }
  if (!sameOrigin(request)) return json({ error: 'cross-origin request refused' }, 403);

  if (request.method === 'GET') {
    try {
      return json(await status(cfg));
    } catch (error) {
      return json({ error: error.message }, 502);
    }
  }

  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  if (!cfg.token || !cfg.repo) {
    return json({ error: 'publishing is not configured: set GITHUB_TOKEN and GITHUB_REPO in Netlify' }, 503);
  }

  const length = Number(request.headers.get('content-length') || 0);
  if (length && length > MAX_BODY) return json({ error: 'the catalogue is too large to publish' }, 413);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'body must be JSON' }, 400);
  }

  const catalogue = payload?.catalogue;
  const problem = validate(catalogue);
  if (problem) return json({ error: problem }, 400);

  const current = await remoteCatalogSha(cfg).catch((error) => {
    throw error;
  });
  if (payload.baseSha && current && payload.baseSha !== current) {
    return json({
      error: 'someone else changed the site since this page was loaded — reload to get the current catalogue before publishing',
      reason: 'stale-revision',
      sha: current,
    }, 409);
  }

  let extracted;
  try {
    extracted = await extractImages(catalogue);
  } catch (error) {
    return json({ error: error.message }, error.status || 400);
  }

  const serialised = `${JSON.stringify(catalogue, null, 2)}\n`; // trailing newline, matching the repo's file
  const files = [
    { path: 'catalog.json', base64: toBase64(encoder.encode(serialised)), bytes: serialised.length },
    ...extracted.files,
  ];

  // Photos that are no longer pointed at by anything. A data URI uploaded in this very
  // publish is already rewritten to its path above, so it counts as referenced.
  let prune = [];
  if (cfg.pruneUploads) {
    const referenced = referencedUploads(serialised);
    const existing = await existingUploads(cfg).catch(() => null);
    if (existing) prune = existing.filter((path) => !referenced.has(path));
  }
  const removals = prune.map((path) => ({ path, remove: true }));

  const summary = [
    `Publish catalogue from the admin`,
    '',
    `${catalogue.wines.length} wines`,
    extracted.files.length ? `${extracted.files.length} uploaded image(s) added under assets/` : null,
    prune.length ? `${prune.length} unreferenced upload(s) removed` : null,
  ].filter(Boolean).join('\n');

  if (cfg.dryRun) {
    return json({
      ok: true,
      dryRun: true,
      wouldCommit: { path: 'catalog.json', bytes: files[0].bytes },
      uploadedImages: extracted.files.map((file) => ({ path: file.path, bytes: file.bytes })),
      wouldPrune: prune,
      inlined: extracted.inlined,
      repo: cfg.repo,
      branch: cfg.branch,
    });
  }

  try {
    const result = await commitFiles(cfg, [...files, ...removals], summary);
    let sha = null;
    try {
      sha = await remoteCatalogSha(cfg);
    } catch {
      /* refreshing the revision is best-effort; the client can reload instead */
    }
    return json({
      ok: true,
      commit: result.sha,
      previous: result.previous,
      sha,
      // the catalogue as committed (data URIs replaced by asset paths), so the editor
      // re-renders to exactly what is on GitHub instead of keeping base64 in memory
      catalogue,
      url: `https://github.com/${cfg.repo}/commit/${result.sha}`,
      treesUrl: `https://github.com/${cfg.repo}/tree/${result.sha}`,
      catalogueBytes: files[0].bytes,
      uploadedImages: extracted.files.map((file) => ({ path: file.path, bytes: file.bytes })),
      pruned: prune,
      message: 'committed — Netlify is building; the site updates in about a minute',
    });
  } catch (error) {
    return json({ error: error.message }, error.status === 401 || error.status === 403 ? 502 : 502);
  }
}

export const config = { path: '/api/publish' };
