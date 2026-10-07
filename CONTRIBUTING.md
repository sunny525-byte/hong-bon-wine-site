# Contributing

Thanks for helping with the Hong Bon site. Read this before your first change — the content
model has a few rules that are easy to break by accident.

---

## Prerequisites

- **Node 20+** (CI runs Node 24)
- `git`
- Optional: the Netlify CLI (`npm i -g netlify-cli`) for `netlify build`

There are **no npm dependencies**. There is no `package.json`, no bundler, no framework. If you
find yourself wanting to add a dependency, reconsider — the site is intentionally dependency-free
so it keeps building years from now.

---

## Local setup

```bash
git clone https://github.com/sunny525-byte/hong-bon-wine-site.git
cd hong-bon-wine-site
node generate.mjs
node scripts/serve.mjs        # http://127.0.0.1:8931  (zh at /, English at /en/)
```

> **Do not preview with `python -m http.server`.** It sends no `Cache-Control`, so browsers
> heuristic-cache assets and will pair a stale `app.js` with your freshly-edited page. That
> failure looks exactly like a code bug. `scripts/serve.mjs` disables caching, and also mimics
> Netlify's pretty URLs (`/privacy`, `/red-wine`).

---

## Two workflows

### 1. Content changes → use the editor

Almost all content edits should go through **`/admin`** (the shared password is in
[SECURITY.md](SECURITY.md)). It exposes wines, categories, every UI string, policy copy,
contact details and the hero slides, each with Chinese and English side by side.

The editor cannot write to the server. **Publishing = Save → replace `catalog.json` → commit →
push.**

### 2. Code changes → edit the source

| To change | Edit |
|---|---|
| Page markup, layout, structure | `_templates/page.html`, `_templates/policy.html` |
| What the generator emits | `generate.mjs` |
| Styling | `assets/style.css` (site), `assets/hero.css` (homepage hero) |
| Client behaviour | `assets/app.js` |
| The editor | `admin.html`, `assets/admin.js` |
| Password gate | `netlify/edge-functions/admin-gate.js` |
| Build command, redirects | `netlify.toml` |

**Never hand-edit generated files** (`index.html`, `en/**`, `<category>/index.html`,
`wine/**`, `privacy.html`, `sitemap.xml`, …). They are overwritten by the next build. Change the
catalog or a template, then regenerate.

---

## Conventions

### Bilingual values

Every translatable string is an object: `{ "zh": "…", "en": "…" }`. Resolve it with `t()`:

```js
t(catalog.brand)        // {zh,en} -> the string for the current locale
t(w.name)               // works the same for wine fields
```

`t()` falls back `en → zh` (and `zh → en`), so **a missing translation renders the other
language** rather than an empty gap. That means English can be filled in gradually.

> ⚠️ **The fallback cannot express a deliberately empty translation.** If English should be
> empty or shorter, an empty `en` renders Chinese. In that case use **one templated string per
> locale with a placeholder** — see `ui.creditTemplate` (`由 {link} 開發` /
> `Developed by {link}`) and its use in `devCredit()`.

### No hardcoded UI text

Any string a visitor can read belongs in the `ui` block of `catalog.json`, so it is translatable
and client-editable. To add one:

1. `catalog.json` → `ui`: `"myKey": { "zh": "…", "en": "…" }`
2. Use it: `t(ui('myKey'))` in the generator, or `{{UI_MYKEY}}` in a template

The token form is `ui` + the key upper-cased, non-alphanumerics → `_`. The build **fails loudly**
on an unfilled token, so a mistake is caught before it ships.

Japanese/Chinese text hardcoded in `generate.mjs` is a bug — the only legitimate CJK there is
the flavour `match` terms and the `中文` switcher label.

### Locale-aware links

The site is published twice (`/` and `/en/`). **Every internal link must carry the locale
prefix.** In the generator use the `p()` helper:

```js
p('/wine/foo/')     // '/wine/foo/' in zh, '/en/wine/foo/' in en
```

In a template use `{{PREFIX}}` (e.g. `href="{{PREFIX}}/privacy.html"`).

Audit before pushing — collect every `href` on an EN page and flag anything not starting with
`/en/` (excluding `/assets/`, `/admin`, `#` and external URLs). A missing prefix silently sends
English visitors to the Chinese page.

### Assets must keep their file extension

Netlify serves an extensionless file as `Content-Type: text/plain` — a `200` no browser renders
as an image. When auditing assets, check **status *and* `Content-Type`**; a status-only check
passes on a broken image.

### Don't break the script

`assets/app.js` runs at the end of the body. A top-level `addEventListener` on an element that
does not exist throws and aborts everything after it — the inquiry list would silently stop
working. Guard with `if (el)`, or remove the listener together with its markup.

The same applies to the generator's assumptions: `render()` throws on an unfilled token, and the
catalog fetch failure path deliberately does **not** wipe the prerendered grid.

---

## Pre-commit checklist

```bash
node generate.mjs                 # must succeed; fails on an unfilled token
node scripts/serve.mjs            # open http://127.0.0.1:8931 and http://127.0.0.1:8931/en/
```

- [ ] Both locales render, and the language switcher goes to the right counterpart page
- [ ] No console errors (check both locales)
- [ ] Internal links stay in their own locale
- [ ] Any new string is in the `ui` block and translated (or deliberately falling back)
- [ ] Images load with the right `Content-Type`
- [ ] `git diff` contains no stray files; generated pages are included
- [ ] Commit message says **what changed and why**

Then push to `main` — that deploys (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)).

> Consider running `netlify build` too: branch deploys are disabled on this site, so there is no
> preview to catch a problem before production.

---

## Commit style

Short imperative subject, then a body that explains **why** — what was wrong, or what the change
enables. Mention consequences a future reader would otherwise have to rediscover (a platform
behaviour, a specificity fix, a fallback edge case).

```
Hide Netlify's injected "Powered by Netlify" badge

Netlify injects /.netlify/scripts/hud?variant=public into every HTML
response, which renders a fixed-position iframe in the bottom-right corner.
It is added at serve time and is not part of this repo, so it can only be
hidden from here.

!important is required because the iframe carries inline styles.
```

---

## Reporting problems

- **Security** → do not open a public issue; see [SECURITY.md](SECURITY.md)
- **Content corrections** → the client, or via `/admin`
- **Bugs** → a GitHub issue using the bug template
