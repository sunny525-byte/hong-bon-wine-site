# Deployment & operations

Operational reference for the Hong Bon site. For the day-to-day workflow see the
[README](../README.md); this file covers infrastructure, accounts and recovery.

---

## TL;DR

```bash
# deploy
git push origin main          # Netlify builds and publishes

# verify
netlify api listSiteDeploys \
  --data '{"site_id":"a9c26139-fbe7-412e-8034-cc340b8f89e7","per_page":1}'

# check the live site (cache-bust: an edge node can serve the previous asset for ~1 min)
curl -s -o /dev/null -w '%{http_code}\n' "https://hongbon.tw/?cb=$RANDOM"
```

---

## Infrastructure

| | |
|---|---|
| **Repository** | `sunny525-byte/hong-bon-wine-site` (branch `main`) |
| **Hosting** | Netlify |
| **Netlify project** | `hongbon` |
| **Site ID** | `a9c26139-fbe7-412e-8034-cc340b8f89e7` |
| **Production domain** | `https://hongbon.tw` |
| **Legacy host** | `hongbon.netlify.app` → 301 → `hongbon.tw` |
| **Build command** | `node generate.mjs` |
| **Publish directory** | `.` (repository root) |
| **Edge function** | `netlify/edge-functions/admin-gate.js` |
| **Required env var** | `PROTECTED_PAGE_PASSWORD` (scope: Functions) |
| **CI Node** | v24.21.0 |

There is **no database, no server and no API**. The site is static files plus one edge
function. Nothing to scale, nothing to restart, nothing to back up beyond git.

### DNS

`hongbon.tw` resolves to Netlify. The legacy `hongbon.netlify.app` host is redirected by
`netlify.toml`:

```toml
[[redirects]]
  from = "https://hongbon.netlify.app/*"
  to = "https://hongbon.tw/:splat"
  status = 301
  force = true
```

The rule matches that host only, so deploy previews (`deploy-preview-N--hongbon.netlify.app`)
would be unaffected if they were ever enabled.

---

## The deploy flow

```
git push origin main
      │
      ▼
Netlify detects the push
      │
      ▼
runs `node generate.mjs`   ← renders 78 pages from catalog.json + _templates/
      │
      ▼
publishes the repo root (excluding .git, .env, .netlify — see .gitignore)
      │
      ▼
hongbon.tw is updated
```

Because the generator runs in CI as well, **the build and a local run produce identical
output** (it is idempotent). The generated pages are **not committed** — they are git-ignored and
the build owns them — so running the generator locally is only for previewing. A client publish
therefore cannot leave the repository describing a different site from the live one.

### Verifying a deploy

**Probe the live site** — this always works and is the check that matters:

```bash
curl -s -o /dev/null -w '%{http_code}\n' "https://hongbon.tw/?cb=$RANDOM"
```

If your Netlify account has access to the site, you can also read the deploy record
(the CLI accounts here may not — it can return `Not Found`):

```bash
# deploy state + the commit it built
netlify api listSiteDeploys \
  --data '{"site_id":"a9c26139-fbe7-412e-8034-cc340b8f89e7","per_page":1}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin)[0]; print(d['state'], str(d['commit_ref'])[:7], d.get('published_at'))"

# page types
for p in / /en/ /red-wine/ /en/red-wine/ /wine/red-wild-elegant/ /privacy.html /en/privacy.html \
         /regions/ /wineries/ /region/mosel/ /winery/maring-prigge/ \
         /en/regions/ /en/wineries/ /en/region/mosel/ /en/winery/maring-prigge/; do
  printf '%-34s %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code}' "https://hongbon.tw$p?cb=$RANDOM")"
done
```

Sanity checks that have caught real problems:

```bash
# wine content actually in the HTML (not client-rendered)
curl -s https://hongbon.tw/ | grep -c '<article class="product'      # expect 20

# region and winery pages list their wines too, in both locales
curl -s https://hongbon.tw/region/mosel/ | grep -c '<article class="product'   # expect 8
curl -s https://hongbon.tw/winery/schwarz/ | grep -c '<article class="product' # expect 7
# a winery with no wines says so rather than rendering nothing
curl -s https://hongbon.tw/winery/le-pin-d-ambert/ | grep -c 'class="empty"'

# the sitemap
curl -s https://hongbon.tw/sitemap.xml | grep -c '<loc>'             # expect 78

# secrets must never be served
curl -s -o /dev/null -w '%{http_code}\n' https://hongbon.tw/.env     # expect 404
curl -s -o /dev/null -w '%{http_code}\n' https://hongbon.tw/.git/config   # expect 404
```

---

## Rollback

**Preferred — revert the commit:**

```bash
git revert <bad-commit>
git push origin main          # Netlify rebuilds from the reverted state
```

**Immediate — republish a previous deploy** (no git involved, takes effect in seconds):
Netlify → *Deploys* → pick the last good deploy → **Publish deploy**.

Either way the site is static, so a rollback cannot leave partial state.

**If a build fails**, Netlify does **not** publish and the previous deploy stays live — the site
does not go down. Check the build log, fix, push again.

---

## Environment variables

| Variable | Scope | Purpose |
|---|---|---|
| `PROTECTED_PAGE_PASSWORD` | Functions | The shared password for `/admin` |
| `GITHUB_TOKEN` | Functions | Lets the editor publish (see below) |
| `GITHUB_REPO` | Functions | `sunny525-byte/hong-bon-wine-site` |
| `GITHUB_BRANCH` | Functions | Optional, defaults to `main` |
| `DRY_RUN` | Functions | Optional. `1` makes publish validate and report without writing |
| `PRUNE_UPLOADS` | Functions | Optional. `0` stops publish deleting unreferenced uploads |

Set at **Netlify → Site configuration → Environment variables**. If `PROTECTED_PAGE_PASSWORD` is
missing, the edge function fails closed: `/admin` returns a "setup required" page and stays
blocked — the public site is unaffected.

Rotating the password: change the value in Netlify and redeploy. There is nothing to change in
the repository (see [SECURITY.md](../SECURITY.md)).

### Publishing — `GITHUB_TOKEN`

The editor publishes by committing to this repository through the GitHub API, so it needs a token
with **write** access. Without it the editor still works, but can only export a file for a
developer to commit.

**Create it from the account that OWNS the repo.** A fine-grained token cannot be scoped to someone
else's personal repository — a collaborator will not find it in the picker.

1. GitHub → avatar → **Settings** → **Developer settings** → **Personal access tokens** →
   **Fine-grained tokens** → **Generate new token**
2. **Expiration: No expiration** — that is what makes this a one-time setup. (If the account is
   covered by an organisation token-lifetime policy, the option may be capped.)
3. **Repository access → Only select repositories** → `hong-bon-wine-site` **only**
4. **Repository permissions → Contents → Read and write.** Nothing else. (`Metadata: Read` is
   added automatically and is required.)
5. Generate, copy, and paste it into `GITHUB_TOKEN` in Netlify
6. **Redeploy.** Functions read environment variables at deploy time — without a new deploy the
   editor keeps reporting that publishing is not configured.

A fine-grained token is used rather than a classic `repo`-scoped one on purpose: the token sits in
this project's environment variables, where anyone with access to the project can read it, and a
classic token would grant write access to **every** repository the owner has.

Rules for it: paste it only into Netlify's env var field — never into a chat, an issue, or a file
in the repo (repo history is permanent). If it is ever exposed, **create the replacement first**,
update Netlify, redeploy, *then* revoke the old one, so publishing never has a gap. GitHub removes
tokens unused for a year; this one is used on every publish.

**What a publish commits.** Only the source: `catalog.json`, plus one file per newly uploaded
photo (`assets/upload-<hash>.webp`) and **deletions** for uploads nothing points at any more.

