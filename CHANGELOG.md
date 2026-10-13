# Changelog

All notable changes to the Hong Bon site.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Versioning note: the site has no runtime version — releases are tracked here and by deploy. A
**major** bump means the content model or URLs changed, **minor** means new pages or features,
**patch** means fixes and copy.

---

## [1.1.0] — 2026-10-11

Region and winery pages, so the catalogue can be browsed by where a wine comes from and who
made it — plus the editor fields to maintain them.

> **Not yet deployed.** The Netlify account is out of credits, so production is still on the
> 1.0.0 build. Everything below is verified locally (`node generate.mjs`, `scripts/serve.mjs`,
> a headless-browser pass, and the editor round-trip) but has never been served from Netlify.

### Added

- **Region pages** at `/region/<slug>/` and a `/regions/` hub — 3 regions (Mosel, Bordeaux,
  Barossa Valley) × 2 locales.
- **Winery pages** at `/winery/<slug>/` and a `/wineries/` hub — 5 producers × 2 locales. Each
  winery page links to its region and, where there is one, its own website, and lists that
  winery's wines.
- **Content blocks** (`body[]`) — an ordered list of text paragraphs and images with bilingual
  captions, so a region or winery page can carry more than a lead paragraph without a PDF.
- **Region and winery editors** in `admin.html` / `assets/admin.js`: bilingual name, intro/story,
  country, slug, website, lead image with the same WebP-compressing upload the wines use, a
  repeatable block editor (add text / add image, reorder, delete), and a **草稿** review checkbox
  that records the drafted copy as unapproved.
- **產區 / 酒莊 selects on every wine** — the link between a wine and its region/winery is now
  editable, instead of having to hand-edit JSON.
- **Hub card lists** (`.card-list`) — 3 across, 2 on tablet, 1 on phone, matching the wine grid.
- A winery with no wines yet says so (`noWinesYet`) instead of rendering an empty grid.
- 10 new sitemap paths with `hreflang` alternates; 12 new `ui` strings for the chrome.
- 17 winery photographs, converted to WebP (4.2 MB → 2.75 MB).
- **The editor publishes.** `netlify/functions/publish.mjs` commits the catalogue to this
  repository through the GitHub API, so the owner's one click reaches production by the same path
  as any code change — and `git revert` undoes it. It carries a revision guard (a stale page
  cannot overwrite a newer publish), a `DRY_RUN` mode for validating without writing, and the
  download-to-a-file behaviour as a `下載備份` fallback.
- **Uploaded photos are stored as files.** The editor hands over a base64 `data:` URI; the
  function writes `assets/upload-<hash>.webp` and rewrites the field to point at it, committing the
  image and the catalogue in a single commit so only one build runs. Before this, an uploaded
  photo was inlined into every page showing that wine — one measured 146 KB photo added 195 KB to
  24 pages and took `index.html` from 51 KB to 245 KB.
- `assets/placeholder.svg`, used by a wine that has no photo yet.
- **Reordering** for regions and wineries (**上移 / 下移**), which the hubs list in array order —
  previously the only way to change it was hand-editing JSON.
- **移除主要圖片** — a control to clear a lead photo, shown only when there is one. Clearing the
  URL field used to leave the old preview on screen, looking like the edit had failed.
- **Regions take a lead image**, like wineries already did; a region with no photo renders no
  figure.
- **產區與酒莊** (13 strings) and **語言切換** (4) groups in 網站文字, so the region/winery chrome
  and the language switcher are no longer buried in 其他文字.
- The language switcher labels come from the catalogue. `generate.mjs` now contains **no** CJK
  literal — the last one was the switcher's `中文`. Its accessible name is a separate, per-locale
  string (「切換到英文」/ "Switch to Chinese"), where it previously read "English" on the Chinese
  pages and just `中文` on the English ones.

### Changed

- The collection section is now a single `{{COLLECTION_SECTION}}` token, so hub pages can render
  a link list where the other pages render the wine grid. Verified byte-for-byte on all 50
  pre-existing pages: the only change to them is the two footer nav links.
- Footer nav and mobile menu link to 產區 and 合作酒莊, ahead of the policy links.
- `docs/DEPLOYMENT.md`, `README.md` (content model + structure) and `CONTRIBUTING.md` document the
  new page types and the block model.

### Fixed

- **Hub pages rendered no list at all.** The `kind === 'hub'` branch replaced the whole
  collection section, discarding the card list passed into it.
- **`/admin` requested a favicon that does not exist** (404 in the console on every load) because
  `admin.html` never declared one. It now declares the same icons as the rest of the site.
- A dangling `class="line-link"` on the winery website link — nothing styles it.
- **Publishing would have failed for everybody.** The `/admin` gate puts
  `base64(sha256(password))` in its cookie, but the publish function compared that against a
  **hex** digest — so every authorised request looked like "not signed in", however correct the
  token was. Found by the endpoint tests, not in production.
- **A new wine pointed at `/wine-editorial.png`**, a file that exists in no revision. Publishing
  one put a broken image on the live homepage and in the admin's own preview.
- **A new wine defaulted to 未上架**, and hidden wines are dropped from every page by the build, so
  a correctly published product was invisible until the owner spotted the checkbox. New wines are
  now on sale and use the placeholder photo, with 上架 still there to hide one.
- The button reading 「儲存並更新網站」 only ever downloaded a file, while claiming to update the
  site. It is now 「發佈到網站」, and the header copy describes what actually happens.

### Security

