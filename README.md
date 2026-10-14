# HONG BON — 宏邦貿易 wine catalogue & inquiry site

Bilingual (zh-TW / English) catalogue and inquiry site for **Hong Bon (宏邦貿易)**, a wine
importer in Kaohsiung, Taiwan. The site presents wines and takes enquiries — there are **no
prices, no cart and no online checkout**.

**Live:** [hongbon.tw](https://hongbon.tw) · [hongbon.tw/en/](https://hongbon.tw/en/)

[![Live site](https://img.shields.io/badge/live-hongbon.tw-501e2b)](https://hongbon.tw)
[![Build](https://img.shields.io/badge/build-node%20generate.mjs-339933?logo=node.js&logoColor=white)](#build)
[![Hosting](https://img.shields.io/badge/hosting-netlify-00C7B7?logo=netlify&logoColor=white)](https://netlify.com)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

---

## Contents

- [What this is](#what-this-is)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Making changes](#making-changes)
- [Build](#build)
- [Deployment](#deployment)
- [Content model](#content-model)
- [Project structure](#project-structure)
- [Gotchas worth knowing](#gotchas-worth-knowing)
- [Troubleshooting](#troubleshooting)
- [Docs](#docs)

---

## What this is

A **statically generated** site. `catalog.json` holds all content; `generate.mjs` renders it
into HTML; Netlify builds and publishes on every push to `main`.

| | |
|---|---|
| **Languages** | zh-TW (default, at `/`) and English (at `/en/`) |
| **Pages** | 78 — home, 4 category pages, 20 wine detail pages, 4 policy pages, 3 region + 5 winery pages + 2 hubs, all × 2 locales |
| **Content source** | `catalog.json` (single source of truth) |
| **Generator** | `generate.mjs` — zero dependencies, runs on Node |
| **Hosting** | Netlify, custom domain `hongbon.tw` |
| **Editor** | `/admin` — password-gated by a Netlify Edge Function |
| **Runtime JS** | `assets/app.js` (inquiry list, dialogs, locale-aware strings) |

### Why the site is generated

The original site was hand-written HTML with the wine grid rendered in the browser. That meant
the served HTML contained **no wine content**, so nothing could be indexed by search engines.
The generator prerenders real HTML pages, which is what makes the category and wine pages
indexable, and what allows the same catalogue to be published in two languages.

---

## Architecture

```
catalog.json ──┐
               ├──► generate.mjs ──► index.html, <category>/index.html,
_templates/  ──┘                     wine/<slug>/index.html, <policy>.html,
                                     en/** , sitemap.xml
```

A push to `main` → Netlify runs `node generate.mjs` → publishes the directory.

**`catalog.json` is the only place content lives.** Pages are output, not source — editing
`index.html` directly will be overwritten on the next build.

| Piece | Role |
|---|---|
| `catalog.json` | All content: wines, categories, UI strings, policy copy — bilingual (`{zh, en}`) |
| `_templates/page.html` | The site shell. `{{TOKEN}}`s are filled per locale by the generator |
| `_templates/policy.html` | Policy page shell |
| `generate.mjs` | Reads the catalog + templates, writes every page and the sitemap |
| `admin.html` + `assets/admin.js` | The editor. Loads `catalog.json`; publishing POSTs to the function below |
| `assets/app.js` | Client behaviour: inquiry list, dialogs, locale-aware strings, toasts |
| `assets/hero.js` | Homepage intro video + banner carousel (homepage only) |
| `netlify/edge-functions/admin-gate.js` | Password gate for `/admin` |

### Bilingual model

Every translatable value is `{ "zh": "…", "en": "…" }`. The `t()` helper resolves it with a
fallback — `zh` → `en` → `zh`, and `en` → `en` → `zh` — so **English falls back to Chinese until
a translation exists**, and the site never breaks on a missing string.

`<html lang>` drives the locale, so a page rendered for `/en/` picks up English automatically.

---

## Getting started

Requirements: **Node 20+** (CI runs 24) and `git`. There are no npm dependencies — do not expect
a `package.json`.

```bash
git clone https://github.com/sunny525-byte/hong-bon-wine-site.git
cd hong-bon-wine-site

# generate the pages, then serve them locally with caching disabled
node generate.mjs
node scripts/serve.mjs        # http://127.0.0.1:8931
# optional: link this clone to the Netlify site so `netlify build` works.
# This requires your Netlify account to have access to the site — it lives in the
# CLIENT's account. If it errors with "Project id … not found", you do not have
# access; skip it. `node generate.mjs` is all you need for page work.
netlify link --id a9c26139-fbe7-412e-8034-cc340b8f89e7
```

> **Use `scripts/serve.mjs`, not `python -m http.server`.** The Python server sends
> `Last-Modified` but no `Cache-Control`, so browsers apply *heuristic* caching and will happily
> serve a stale `app.js` against a freshly-edited page — which looks like a code bug but isn't.
> See [Gotchas](#gotchas-worth-knowing).

To reproduce exactly what Netlify does — including bundling the admin Edge Function —
use the Netlify CLI (optional). It needs the one-time `netlify link` above:

```bash
netlify build      # runs the configured build command and bundles the edge function
```

`node generate.mjs` alone is enough for page work; `netlify build` additionally
validates the edge function and the publish configuration.

---

## Making changes

### Content — use the editor

1. Open **`/admin`** (password: the shared admin password — see [SECURITY.md](SECURITY.md))
2. Edit wines, regions, wineries, categories, UI text, policy copy, contact details, hero slides
3. Press **發佈到網站** — the site updates about a minute later

The editor shows every field in Chinese and English side by side. Leaving the English side empty
is fine — that string falls back to Chinese.

**How publishing works.** The editor is a static page, so it writes nothing by itself. Pressing
publish POSTs the catalogue to `netlify/functions/publish.mjs`, which commits it to this
repository via the GitHub API; the commit triggers the ordinary Netlify build. So an editor
change travels the same path as a code change, and **`git revert` undoes it** — every publish is
a commit, listed at
[github.com/sunny525-byte/hong-bon-wine-site/commits/main](https://github.com/sunny525-byte/hong-bon-wine-site/commits/main).

Consequences worth knowing:

- **The GitHub credential never reaches the browser.** It lives only in Netlify's environment
  variables, and only this function can use it.
- **Uploaded photos are stored as files**, not embedded in the catalogue. The editor compresses in
  the browser and hands the function a `data:` URI; the function writes the bytes to
  `assets/upload-<hash>.webp`, points the field at that path, and commits the catalogue and the
  image together — one commit, so only one build runs. Photos that stop being referenced are
  deleted in that same commit, so replacing or removing a picture leaves nothing behind;
  `PRUNE_UPLOADS=0` turns the deletion off.
- **Two people editing at once**: publishing sends the revision it started from, and a stale
  revision is refused with a "reload first" message rather than silently overwriting the other
  change.
- **`下載備份`** always exports the current catalogue as a file, which is also what the publish
  button falls back to when publishing is not configured.
- **A newly added wine is on sale and uses `assets/placeholder.svg`** until a photo is uploaded.
  Unticking 上架 hides it everywhere — hidden wines are dropped by the build, on every page.

If publishing reports that it is not configured, the environment variables in
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) are missing. Until they are set, the editor can only
export a file for a developer to commit.

### Code — edit the source

| To change… | Edit |
|---|---|
| Page markup or layout | `_templates/page.html` (or `_templates/policy.html`) |
| What the generator emits | `generate.mjs` |
| Site styling | `assets/style.css` |
| Client behaviour (inquiry list, dialogs) | `assets/app.js` |
| The editor itself | `admin.html`, `assets/admin.js` |
| Admin password gate | `netlify/edge-functions/admin-gate.js` |
| Publishing (commit to GitHub) | `netlify/functions/publish.mjs` |
| Redirects, build command, headers | `netlify.toml` |

Then run `node generate.mjs`, refresh locally, and **commit the regenerated pages** with your
change (generated output is tracked — see [Build](#build)).

### Adding a new UI string

1. Add the key to the `ui` block in `catalog.json`: `"myKey": { "zh": "…", "en": "…" }`
2. Use `t(ui('myKey'))` in `generate.mjs`, or `{{UI_MYKEY}}` in a template

The key → token mapping is `ui` + the key upper-cased with non-alphanumerics replaced by `_`.
The build **fails loudly** on an unfilled token rather than shipping `{{TOKEN}}` to visitors.

---

## Build

```bash
node generate.mjs
```

It is **idempotent** — running it twice produces identical output, so a rebuild with no content
change is a no-op. It writes:

```
index.html                        en/index.html
<category>/index.html   × 4       en/<category>/index.html   × 4
wine/<slug>/index.html  × 20      en/wine/<slug>/index.html  × 20
<policy>.html           × 4       en/<policy>.html           × 4
sitemap.xml                       (78 URLs with hreflang alternates)
```

Generated files **are committed** on purpose: the repo stays previewable without a build, and
there is always a complete site in git even if a build fails.

Netlify runs the same command (`netlify.toml` → `[build] command`), so a local
`node generate.mjs` and a deploy produce identical output.

---

## Deployment

**Deploying is a push.**

```bash
git add -A
git commit -m "…"
git push origin main
```

Netlify builds and publishes automatically. **Allow ~1 minute, then check the live site**
(an edge node can briefly serve the previous asset — use `?cb=$RANDOM` to bypass it):

```bash
curl -s -o /dev/null -w '%{http_code}\n' "https://hongbon.tw/?cb=$RANDOM"
```

If your Netlify account has access to the site you can also read the deploy record —
this needs access, so it may return `Not Found`:

```bash
netlify api listSiteDeploys \
  --data '{"site_id":"a9c26139-fbe7-412e-8034-cc340b8f89e7","per_page":1}'
```

Probing the live site is the check that always works, and the one that matters.

| | |
|---|---|
| Repository | `sunny525-byte/hong-bon-wine-site` |
| Netlify project / site ID | `hongbon` · `a9c26139-fbe7-412e-8034-cc340b8f89e7` |
| Production domain | `https://hongbon.tw` |
| Legacy host | `hongbon.netlify.app` → **301** → hongbon.tw |
| Build command | `node generate.mjs` |
| Publish directory | `.` (repo root) |
| Edge function | `netlify/edge-functions/admin-gate.js` |
| Publish function | `netlify/functions/publish.mjs` |
| Required env var | `PROTECTED_PAGE_PASSWORD` |
| CI Node version | v24.21.0 — pin via `NODE_VERSION` in `netlify.toml` if it ever matters |

⚠️ **Branch deploys are disabled** on this site — only `main` builds. Pushing a branch produces
**no** deploy preview. Validate with `netlify build` locally, then push to `main`. If a build
fails, Netlify keeps the previously published deploy live, so a bad push does not take the site
down.

Full operational detail, including the Netlify account situation and DNS:
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## Content model

`catalog.json` top level:

| Key | Purpose |
|---|---|
| `version`, `locales`, `defaultLocale` | Schema version and locale list |
| `brand`, `english`, `address`, `headline`, `intro` | Identity + homepage copy (`{zh,en}`) |
| `phone`, `mapUrl`, `logo`, `lineId`, `lineUrl` | Contact details (locale-neutral) |
| `social` | `{ instagram, facebook }` URLs |
| `developer` | `{ name, url }` for the footer credit |
| `payments[]` | Accepted payment methods (`{zh,en}`) |
| `ui{}` | **162 UI strings** — buttons, headings, dialogs, toasts, labels, the language switcher |
| `flavors[]` | Flavour chips: `{zh,en, match[]}` — `match` holds both languages' search terms |
| `categories[]` | `{ slug, type, label{zh,en}, intro{zh,en} }` — drives the category pages |
| `wines[]` | The catalogue (below) |
| `pages[]` | Policy pages: `{ slug, title, description, body[] }` |
| `heroSlides[]` | Homepage banner: `{ image, alt{zh,en} }` |
| `regions[]` | Wine regions — drives `/region/<slug>/` and the `/regions/` hub |
| `wineries[]` | Producers — drives `/winery/<slug>/` and the `/wineries/` hub |

A wine:

```jsonc
{
  "id": "product-1",
  "slug": "red-wild-elegant",        // → /wine/red-wild-elegant/  (editable — but changing it changes the URL)
  "type": "red",                      // must match a category `type`
  "featured": true,                   // shows the "featured" ribbon
  "active": true,                     // false hides it
  "image": "/assets/<uuid>.webp",     // always keep the file extension
  "region": "mosel",                  // a regions[].slug — decides the wine list on that region page
  "winery": "maring-prigge",          // a wineries[].slug — same, for the winery page
  "name":  { "zh": "德國 - 2023 黑皮諾紅酒", "en": "Germany — 2023 Pinot Noir" },
  "en":    { "zh": "RED WINE / WILD & ELEGANT", "en": "RED WINE / WILD & ELEGANT" },
  "taste": { "zh": "產區…", "en": "Region…" },
  "desc":  { "zh": "…", "en": "…" }
}
```

Wines without a `slug` are skipped rather than linked to a 404.

A region and a winery:

```jsonc
// regions[]  →  /region/<slug>/  and a card on /regions/
{
  "slug": "mosel",
  "country": "Germany",              // shown next to the eyebrow, in either locale
  "name":  { "zh": "摩澤爾", "en": "Mosel" },
  "intro": { "zh": "…", "en": "…" }, // the page's lead paragraph(s); \n starts a new <p>
  "image": "/assets/…",               // optional lead photo; "" renders no figure
  "body":  [],                        // optional content blocks (see below)
  "introDraft": true                  // true = the editor shows a "草稿" badge
}

// wineries[]  →  /winery/<slug>/  and a card on /wineries/
{
  "slug": "maring-prigge",
  "region": "mosel",                  // a regions[].slug; empty is allowed
  "country": "Germany",
  "name":  { "zh": "…", "en": "…" },
  "website": "https://…",             // optional; renders a "visit the winery" link
  "story": { "zh": "…", "en": "…" },  // the page's lead paragraph(s)
  "image": "/assets/winery-<slug>-1.webp",  // optional lead photo; "" renders no figure
  "body":  [],                        // optional content blocks
  "storyDraft": true
}
```

`body[]` is the content-block model for anything longer than a lead paragraph. Order is
preserved and each block is one of:

```jsonc
{ "type": "text",  "value": { "zh": "…", "en": "…" } }              // → <p class="section-text">
{ "type": "image", "src": "/assets/…", "caption": { "zh": "", "en": "" } }  // → <figure>
```

Both editors (region and winery) have **＋ 文字段落** / **＋ 圖片** buttons, reorder and delete
controls for each block, and an image upload that compresses to WebP like the wine and banner
uploads. **上移 / 下移** at the bottom of a region or winery also reorder the entries themselves —
both hubs list them in array order — and **移除主要圖片** clears a lead photo (the button only
appears when there is one). Regions and wineries both take a lead image; a region with no photo
renders no figure rather than a broken one.
`introDraft` / `storyDraft` are a review flag only — the generator ignores them; clear the
checkbox once the client has approved the wording.

A winery with no wines yet renders the `noWinesYet` UI string instead of an empty grid.
Deleting a region or winery unlinks the wines that pointed at it, so no wine is left
referring to a slug that no longer exists.

---

## Project structure

```
.
├── catalog.json                 ← ALL CONTENT (single source of truth)
├── generate.mjs                 ← the generator
├── _templates/
│   ├── page.html                site shell with {{TOKENS}}
│   └── policy.html              policy page shell
├── admin.html                   editor UI (served at /admin, edge-gated)
├── netlify.toml                 build command, redirects, edge functions
├── netlify/edge-functions/
│   └── admin-gate.js            password gate
├── scripts/
│   └── serve.mjs                local dev server (caching disabled)
├── robots.txt                   static (not generated)
├── assets/
│   ├── app.js                   client behaviour
│   ├── hero.js                  homepage intro + banner
│   ├── style.css                site styles
│   ├── hero.css                 homepage hero styles (scoped under .hb-hero)
│   └── admin.js                 editor logic
├── product-images/              original source images
├── policies/                    policy source fragments
├── docs/DEPLOYMENT.md           operational reference
└── ── GENERATED (do not hand-edit) ──
    index.html · privacy.html · terms.html · shipping.html · quality.html
    sitemap.xml
    red-wine/ · white-wine/ · rose-wine/ · sparkling-wine/
    wine/                        ← 20 wine detail pages
    regions/ · region/<slug>/    ← the 3 region pages + the hub
    wineries/ · winery/<slug>/   ← the 5 winery pages + the hub
    en/                          ← the whole site again, in English
```

78 pages across 2 locales. `node generate.mjs` prints the count; every page is generated,
so never edit a generated file — edit `catalog.json` (content) or `generate.mjs` +
`_templates/` (markup).

---

## Gotchas worth knowing

These each cost real debugging time. Read before editing.

1. **`catalog.json` is the source; `index.html` is output.** Hand-editing generated pages loses
   your work on the next build. Change the catalog or a template.

2. **Always give assets a file extension.** Netlify serves an extensionless file as
   `Content-Type: text/plain` — a `200` that no browser renders as an image. When auditing
   assets, check `Content-Type`, not just the status code.

3. **The `t()` fallback cannot express a deliberately empty translation.** `en` falls back to
   `zh`, so an *intentionally empty* English value renders Chinese. Where word order or an empty
   part differs per language, use **one templated string per locale with a placeholder** (see
   `ui.creditTemplate`) rather than fragments.

4. **Scope CSS by prefix, or the site's own styles leak inward.** `assets/hero.css` is scoped
   under `.hb-hero`. Two traps: state classes on `<html>`/`<body>` (`.js`, `.gone`) must be
   prefixed *outside* the wrapper, and hidden/revealed state rules must keep **equal
   specificity** or the hidden state wins forever and content stays invisible.

5. **Internal links must carry the locale prefix.** `/en/` pages must link to `/en/…`. The
   generator's `p()` helper does this; a missing prefix silently sends English visitors to the
   Chinese page. Audit: collect every `href` on an EN page, flag any not starting with `/en/`.

6. **`grep` is unreliable for Chinese text** in some files — it returns nothing for strings that
   are definitely present. Use Python (`s.find(…)`) for CJK searches.

7. **Netlify's "Pretty URLs" rewrites `<a href="foo.html">` → `foo` at serve time** (only `<a>`
   tags, not `<link>`). The served markup therefore differs from the generated files — that is
   the CDN, not a bug. Inspect the generated file, not the response body.

8. **Never leave a top-level `addEventListener` on an element that might not exist.** A null
   deref at top level aborts the whole script, so `app.js` would silently stop wiring the
   inquiry list. Guard with `if (el)`, or remove the listener together with its markup.

9. **Run `node generate.mjs` before committing.** The build fails on an unfilled `{{TOKEN}}` by
   design, but a committed build failure is a broken deploy.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Page looks half-updated: new markup, stale behaviour | Browser cache. Use `scripts/serve.mjs` (no-store) and hard-refresh once |
| Wine grid empty / "catalogue failed to load" | `app.js` threw (a missing element id) — check the console. The `try/catch` reports *any* error in that block as a catalogue failure |
| An image 404s or renders as text | Wrong or missing file extension, or a reference that lost its extension |
| Regenerated page differs from the deployed one | Netlify Pretty URLs — compare against the generated file, not the response |
| Deploy didn't happen | Branch deploys are off; only pushes to `main` trigger a build |
| Admin shows a setup error | `PROTECTED_PAGE_PASSWORD` is not set in Netlify (owner action) |
| `/admin` is unreachable | The edge function must be deployed — drag-and-drop publishing does not include it |

---

## Docs

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — infrastructure, accounts, deploy + rollback
- [CONTRIBUTING.md](CONTRIBUTING.md) — conventions and the change workflow
- [SECURITY.md](SECURITY.md) — the admin password model and secret handling
- [CHANGELOG.md](CHANGELOG.md) — release history

---

Maintained by [Alpha Cool Tech](https://alphacooltech.com/zh/). MIT licensed — see [LICENSE](LICENSE).
