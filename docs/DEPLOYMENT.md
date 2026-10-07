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
runs `node generate.mjs`   ← renders 58 pages from catalog.json + _templates/
      │
      ▼
publishes the repo root (excluding .git, .env, .netlify — see .gitignore)
      │
      ▼
hongbon.tw is updated
```

Because the generator runs in CI as well, **the build and a local run produce identical
output** (it is idempotent). If you forget to run it locally, CI still produces the correct
pages — but commit the regenerated files anyway so the repo matches what is deployed.

### Verifying a deploy

```bash
# deploy state + the commit it built
netlify api listSiteDeploys \
  --data '{"site_id":"a9c26139-fbe7-412e-8034-cc340b8f89e7","per_page":1}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin)[0]; print(d['state'], str(d['commit_ref'])[:7], d.get('published_at'))"

# page types
for p in / /en/ /red-wine/ /en/red-wine/ /wine/red-wild-elegant/ /privacy.html /en/privacy.html; do
  printf '%-32s %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code}' "https://hongbon.tw$p?cb=$RANDOM")"
done
```

Sanity checks that have caught real problems:

```bash
# wine content actually in the HTML (not client-rendered)
curl -s https://hongbon.tw/ | grep -c '<article class="product'      # expect 20

# the sitemap
curl -s https://hongbon.tw/sitemap.xml | grep -c '<loc>'             # expect 58

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

Set at **Netlify → Site configuration → Environment variables**. If it is missing, the edge
function fails closed: `/admin` returns a "setup required" page and stays blocked — the public
site is unaffected.

Rotating the password: change the value in Netlify and redeploy. There is nothing to change in
the repository (see [SECURITY.md](../SECURITY.md)).

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
# one-time per clone — without it: "Could not find the project ID"
netlify link --id a9c26139-fbe7-412e-8034-cc340b8f89e7
netlify build      # runs the real build command and bundles the edge function
```

### Netlify "Pretty URLs" is enabled

Netlify rewrites `<a href="foo.html">` to `foo` **at serve time** (only `<a>` tags, not `<link>`),
re-serialising those attributes. The deployed markup therefore differs slightly from the
generated files. `/privacy` and `/privacy.html` both return 200 and the canonical points at the
`.html` form. **Do not "fix" a served-vs-generated mismatch — inspect the generated file.**

---

## Repository visibility

The repository is **public** at the time of writing. Nothing sensitive is in it — no secrets are
tracked, `.env` is git-ignored, and the admin password lives in Netlify, not in the repo. Making
it private is hygiene rather than an incident response.

**Before flipping it private, check the Netlify connection.** Netlify clones the repo to build;
if the site was connected while the repo was public, Netlify may not hold a deploy key, and a
private repo would then fail to build.

1. Note the last deploy ID and its state.
2. Make the repo private (owner only: *Settings → General → Danger Zone → Change visibility*).
3. Push a trivial commit (or use *Deploys → Trigger deploy*).
4. Confirm the new deploy reaches `ready`. If it fails with a clone/authentication error,
   Netlify → *Site configuration → Build & deploy → Repository* → **re-link the repository**, or
   add Netlify's deploy key under GitHub → *Settings → Deploy keys*.
5. If it cannot be resolved quickly, set the repo back to public to restore deploys, then fix
   the connection properly.

---

## What is deliberately public

`catalog.json` is served publicly because the browser fetches it. It contains product names,
descriptions and image paths — **no prices, no customer data, no credentials**. The admin
*routes* are password-protected; the catalogue itself is not confidential.
