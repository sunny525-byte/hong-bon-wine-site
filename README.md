# HONG BON wine inquiry site

Static Netlify-ready draft cloned from the supplied saved site. Deploy this folder as a new Netlify site.

## Important content status

- The supplied HTML identifies its 20-item catalogue as a demo. Product availability and formal listing status are unconfirmed.
- Product photos in `product-images/` are preserved original PNGs. Exact label matches are used where readable; unmatched wines retain their source demo artwork.
- The admin page is protected by a Netlify Edge Function using one shared password. In Netlify, set `PROTECTED_PAGE_PASSWORD` under Site configuration → Environment variables, then deploy. The admin route fails closed until configured. This is not per-user sign-in.
- The storefront's `catalog.json` is public because the live site fetches it to display products. The admin password protects the editor route, not catalogue confidentiality.
- Admin changes export an edited `catalog.json`; replace the deployed file and redeploy to publish. Selected image uploads are embedded in that JSON export (up to 5 MB each), so the exported catalogue can grow substantially.
- The included privacy, terms, shipping, and quality pages are starter copy and should be reviewed for the business's actual policies.

## Deploy

Create a new Netlify site and deploy this folder (or connect a new Git repository containing these files). This does not affect the original published site.

To deploy the Edge Function login, use Git-based deployment or Netlify CLI 12.2.8 or later from this project folder. Drag-and-drop publishing of static files does not deploy the Edge Function. After connecting the GitHub repository, open Site configuration → Environment variables, add `PROTECTED_PAGE_PASSWORD` with Functions scope, and redeploy. If the variable is missing, the admin route returns a setup error and stays blocked. The storefront remains public.
