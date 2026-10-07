# Security

## Reporting a vulnerability

Please **do not open a public issue** for a security problem. Contact the maintainer directly
(see the repository owner / [Alpha Cool Tech](https://alphacooltech.com/zh/)) with:

- what the issue is and where
- how to reproduce it
- the impact you believe it has

You will get an acknowledgement, and credit if you would like it.

---

## What protects what

| Surface | Protection |
|---|---|
| Public site (`/`, `/en/`, catalogue, policy pages, `catalog.json`) | **None, by design** — this is a public marketing/catalogue site |
| Admin editor (`/admin`, `/admin.html`) | A shared password, checked by a Netlify Edge Function |
| Repository | GitHub access control (currently public — see below) |
| Netlify settings, env vars, domains | The client's Netlify account |

### The admin password

`netlify/edge-functions/admin-gate.js` runs **before** the admin page is served. It:

- reads the password from the `PROTECTED_PAGE_PASSWORD` environment variable
- compares a digest of the submitted value against a digest of the expected value
- issues a cookie on success

Key properties:

- **The password is not in this repository.** It lives only in Netlify → *Site configuration →
  Environment variables* (scope: Functions). Nothing is hardcoded in the edge function.
- **It fails closed.** If the variable is unset, `/admin` returns a "setup required" page (503)
  and stays blocked. The public site is unaffected.
- **It is a single shared password, not per-user sign-in.** There are no accounts, no roles and
  no audit trail. Everyone with the password is indistinguishable.

### Rotating the password

1. Netlify → Site configuration → Environment variables → change `PROTECTED_PAGE_PASSWORD`
2. Redeploy (any push to `main`, or *Deploys → Trigger deploy*)
3. Share the new password out of band

Nothing in the repository needs to change, and no existing session or token survives that
matters — cookies are re-validated by the edge function.

### Limitations worth understanding

- **The admin has no server-side write.** It only produces a downloadable `catalog.json`; a human
  must commit it. An attacker with the password can read the data they could already read
  publicly, and produce a file nobody has to accept.
- **The admin is not rate-limited beyond Netlify's platform defaults.** A shared password is
  brute-forceable in principle; use a long random value.
- **`catalog.json` is public.** The browser fetches it to render the catalogue. It holds product
  names, descriptions and image paths — never put prices, customer data or credentials in it.

---

## Secrets in the repository

There are none, and there should never be any. Verified as part of every change:

```bash
# nothing secret-like is tracked
git ls-files | grep -iE 'env|secret|key|pem|credential|password|token'

# .env is ignored
git check-ignore -v .env
```

`.gitignore` excludes `.env`, `.env.*`, `.netlify` and `*.zip`. The Netlify build also respects
`.gitignore`, which is why `https://hongbon.tw/.env` and `/.git/config` both return **404** —
worth re-checking after any change to build configuration:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://hongbon.tw/.env          # expect 404
curl -s -o /dev/null -w '%{http_code}\n' https://hongbon.tw/.git/config   # expect 404
```

If you ever commit a secret: **rotate it first, then remove it from history.** Deleting the file
in a later commit does not undo the exposure.

---

## Repository visibility

The repository is currently **public**. Nothing sensitive is in it (see above), so this is a
hygiene matter rather than an exposure. If it is made private, verify that Netlify can still
clone it — the site builds from this repo, and a repo connected while public may not have a
deploy key. [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#repository-visibility) has the procedure.

---

## Client data

The site collects **no** personal data: no accounts, no analytics, no cookies beyond the admin
gate's own session cookie, and no server-side storage. Enquiries happen on LINE or by email and
never touch this infrastructure — which keeps the site out of scope for most data-protection
obligations. If that ever changes (analytics, a form endpoint, a newsletter), revisit the privacy
policy at `catalog.json` → `pages[]` and this document together.
