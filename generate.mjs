// Prerender generator for the Hong Bon site.
//
// The site shipped as hand-maintained HTML with the wine grid rendered in the
// browser, so the served HTML contained no wine content and category pages could
// not be indexed. This reads catalog.json and writes real HTML pages:
//
//   index.html              all wines, hero + intro (the homepage)
//   <slug>/index.html       one per category, prerendered and indexable
//   sitemap.xml             every page
//
// The wine-card markup lives here and ONLY here: filters are real links, so the
// browser never renders cards and app.js no longer needs render()/FLAVORS.
// Run via `netlify build` (netlify.toml build.command) or `node generate.mjs`.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'https://hongbon.tw';
// Locale is module-level state set per render pass. This is a sequential
// build script, so mutating it is simpler than threading a locale argument
// through every helper (t, card, filters, pageHead, winePage, jsonld).
let LOCALE = 'zh';
let CURRENT_PATH = '/';

const LOCALES = [
  { code: 'zh', lang: 'zh-Hant', prefix: '',    switchLabel: '中文' },
  { code: 'en', lang: 'en',      prefix: '/en', switchLabel: 'EN' },
];

const catalog = JSON.parse(readFileSync(join(ROOT, 'catalog.json'), 'utf8'));
const template = readFileSync(join(ROOT, '_templates', 'page.html'), 'utf8');

// ---------------------------------------------------------------- helpers
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// {zh,en} -> string, falling back to the other language; plain strings pass through
const t = v => (v && typeof v === 'object')
  ? (LOCALE === 'en' ? (v.en || v.zh || '') : (v.zh || v.en || ''))
  : (v == null ? '' : String(v));

// flavour chips — ported from app.js so the prerendered cards match
// Flavour labels + match terms come from catalog.json, so the client can edit
// them. Each `match` list holds both languages, so one table serves either locale.
const flavorsOf = w => {
  const hay = t(w.desc) + t(w.taste);
  return (catalog.flavors || []).filter(f => (f.match || []).some(k => hay.includes(k)))
    .map(f => t(f));
};

const flavorChips = w => {
  const f = flavorsOf(w);
  return f.length ? `<div class="flavors">${f.map(x => `<span class="flavor">${esc(x)}</span>`).join('')}</div>` : '';
};

// wine card — must match the structure app.js used to produce
function card(w, index) {
  const n = String(index + 1).padStart(2, '0');
  const name = esc(t(w.name));
  const href = w.slug ? p(`/wine/${w.slug}/`) : null;   // no slug -> no link, never a 404
  const open = href ? `<a class="product-link" href="${href}">` : '<span>';
  const close = href ? '</a>' : '</span>';
  return `<article class="product${w.featured ? ' featured' : ''}">`
    + `<div class="product-art">${open}<img src="${esc(w.image)}" alt="${name}${esc(t(ui('imageAltSuffix')))}" style="object-position:50% center" loading="lazy">${close}`
    + `<span class="tag">${n}</span>${w.featured ? `<span class="featured-ribbon">${esc(t(ui('featuredBadge')))}</span>` : ''}</div>`
    + `<div class="product-body">`
    + `<span class="type mobile-summary" id="wine-type-${w.id}">${esc(t(w.en))}</span>`
    + `<h3 class="mobile-summary" id="wine-name-${w.id}">${href ? `<a href="${href}">${name}</a>` : name}</h3>`
    + `<p class="mobile-summary" id="wine-desc-${w.id}">${esc(t(w.desc))}</p>`
    + `<div class="tastes mobile-summary" id="wine-taste-${w.id}">${esc(t(w.taste))}</div>`
    + flavorChips(w)
    + `<button type="button" class="wine-expand" data-expand aria-expanded="false" aria-controls="wine-type-${w.id} wine-name-${w.id} wine-desc-${w.id} wine-taste-${w.id}" aria-label="${esc(fill(t(ui('ariaExpandWine')), { name: t(w.name) }))}" hidden>${esc(t(ui('expandMore')))}</button>`
    + `<div class="product-bottom"><span>${esc(t(ui('cardCtaLabel')))}</span><button class="add" data-add="${w.id}" aria-label="${esc(fill(t(ui('ariaAddToInquiry')), { name: t(w.name) }))}">${esc(t(ui('addToInquiry')))}</button></div>`
    + `</div></article>`;
}