The pruning matters because a photo that stops being referenced — replaced, or the wine using it
deleted — would otherwise stay in the repository and keep being served publicly forever. Content
addressed names make the rule exact: an `assets/upload-*` file is garbage if no path in the
published catalogue mentions it. The deletion rides in the same commit, and is skipped (rather
than guessed at) if GitHub truncates the file listing.

Verify with:

```bash
curl -s https://hongbon.tw/api/publish | head -c 300     # {"configured":true,…} when signed in
```

Unauthenticated it returns `401`, which is the expected answer — it is not a public endpoint.

---

## ⚠️ Account access — who can change what

The Netlify site belongs to the **client's Netlify account** (team `hongbon-t-c`), not to the
development accounts. The practical consequences:

| Need | Who can do it |
|---|---|
| Deploy (push to `main`) | **Anyone with repo write access** — no Netlify login needed |
| Change env vars, domains, build settings | **The Netlify account owner only** |
| Read deploy status via the API | Works with an explicit site ID (`netlify api getSite`); listing the site among "your sites" does not |
| Deploy from the CLI (`netlify deploy`) | **Not available** — the CLI accounts cannot see this site; it fails with `Not Found`. Use the git flow |

If a task requires Netlify settings (a new env var, a domain change, turning on deploy
previews), it must be done by the account owner or the client.

### Branch deploys are disabled

Only `main` builds. Pushing a branch creates **no** deploy preview — verify on production is not
possible. Use `netlify build` locally before pushing:

```bash
# optional — requires your Netlify account to have access to the site.
# No access ⇒ "Project id … not found"; skip it and use `node generate.mjs`.
netlify link --id a9c26139-fbe7-412e-8034-cc340b8f89e7
netlify build      # runs the real build command and bundles the edge function
```

### Netlify "Pretty URLs" is enabled

Netlify rewrites `<a href="foo.html">` to `foo` **at serve time** (only `<a>` tags, not `<link>`),
re-serialising those attributes. The deployed markup therefore differs slightly from the
generated files. `/privacy` and `/privacy.html` both return 200 and the canonical points at the
`.html` form. **Do not "fix" a served-vs-generated mismatch — inspect the generated file.**

---

## Repository visibility — keep it public on this plan

**The repository is public, and that is load-bearing.** The site's plan allows **only one
contributor on private repositories**, and the recognised contributor is the client's own Git
account. So while the repo is private, a push authored by anyone else is refused *before the build
starts*:

> Build blocked: Unrecognized Git contributor. This plan allows only verified account members to
> push to private repos

This is not hypothetical: the repo was made private on 2026-10-08 and **four consecutive deploys
were blocked this way** (`8b76040`, `626811f`, `8748951`, `66a6bf5`), leaving production on
`6b97908` for five days. Setting the repo back to public fixed it.

It is easy to misread, because nothing looks broken — there is no failing build with a log, just
the absence of a new published deploy. If a push seems to do nothing, open *Deploys* and read the
banner before debugging the build itself.

Nothing sensitive is tracked here: no secrets, `.env` is git-ignored, and the admin password and
the GitHub token live in Netlify's environment variables. Everything the site serves —
`catalog.json`, every page, `assets/admin.js` — is already public at hongbon.tw, so a public repo
adds only `docs/`, `_templates/`, `admin.html`'s source and the two function sources.

If it ever has to be private, in order of reliability:

1. **Upgrade to Pro** — lifts the contributor limit.
2. **Link the Git account** under Netlify → *manage Git contributors* (what the banner suggests).
3. **Have the client push** — a commit authored by their account is recognised, and it builds the
   whole branch, so it unblocks things as a one-off.
4. **Re-link the repository** (Netlify → *Site configuration → Build & deploy → Repository*) if the
   failure is a clone/authentication error rather than the contributor banner. Netlify clones with
   the deploy key at GitHub → *Settings → Deploy keys*; a repo connected while public has one, but
   it is worth confirming.

---

## What is deliberately public

`catalog.json` is served publicly because the browser fetches it. It contains product names,
descriptions and image paths — **no prices, no customer data, no credentials**. The admin
*routes* are password-protected; the catalogue itself is not confidential.