- `robots.txt` disallows `/admin` and `/admin.html`, and `netlify.toml` blocks the internal
  sources (`/docs/*`, `/scripts/*`, `/_templates/*`, `/netlify/*`, `/policies/*`,
  `/product-images/*`, `generate.mjs`, and the root Markdown files) with forced 404s — a
  redirect is skipped whenever a static file matches the path, so `force = true` is required.
- `.env.example` records the optional `PROTECTED_PAGE_PASSWORD`; no secret is committed.

---

## [1.0.0] — 2026-10-07

The release that replaced the hand-written draft with a bilingual generated site.

### Added

- **Static site generator** (`generate.mjs`) — prerenders every page from `catalog.json` plus
  `_templates/`. Zero dependencies; runs in CI via `netlify.toml`.
- **English locale** at `/en/` with `hreflang` alternates in the head and in `sitemap.xml`, a
  language switcher in the header, and locale-aware internal links.
- **Wine detail pages** at `/wine/<slug>/` — 20 pages with their own title, canonical, breadcrumb,
  `Product` structured data and per-wine social image.
- **Indexable category pages** at `/red-wine/`, `/white-wine/`, `/rose-wine/`,
  `/sparkling-wine/`. Previously the catalogue was rendered in the browser, so the served HTML
  contained no wine content and nothing could be indexed.
- **Generated policy pages** (privacy, terms, shipping, quality) in both locales.
- **Sticky category bar** — the filters stay reachable while browsing.
- **LINE call-to-action band** between the hero and the catalogue.
- **Social links** (Instagram, Facebook) rendered from the catalogue.
- **Footer developer credit** — "Developed by Alpha Cool Tech", linking to alphacooltech.com.
- **Admin "網站文字" section** — roughly 145 interface strings as paired Chinese/English inputs,
  grouped into collapsible sections, so all chrome copy is reviewable and editable without code.
- **`scripts/serve.mjs`** — a local preview server with caching disabled, which also mirrors
  Netlify's pretty URLs.
- **Project documentation** — this changelog, `CONTRIBUTING.md`, `SECURITY.md` and
  `docs/DEPLOYMENT.md`.

### Changed

- **`catalog.json` is now version 2.** Every translatable value is `{zh, en}`, with English
  falling back to Chinese until translated. Added `categories[]`, `pages[]`, `flavors[]`,
  `wines[].slug` and a `ui{}` block of interface strings.
- **`index.html` is generated output.** The source is `_templates/page.html`; the page shell is
  no longer hand-maintained.
- **Category filters are real links** to the category pages, replacing in-memory client-side
  filtering. `app.js` lost its card renderer, flavour logic and filter state (~2.2 KB smaller).
- **Footer contact details** (address, phone, map link, payment methods) render from the
  catalogue instead of being hardcoded, and the payment separator is locale-aware.
- **Flavour chips** moved out of the generator into `catalog.json`, so labels are editable and
  match both languages.
- The search bar was **removed** at the client's request, along with its styles and its
  top-level event listener.
- Generated pages **are committed**, so the repository stays previewable without a build and a
  failed build cannot leave git without a complete site.

### Fixed

- **25 image references had lost their file extension** — 21 returned 404 and 4 were served as
  `Content-Type: text/plain`, so browsers would not render them. Regression from an earlier
  WebP-conversion commit that renamed the files but not the references.
- **Canonical, Open Graph, sitemap and robots all named `hongbon.netlify.app`** instead of
  `hongbon.tw`, while the duplicate host served 200 with no redirect — search engines could
  prefer the wrong domain. Corrected in 7 files and a 301 was added for the legacy host.
- **Homepage hero disappeared on rebuild** — the generator replaced the span between the hero
  markers instead of preserving it, which also removed the cart and menu elements the client
  script depends on.
- **The hero entrance animation never completed.** Scoping the hero stylesheet inverted the
  specificity of the hidden/revealed state rules, so content stayed at `opacity: 0`. The
  homepage appeared to load with only the carousel visible.
- **Internal links on `/en/` pointed at the Chinese tree** — cards, filters, breadcrumbs, logo
  and home all sent English visitors to Chinese pages.
- **Category pages reverted to the homepage title**, because the client script overwrote
  `document.title` after the generator had set a per-page one.
- **Netlify's injected "Powered by Netlify" badge** is hidden from the stylesheet. It is added at
  serve time by `/.netlify/scripts/hud`, so it cannot be removed from this repository.
- The English hero read "the one**you love**" (a lost trailing space), the English payment list
  used a Chinese enumeration comma, and the policy `<h1>` repeated the brand name.

### Security

- Confirmed no secrets are tracked, `.env` is ignored, and `https://hongbon.tw/.env` plus
  `/.git/config` both return 404 — i.e. the Netlify build respects `.gitignore`.
- The admin password is read from `PROTECTED_PAGE_PASSWORD` at runtime and is **not** in the
  repository; the gate fails closed when the variable is unset.

---

## [0.1.0] — 2026-09-24 … 2026-09-29

The initial static draft, before the generator existed.

- Hand-written HTML site with a browser-rendered catalogue, `admin.html` editor gated by a
  Netlify Edge Function, and `catalog.json` as the content file.
- WebP image conversion, filter glass icons, dynamic storefront effects, logo and inquiry form,
  mobile menu, SEO basics, and the privacy / terms / shipping / quality starter pages.

[1.0.0]: https://github.com/sunny525-byte/hong-bon-wine-site/commits/main