const glass = type => `<svg class="glass glass-${type}" viewBox="0 0 24 24" aria-hidden="true">`
  + `<path d="M8 3h8l-1 6a3 3 0 0 1-6 0L8 3z" fill="currentColor"/>`
  + `<path d="M12 12v6M9 19h6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`;

// filters are links now, so each category is a real, shareable, indexable URL.
// The {{FILTERS}} token replaces the whole toolbar block, so this must emit the
// .toolbar wrapper too — it is the element the position:sticky rule targets.
function filters(activeType) {
  const items = [{ type: 'all', href: p('/'), label: t(ui('allWines')) }]
    .concat((catalog.categories || []).map(c => ({ type: c.type, href: p(`/${c.slug}/`), label: t(c.label) })));
  return `<div class="toolbar"><div class="filters" role="group" aria-label="${esc(t(ui('ariaFilters')))}">`
    + items.map(it => {
      const on = it.type === activeType;
      return `<a class="${on ? 'active' : ''}" href="${it.href}"${on ? ' aria-current="page"' : ''}>${glass(it.type)}${esc(it.label)}</a>`;
    }).join('')
    + `</div></div>`;
}

const ui = k => (catalog.ui || {})[k];

// `path` is locale-independent ('/', '/red-wine/', '/wine/<slug>/'), so the
// canonical and the alternates are all derived from it.
const urlFor = (loc, path) => `${BASE_URL}${loc.prefix}${path}`;
// locale-aware internal link: '' for zh, '/en' for en
const p = path => ((LOCALES.find(l => l.code === LOCALE) || {}).prefix || '') + path;
const other = () => LOCALES.find(l => l.code !== LOCALE);

function hreflang(path) {
  return LOCALES.map(l => `<link rel="alternate" hreflang="${l.lang}" href="${urlFor(l, path)}">`).join('')
    + `<link rel="alternate" hreflang="x-default" href="${urlFor(LOCALES[0], path)}">`;
}

function langSwitch(path) {
  const o = other();
  return `<a class="lang-switch" href="${urlFor(o, path)}" hreflang="${o.lang}" lang="${o.lang}"`
    + ` aria-label="${o.code === 'en' ? 'English' : '中文'}">${o.switchLabel}</a>`;
}



// The marquee duplicates its set so the loop is seamless. Category words come
// from categories[] so they can never drift from the filter labels.
function ticker() {
  const cell = v => `<span>${esc(v)}</span>`;
  const set = [
    cell(t(ui('tickerLine'))),
    `<span class="en">${esc(t(ui('tickerEn')))}</span>`,
    cell(t(ui('tickerSelection'))),
    ...(catalog.categories || []).map(c => cell(t(c.label))),
    cell(t(ui('taglinePlain'))),
  ].join('');
  return `\n      ${set}\n      ${set}\n    `;
}

const visible = () => (catalog.wines || []).filter(w => w.status !== 'hidden' && w.active !== false);

// slim header for non-homepage pages: same .top bar, no intro / no video
function slimHeader() {
  const brand = esc(t(ui('brandFull')));
  return `<div class="hb-hero"><header class="top">`
    + `<a class="logo brand" href="${p('/')}" aria-label="${brand}"><img src="/assets/logo.png" alt="${brand}"><span class="wm">Hong Bon</span></a>`
    + `<div class="top-actions">${langSwitch(CURRENT_PATH)}`
    + `<button class="cart" id="openCart" type="button" aria-label="${esc(t(ui('cartLabel')))}">${esc(t(ui('cartLabel')))} <b id="count">0</b></button>`
    + `<button class="menu-toggle" id="menuToggle" type="button" aria-label="${esc(t(ui('ariaMenu')))}" aria-expanded="false" aria-controls="mobileMenu">☰</button>`
    + `</div></header></div>`;
}

