## What changed

<!-- One paragraph: what this changes and why. Link an issue if there is one. -->

## Type

- [ ] Content change (catalogue, copy, contact details)
- [ ] Feature — new pages or functionality
- [ ] Fix
- [ ] Refactor / cleanup
- [ ] Documentation only

## Consequence for the visitor

<!-- What does someone see or experience differently? If a page's copy changed, say what it now says. -->

---

## Checklist

**Build**

- [ ] `node generate.mjs` runs without error (it fails loudly on an unfilled `{{TOKEN}}`)
- [ ] Generated pages are included in the commit (they are tracked on purpose)
- [ ] Ran `netlify build` if the change touches `netlify.toml` or the build

**Both locales**

- [ ] Checked `node scripts/serve.mjs` at `/` **and** `/en/`
- [ ] Any new string is in `catalog.json` → `ui` and translated — or deliberately relying on the
      Chinese fallback
- [ ] No string is hardcoded where a visitor can read it
- [ ] New internal links carry the locale prefix (`p()` in the generator, `{{PREFIX}}` in templates)

**Behaviour**

- [ ] No console errors in either locale
- [ ] Images load with the correct `Content-Type` (extensionless files are served as `text/plain`)
- [ ] The change does not remove an element `assets/app.js` looks up (`#openCart`, `#count`,
      `#menuToggle`, `#products`, …) — a missing id throws and aborts the script

**Hygiene**

- [ ] No secrets, keys or `.env` files included
- [ ] `git status` shows only intended files
- [ ] Commit message explains *why*, not just *what*

---

## Notes for the reviewer

<!-- Anything non-obvious: a platform quirk, a specificity fix, a decision you made and why. -->
