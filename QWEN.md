# Working on this project

**Read this before changing or deploying anything.** It is short; the long-form detail is in
[README.md](README.md) (content model), [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) (deploy + ops)
and [CONTRIBUTING.md](CONTRIBUTING.md) (checklist).

Static, generated, bilingual (zh-TW / en) site for a wine importer. No framework, no
dependencies, no server: `node generate.mjs` renders HTML from `catalog.json` + `_templates/`,
and Netlify publishes the repository root. Content is maintained by the client through `/admin`.

---

## The five rules that matter

1. **Keep the repository PUBLIC.** The site's plan allows **one** contributor on private
   repositories, and that is the client's Git account. While the repo is private, a push from
   anyone else is refused *before the build starts*:

   > Build blocked: Unrecognized Git contributor. This plan allows only verified account
   > members to push to private repos

   There is **no failed build and no log** — just no new published deploy, so a push looks like
   it did nothing. This cost five days of silent staleness (2026-10-08 → 10-13), misdiagnosed
   as a billing problem. **If a push seems to do nothing, read the Netlify Deploys banner
   before debugging anything else.**

2. **`git push origin main` IS the deploy.** The site is git-linked and there is no CLI deploy
   path. Branch deploys are disabled, so main is the only route — there are no deploy previews
   to test on.

3. **Environment-variable changes need a redeploy.** Functions bake their environment at deploy
   time, so saving a variable does nothing until a new deploy runs. A function reporting
   "not configured" is usually a stale environment, not a missing variable. (`netlify env:list`
   returns an empty set here even for variables that exist — read the Netlify UI instead.)

4. **The Netlify CLI on this machine is read-only for this site.** It can read the site and its
   deploy history, but cannot trigger a build or write configuration (`updateSite` →
   `Unauthorized`). To rebuild with no code change, push an empty commit.

5. **`netlify build` cannot run here.** It needs live site data and fails with
   `Failed retrieving site data … Not Found` — that is about access, never about your change.
   The build command is literally `node generate.mjs`.

## Making a change

`catalog.json` is the single source of truth. `generate.mjs` writes the whole site — currently
**84 pages** (42 paths × 2 locales) plus `sitemap.xml`. **Never hand-edit a generated file, and
never commit one**: the output is git-ignored and the Netlify build owns it. The repository holds
only sources — `catalog.json`, `generate.mjs`, `_templates/`, `assets/`, `admin.html`.

```bash
# 1. edit catalog.json (content) and/or generate.mjs + _templates/ (markup)
node generate.mjs                  # the whole site — run twice; output must be byte-identical
node scripts/serve.mjs 8931 .      # no-cache preview (python -m http.server serves stale JS)
# 2. if generate.mjs or a template changed, prove the pages you did NOT mean to touch are
#    unchanged: generate the OLD revision in a temp dir (`git archive <old> | tar -x`) and diff
#    it against the working tree — a generator change rewrites every page
git add -A && git commit && git push origin main
```

Content-only changes can also be made by the client in `/admin`, which publishes through
`netlify/functions/publish.mjs` — see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

**A client publish needs no follow-up.** Publishing commits `catalog.json` (and any new photos)
and the build regenerates the pages, so there is no resync step and no way for the repository to
claim something different from what is live.

## Getting it wrong is easy

- `t()`'s bilingual fallback **cannot express a deliberately empty translation** — use one
  templated string with a `{placeholder}`, never prefix/suffix fragments.
- Hidden wines (`status:"hidden"` **or** `active:false`) are dropped from **every** page.
- A count that looks one short is usually the `featured` card (`class="product featured"`),
  not a missing wine.
- **`grep` is unreliable for CJK** — use Python `s.find()`.
- Those 404 rules in `netlify.toml` need `force = true` (a redirect is skipped whenever a static
  file matches the path) and a trailing splat is terminal, so enumerate files rather than
  writing `/*.md`.
- Netlify "Pretty URLs" rewrites `<a href="foo.html">` → `foo` at serve time: served markup
  legitimately differs from the generated file.

## Verifying a deploy

```bash
curl -s "https://hongbon.tw/robots.txt?cb=$RANDOM" | grep -c Disallow              # 2
curl -s -o /dev/null -w '%{http_code}\n' "https://hongbon.tw/regions/?cb=$RANDOM"  # 200
curl -s "https://hongbon.tw/sitemap.xml?cb=$RANDOM" | grep -c '<loc>'              # 78
curl -s -o /dev/null -w '%{http_code}\n' "https://hongbon.tw/api/publish?cb=$RANDOM"  # 401
shasum assets/admin.js        # must match the live https://hongbon.tw/assets/admin.js
```

Cache-bust every request: an edge node can serve the previous asset for ~1 minute. Netlify also
injects `/.netlify/scripts/hud` (the badge loader we hide with CSS) which Chrome aborts — that is
expected, not a defect.