function pageHead(cat) {
  const n = visible().filter(w => w.type === cat.type).length;
  return `<section class="page-head">`
    + `<nav class="breadcrumb" aria-label="breadcrumb"><a href="${p('/')}">${esc(t(ui('homeLabel')))}</a><span aria-hidden="true">/</span><span>${esc(t(cat.label))}</span></nav>`
    + `<span class="eyebrow">${esc(t(ui('wineEyebrow')))}</span>`
    + `<h1>${esc(t(cat.label))}</h1>`
    + `<p>${esc(t(cat.intro)) || fill(t(ui('catFallback')), { brand: t(ui('brandFull')), label: t(cat.label), n })}</p>`
    + `</section>`;
}

function jsonld({ title, canonical, cat, catUrl, wine, crumbs }) {
  const org = {
    '@type': 'LiquorStore', name: `${t(ui('brandFull'))}`, url: `${BASE_URL}/`,
    telephone: catalog.phone,
    sameAs: [catalog.lineUrl, catalog.social?.instagram, catalog.social?.facebook].filter(Boolean),
  };
  const crumbList = list => ({ '@type': 'BreadcrumbList', itemListElement: list });

  let graph;
  if (crumbs) {
    // region / winery / hub pages: a collection page plus its breadcrumb trail
    graph = [org,
      { '@type': 'CollectionPage', name: title, url: canonical },
      crumbList(crumbs.map((cr, i) => ({
        '@type': 'ListItem', position: i + 1, name: cr.name, item: cr.href,
      })))];
  } else if (wine) {
    graph = [
      {
        '@type': 'Product',
        name: t(wine.name),
        image: `${BASE_URL}${wine.image}`,
        description: t(wine.desc),
        sku: wine.id,
        category: t(cat.label),
        brand: { '@type': 'Brand', name: `${t(ui('brandFull'))}` },
        url: canonical,
        // deliberately no `offers`: this site shows no prices and takes no orders
      },
      crumbList([
        { '@type': 'ListItem', position: 1, name: t(ui('homeLabel')), item: `${BASE_URL}/` },
        { '@type': 'ListItem', position: 2, name: t(cat.label), item: catUrl || canonical },
        { '@type': 'ListItem', position: 3, name: t(wine.name), item: canonical },
      ]),
      org,
    ];
  } else if (cat) {
    graph = [org,
      { '@type': 'CollectionPage', name: title, url: canonical },
      crumbList([
        { '@type': 'ListItem', position: 1, name: t(ui('homeLabel')), item: `${BASE_URL}/` },
        { '@type': 'ListItem', position: 2, name: t(cat.label), item: canonical },
      ])];
  } else {
    graph = [org, { '@type': 'WebPage', name: title, url: canonical }];
  }
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })}</script>`;
}

// wine detail block, rendered into {{PAGE_HEAD}}
function winePage(w, cat) {
  const name = esc(t(w.name));
  return `<section class="page-head wine-page">`
    + `<nav class="breadcrumb" aria-label="breadcrumb"><a href="${p('/')}">${esc(t(ui('homeLabel')))}</a><span aria-hidden="true">/</span>`
    + `<a href="${p(`/${cat.slug}/`)}">${esc(t(cat.label))}</a><span aria-hidden="true">/</span><span>${name}</span></nav>`
    + `<div class="wine-page-grid">`
    + `<div class="wine-page-art"><img src="${esc(w.image)}" alt="${name}"></div>`
    + `<div class="wine-page-info">`
    + `<span class="eyebrow">${esc(t(w.en))}</span>`
    + `<h1>${name}</h1>`
    + `<div class="tastes">${esc(t(w.taste))}</div>`
    + flavorChips(w)
    + `<p class="wine-page-desc">${esc(t(w.desc))}</p>`
    + `<button class="add" data-add="${w.id}" aria-label="${esc(fill(t(ui('ariaAddToInquiry')), { name: t(w.name) }))}">${esc(t(ui('addToInquiry')))}</button>`
    + `<p class="small">${esc(t(ui('heroNote')))}</p>`
    + `</div></div></section>`;
}

// ---------------------------------------------------------------- render
function render({ kind, path, title, description, ogDescription, ogImage, cat, wine, wines,
                 pageHeadHtml, collectionHeadHtml, grid, filtersHtml, crumbs }) {
  const isHome = kind === 'home';
  CURRENT_PATH = path;             // slimHeader() needs it for the switcher
  const loc = LOCALES.find(l => l.code === LOCALE);
  const canonical = urlFor(loc, path);
  const collectionHead = isHome
    ? `<div class="section-head"><div><span class="eyebrow">${esc(t(ui('collectionEyebrow')))}</span>`
      + `<h2>${esc(t(ui('collectionTitle')))}</h2></div><p>${esc(t(ui('collectionNote')))}</p></div>`
    : (kind === 'wine'
      ? `<div class="section-head"><div><span class="eyebrow">${esc(t(ui('wineMoreEyebrow')))}</span>`
        + `<h2>${esc(fill(t(ui('wineMoreTitle')), { label: t(cat.label) }))}</h2></div>`
        + `<p>${esc(t(ui('wineMoreNote')))}</p></div>`
      : '');
  const values = {
    LANG: loc.lang,
    TITLE: esc(title),
    DESCRIPTION: esc(description),
    OG_DESCRIPTION: esc(ogDescription || description),
    CANONICAL: canonical,
    HREFLANG: hreflang(path),
    LANG_SWITCH: langSwitch(path),
    OG_IMAGE: ogImage || `${BASE_URL}/assets/og-image.jpg`,
    BODY_ATTRS: isHome ? ' class="lock"' : '',
    PAGE_HEAD: isHome ? '' : (pageHeadHtml !== undefined ? pageHeadHtml
      : (kind === 'wine' ? winePage(wine, cat) : pageHead(cat))),
    // Hub pages show a plain link list, so they keep the section (for its padding)
    // but drop the heading, the toolbar and the .grid wrapper — a card-list inside
    // .grid would render as a single 3-column cell.
    COLLECTION_SECTION: kind === 'hub' ? `<section class="collection" id="collection">`
      + (grid || '') + `</section>` : `<section class="collection" id="collection">`
      + (collectionHeadHtml !== undefined ? collectionHeadHtml : collectionHead)
      + (filtersHtml !== undefined ? filtersHtml : filters(cat ? cat.type : 'all'))
      + `<div class="grid" id="products">`
      + (grid !== undefined ? grid : wines.map((w, i) => card(w, i)).join(''))
      + `</div></section>`,
    EXTRA_SCRIPTS: isHome ? '<script src="/assets/hero.js"></script>' : '',
    JSONLD: jsonld({ title, canonical, cat, catUrl: cat ? urlFor(loc, `/${cat.slug}/`) : undefined, wine, crumbs }),
    // derived from the catalog rather than duplicated as new strings
    BRAND: esc(t(catalog.brand)),
    BRAND_FULL: esc(t(ui('brandFull'))),
    ADDRESS_LINK: esc(t(catalog.address)) + ' ↗',
    PREFIX: loc.prefix,
    HOME: loc.prefix + '/',
    MAP_URL: esc(catalog.mapUrl || '#'),
    PHONE: esc(catalog.phone || ''),
    PHONE_TEL: String(catalog.phone || '').replace(/[^0-9+]/g, ''),
    PAYMENTS: (catalog.payments || []).map(x => esc(t(x))).join(t(ui('listSeparator'))),
    TICKER: ticker(),
    DEVELOPER_CREDIT: devCredit(),
  };
  // UI chrome strings, localised per render. Keys in catalog.json's `ui` block
  // map to {{UI_*}} tokens in the template.
  for (const [k, v] of Object.entries(catalog.ui || {})) {
    values['UI_' + k.replace(/[^A-Za-z0-9]/g, '_').toUpperCase()] = esc(t(v));
  }

  let out = template;
  for (const [k, v] of Object.entries(values)) out = out.split(`{{${k}}}`).join(v);

  // hero block: kept for the homepage, swapped for the slim header elsewhere.
  // NB: the hero markup lives BETWEEN the markers, so it has to be sliced out
  // explicitly — replacing the span with '' silently deletes the homepage hero
  // (and with it #openCart / #count / #menuToggle, which app.js requires).
  const START = '<!--HERO:START-->', END = '<!--HERO:END-->';
  const start = out.indexOf(START);
  const end = out.indexOf(END);
  if (start !== -1 && end !== -1) {
    const heroHtml = out.slice(start + START.length, end);
    out = out.slice(0, start) + (isHome ? heroHtml : slimHeader()) + out.slice(end + END.length);
  }

  const left = out.match(/\{\{[A-Z_]+\}\}/g);
  if (left) throw new Error(`unreplaced tokens: ${[...new Set(left)].join(', ')}`);
  return out;
}

// "Developed by <strong>Alpha Cool Tech</strong>", with name/URL from the catalog.
// One templated sentence per locale rather than prefix+suffix: an intentionally
// empty English suffix would fall back to Chinese through t()'s en||zh rule.
function devCredit() {
  const d = catalog.developer || {};
  const tpl = t(ui('creditTemplate'));
  if (!d.name || !d.url || !tpl) return '';
  const link = `<a href="${esc(d.url)}" target="_blank" rel="noopener"><strong>${esc(d.name)}</strong></a>`;
  return `<p class="developed-by">${fill(tpl, { link })}</p>`;
}

// ---------------------------------------------------------------- policy pages
// Separate template: they are simple documents and load no scripts.
const policyTemplate = readFileSync(join(ROOT, '_templates', 'policy.html'), 'utf8');

function renderPolicy(page, loc, path) {
  const title = `${t(page.title)}｜${t(ui('brandFull'))}`;
  const values = {
    LANG: loc.lang,
    TITLE: esc(title),
    H1: esc(t(page.title)),
    DESCRIPTION: esc(t(page.description)),
    CANONICAL: urlFor(loc, path),
    HREFLANG: hreflang(path),
    BRAND_FULL: esc(t(ui('brandFull'))),
    HOME: loc.prefix + '/',
    LINE_URL: catalog.lineUrl,
    BODY: (page.body || []).map(p => `<p>${esc(t(p))}</p>`).join(''),
    UI_HOMELABEL: esc(t(ui('homeLabel'))),
    UI_PAGEEYEBROW: esc(t(ui('pageEyebrow'))),
    UI_PAGECONTACT: esc(t(ui('pageContact'))),
    UI_PAGEWARNING: esc(t(ui('pageWarning'))),
    DEVELOPER_CREDIT: devCredit(),
    LANG_SWITCH: langSwitch(path),
  };
  let out = policyTemplate;
  for (const [k, v] of Object.entries(values)) out = out.split(`{{${k}}}`).join(v);
  const left = out.match(/\{\{[A-Z_]+\}\}/g);
  if (left) throw new Error(`policy ${page.slug}: unreplaced ${[...new Set(left)].join(', ')}`);
  return out;
}

// ---------------------------------------------------------------- content blocks
// The client asked for formatted text and inline images, not raw PDFs. `body[]`
// carries typed blocks so richer pages stay editable in the admin.
const paras = (v, cls = 'section-text') => String(t(v) || '')
  .split('\n').map(l => l.trim()).filter(Boolean)
  .map(l => `<p class="${cls}">${esc(l)}</p>`).join('');

function contentBlocks(blocks, name) {
  return (blocks || []).map(b => {
    if (b.type === 'text') return paras(b.value);
    if (b.type === 'image' && b.src) {
      const cap = t(b.caption);
      return `<figure class="figure"><img src="${esc(b.src)}" alt="${esc(cap || name)}" loading="lazy">`
        + (cap ? `<figcaption>${esc(cap)}</figcaption>` : '') + `</figure>`;
    }
    return '';
  }).join('');
}

const snippet = (v, n = 96) => {
  const str = String(t(v) || '').replace(/\s+/g, ' ').trim();
  return str.length > n ? str.slice(0, n - 1).trimEnd() + '\u2026' : str;
};

// hub list: plain links, not wine cards
function cardList(items) {
  return `<div class="card-list">` + items.map(i =>
    `<a class="card-item" href="${i.href}">`
    + (i.image ? `<img src="${esc(i.image)}" alt="${esc(i.title)}" loading="lazy">` : `<span class="card-item-art"></span>`)
    + `<span class="card-item-body"><strong>${esc(i.title)}</strong>`
    + (i.meta ? `<span class="card-item-meta">${esc(i.meta)}</span>` : '')
    + (i.text ? `<span class="card-item-text">${esc(i.text)}</span>` : '')
    + `</span></a>`).join('') + `</div>`;
}

const sectionHeadBlock = (eyebrow, title) =>
  `<div class="section-head"><div><span class="eyebrow">${esc(eyebrow)}</span><h2>${esc(title)}</h2></div></div>`;

const arrow = '\u2197';

function regionHead(region) {
  const name = esc(t(region.name));
  return `<section class="page-head section-page">`
    + `<nav class="breadcrumb" aria-label="breadcrumb"><a href="${p('/')}">${esc(t(ui('homeLabel')))}</a>`
    + `<span aria-hidden="true">/</span><a href="${p('/regions/')}">${esc(t(ui('regionsTitle')))}</a>`
    + `<span aria-hidden="true">/</span><span>${name}</span></nav>`
    + `<span class="eyebrow">${esc(t(ui('regionEyebrow')))} \u00b7 ${esc(region.country)}</span>`
    + `<h1>${name}</h1>`
    + paras(region.intro, 'section-lead')
    + contentBlocks(region.body, t(region.name))
    + `</section>`;
}

function wineryHead(w) {
  const name = esc(t(w.name));
  const region = (catalog.regions || []).find(r => r.slug === w.region);
  return `<section class="page-head section-page">`
    + `<nav class="breadcrumb" aria-label="breadcrumb"><a href="${p('/')}">${esc(t(ui('homeLabel')))}</a>`
    + `<span aria-hidden="true">/</span><a href="${p('/wineries/')}">${esc(t(ui('wineriesTitle')))}</a>`
    + `<span aria-hidden="true">/</span><span>${name}</span></nav>`
    + `<span class="eyebrow">${esc(t(ui('wineryEyebrow')))} \u00b7 ${esc(w.country)}</span>`
    + `<h1>${name}</h1>`
    + paras(w.story, 'section-lead')
    + (region ? `<p class="section-meta">${esc(t(ui('inRegion')))}: <a href="${p(`/region/${region.slug}/`)}">${esc(t(region.name))}</a></p>` : '')
    + (w.website ? `<p class="section-meta"><a href="${esc(w.website)}" target="_blank" rel="noopener">${esc(t(ui('visitWebsite')))} ${arrow}</a></p>` : '')
    + (w.image ? `<figure class="figure figure-lead"><img src="${esc(w.image)}" alt="${name}"></figure>` : '')
    + contentBlocks(w.body, name)
    + `</section>`;
}

function write(relPath, html) {
  const dest = join(ROOT, relPath);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, html);
  console.log(`  wrote ${relPath}  (${html.length} bytes)`);
}

// ---------------------------------------------------------------- pages
const cats = catalog.categories || [];
const all = visible();
const policies = ['privacy', 'terms', 'shipping', 'quality'];
const fill = (tpl, vars) => String(tpl).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

// One entry per page path; `locales` limits a page to the locales it exists in
// (the policy pages are Chinese-only until translations arrive).
const entries = [{ path: '/', cf: 'weekly', pr: '1.0', locales: null }];
for (const cat of cats) entries.push({ path: `/${cat.slug}/`, cf: 'weekly', pr: '0.8', locales: null });
for (const w of all) if (w.slug) entries.push({ path: `/wine/${w.slug}/`, cf: 'monthly', pr: '0.6', locales: null });
for (const p of policies) entries.push({ path: `/${p}.html`, cf: 'yearly', pr: '0.3', locales: null });
entries.push({ path: '/regions/', cf: 'monthly', pr: '0.7', locales: null });
entries.push({ path: '/wineries/', cf: 'monthly', pr: '0.7', locales: null });
for (const r of catalog.regions || []) entries.push({ path: `/region/${r.slug}/`, cf: 'monthly', pr: '0.6', locales: null });
for (const w of catalog.wineries || []) entries.push({ path: `/winery/${w.slug}/`, cf: 'monthly', pr: '0.6', locales: null });

let pageCount = 0;
for (const loc of LOCALES) {
  LOCALE = loc.code;
  const dir = loc.prefix ? loc.prefix.slice(1) : '';
  const at = rel => (dir ? join(dir, rel) : rel);

  write(at('index.html'), render({
    kind: 'home', path: '/',
    title: t(ui('homeTitle')),
    description: t(ui('homeDescription')),
    ogDescription: t(ui('homeOgDescription')),
    cat: null, wines: all,
  }));
  pageCount++;

  for (const cat of cats) {
    const wines = all.filter(w => w.type === cat.type);
    write(at(join(cat.slug, 'index.html')), render({
      kind: 'category', path: `/${cat.slug}/`,
      title: `${t(cat.label)}｜${t(ui('brandFull'))}`,
      description: fill(t(ui('catDescription')), { brand: t(catalog.brand), label: t(cat.label), n: wines.length }),
      cat, wines,
    }));
    pageCount++;
  }

  for (const page of catalog.pages || []) {
    const path = `/${page.slug}.html`;
    write(at(`${page.slug}.html`), renderPolicy(page, loc, path));
    pageCount++;
  }

  for (const w of all) {
    // no slug -> no page; the cards skip the link too, so nothing 404s
    if (!w.slug) continue;
    const cat = cats.find(c => c.type === w.type);
    if (!cat) continue;
    const siblings = all.filter(x => x.type === w.type && x.id !== w.id);
    // a one-wine category would leave the grid empty, so fall back to any others
    const related = siblings.length ? siblings : all.filter(x => x.id !== w.id).slice(0, 4);
    write(at(join('wine', w.slug, 'index.html')), render({
      kind: 'wine', path: `/wine/${w.slug}/`,
      title: `${t(w.name)}｜${t(ui('brandFull'))}`,
      description: fill(t(ui('wineDescription')), { name: t(w.name), taste: t(w.taste) }).slice(0, 155),
      ogDescription: `${t(w.name)} — ${t(w.en)}`,
      ogImage: w.image && w.image.startsWith('/') ? `${BASE_URL}${w.image}` : undefined,
      cat, wine: w, wines: related,
    }));
    pageCount++;
  }

  // ---- regions ----
  const regions = catalog.regions || [];
  const wineries = catalog.wineries || [];
  const crumbsHome = () => [{ name: t(ui('homeLabel')), href: urlFor(loc, '/') }];

  write(at(join('regions', 'index.html')), render({
    kind: 'hub', path: '/regions/',
    title: `${t(ui('regionsTitle'))}|${t(ui('brandFull'))}`.replace('|', '\uff5c'),
    description: t(ui('regionsLead')),
    pageHeadHtml: `<section class="page-head section-page">`
      + `<nav class="breadcrumb" aria-label="breadcrumb"><a href="${p('/')}">${esc(t(ui('homeLabel')))}</a>`
      + `<span aria-hidden="true">/</span><span>${esc(t(ui('regionsTitle')))}</span></nav>`
      + `<span class="eyebrow">${esc(t(ui('regionsEyebrow')))}</span><h1>${esc(t(ui('regionsTitle')))}</h1>`
      + paras(ui('regionsLead'), 'section-lead') + `</section>`,
    grid: cardList(regions.map(r => ({
      href: p(`/region/${r.slug}/`), title: t(r.name), meta: r.country,
      text: snippet(r.intro), image: '',
    }))),
    filtersHtml: '', collectionHeadHtml: '',
    crumbs: [...crumbsHome(), { name: t(ui('regionsTitle')), href: urlFor(loc, '/regions/') }],
  }));
  pageCount++;

  for (const r of regions) {
    const rw = all.filter(w => w.region === r.slug);
    write(at(join('region', r.slug, 'index.html')), render({
      kind: 'section', path: `/region/${r.slug}/`,
      title: `${t(r.name)}|${t(ui('brandFull'))}`.replace('|', '\uff5c'),
      description: snippet(r.intro, 155),
      pageHeadHtml: regionHead(r),
      collectionHeadHtml: sectionHeadBlock(t(ui('regionEyebrow')), fill(t(ui('winesFromRegion')), { name: t(r.name) })),
      grid: rw.map((w, i) => card(w, i)).join(''),
      filtersHtml: '',
      crumbs: [...crumbsHome(), { name: t(ui('regionsTitle')), href: urlFor(loc, '/regions/') },
               { name: t(r.name), href: urlFor(loc, `/region/${r.slug}/`) }],
    }));
    pageCount++;
  }

  // ---- wineries ----
  write(at(join('wineries', 'index.html')), render({
    kind: 'hub', path: '/wineries/',
    title: `${t(ui('wineriesTitle'))}|${t(ui('brandFull'))}`.replace('|', '\uff5c'),
    description: t(ui('wineriesLead')),
    pageHeadHtml: `<section class="page-head section-page">`
      + `<nav class="breadcrumb" aria-label="breadcrumb"><a href="${p('/')}">${esc(t(ui('homeLabel')))}</a>`
      + `<span aria-hidden="true">/</span><span>${esc(t(ui('wineriesTitle')))}</span></nav>`
      + `<span class="eyebrow">${esc(t(ui('wineriesEyebrow')))}</span><h1>${esc(t(ui('wineriesTitle')))}</h1>`
      + paras(ui('wineriesLead'), 'section-lead') + `</section>`,
    grid: cardList(wineries.map(w => ({
      href: p(`/winery/${w.slug}/`), title: t(w.name), meta: w.country,
      text: snippet(w.story), image: w.image || '',
    }))),
    filtersHtml: '', collectionHeadHtml: '',
    crumbs: [...crumbsHome(), { name: t(ui('wineriesTitle')), href: urlFor(loc, '/wineries/') }],
  }));
  pageCount++;

  for (const w of wineries) {
    const ww = all.filter(x => x.winery === w.slug);
    write(at(join('winery', w.slug, 'index.html')), render({
      kind: 'section', path: `/winery/${w.slug}/`,
      title: `${t(w.name)}|${t(ui('brandFull'))}`.replace('|', '\uff5c'),
      description: snippet(w.story, 155),
      ogImage: w.image ? `${BASE_URL}${w.image}` : undefined,
      pageHeadHtml: wineryHead(w),
      collectionHeadHtml: ww.length
        ? sectionHeadBlock(t(ui('wineryEyebrow')), fill(t(ui('winesFromWinery')), { name: t(w.name) }))
        : '',
      // A winery with no wines yet: an empty .grid shows nothing, so say so instead.
      grid: ww.length ? ww.map((x, i) => card(x, i)).join('')
        : `<p class="empty">${esc(t(ui('noWinesYet')))}</p>`,
      filtersHtml: '',
      crumbs: [...crumbsHome(), { name: t(ui('wineriesTitle')), href: urlFor(loc, '/wineries/') },
               { name: t(w.name), href: urlFor(loc, `/winery/${w.slug}/`) }],
    }));
    pageCount++;
  }
}

// ---------------------------------------------------------------- sitemap
// Each locale gets its own <url> carrying every alternate, which is the
// standard way to declare hreflang inside a sitemap.
const rows = [];
for (const e of entries) {
  const locs = LOCALES.filter(l => !e.locales || e.locales.includes(l.code));
  for (const l of locs) {
    const alts = locs.length > 1
      ? locs.map(a => `    <xhtml:link rel="alternate" hreflang="${a.lang}" href="${urlFor(a, e.path)}"/>`).join('\n') + '\n'
      : '';
    rows.push(`  <url>\n    <loc>${urlFor(l, e.path)}</loc>\n${alts}`
      + `    <changefreq>${e.cf}</changefreq>\n    <priority>${e.pr}</priority>\n  </url>`);
  }
}
write('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n'
  + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
  + rows.join('\n') + '\n</urlset>\n');

console.log(`\ngenerate.mjs done — ${all.length} wines, ${cats.length} categories, `
  + `${pageCount} pages across ${LOCALES.length} locales`);
