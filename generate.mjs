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
const LOCALE = 'zh';           // English pages arrive with the /en/ milestone

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
const FLAVORS = [
  { zh: '果香', en: 'Fruity', match: ['果香', '水果', '漿果', '黑莓', '櫻桃', '草莓', '覆盆子', '柑橘', '檸檬', '蘋果', '桃', '杏', '李子', '梨', '黑加侖', '葡萄柚'] },
  { zh: '花香', en: 'Floral', match: ['花香', '白花', '接骨木', '紫羅蘭', '白色花朵', '乾燥花'] },
  { zh: '礦物', en: 'Mineral', match: ['礦物', '礦石', '板岩', '碎石', '鵝卵石', '礫石'] },
  { zh: '單寧', en: 'Tannin', match: ['單寧'] },
  { zh: '氣泡', en: 'Sparkling', match: ['氣泡', '起泡'] },
  { zh: '煙燻', en: 'Smoky', match: ['煙燻', '煙燻感'] },
  { zh: '香料', en: 'Spice', match: ['香料', '胡椒', '甘草', '肉桂', '茴香', '烘焙香料'] },
  { zh: '草本', en: 'Herbal', match: ['草本', '鼠尾草', '迷迭香', '百里香', '月桂', '杜松子', '薄荷'] },
  { zh: '巧克力', en: 'Chocolate', match: ['巧克力', '可可', '摩卡', '太妃糖'] },
  { zh: '橡木', en: 'Oak', match: ['橡木'] },
];

const flavorsOf = w => {
  const hay = t(w.desc) + t(w.taste);
  return FLAVORS.filter(f => f.match.some(k => hay.includes(k)))
    .map(f => (LOCALE === 'en' ? f.en : f.zh));
};

const flavorChips = w => {
  const f = flavorsOf(w);
  return f.length ? `<div class="flavors">${f.map(x => `<span class="flavor">${esc(x)}</span>`).join('')}</div>` : '';
};

// wine card — must match the structure app.js used to produce
function card(w, index) {
  const n = String(index + 1).padStart(2, '0');
  const name = esc(t(w.name));
  return `<article class="product${w.featured ? ' featured' : ''}">`
    + `<div class="product-art"><img src="${esc(w.image)}" alt="${name}商品參考圖" style="object-position:50% center" loading="lazy">`
    + `<span class="tag">${n}</span>${w.featured ? '<span class="featured-ribbon">本月推薦</span>' : ''}</div>`
    + `<div class="product-body">`
    + `<span class="type mobile-summary" id="wine-type-${w.id}">${esc(t(w.en))}</span>`
    + `<h3 class="mobile-summary" id="wine-name-${w.id}">${name}</h3>`
    + `<p class="mobile-summary" id="wine-desc-${w.id}">${esc(t(w.desc))}</p>`
    + `<div class="tastes mobile-summary" id="wine-taste-${w.id}">${esc(t(w.taste))}</div>`
    + flavorChips(w)
    + `<button type="button" class="wine-expand" data-expand aria-expanded="false" aria-controls="wine-type-${w.id} wine-name-${w.id} wine-desc-${w.id} wine-taste-${w.id}" aria-label="展開${name}的更多資訊" hidden>展開更多 ＋</button>`
    + `<div class="product-bottom"><span>專屬詢價</span><button class="add" data-add="${w.id}" aria-label="將${name}加入詢價">＋ 加入詢價</button></div>`
    + `</div></article>`;
}

const glass = type => `<svg class="glass glass-${type}" viewBox="0 0 24 24" aria-hidden="true">`
  + `<path d="M8 3h8l-1 6a3 3 0 0 1-6 0L8 3z" fill="currentColor"/>`
  + `<path d="M12 12v6M9 19h6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`;

// filters are links now, so each category is a real, shareable, indexable URL.
// The {{FILTERS}} token replaces the whole toolbar block, so this must emit the
// .toolbar wrapper too — it is the element the position:sticky rule targets.
function filters(activeType) {
  const items = [{ type: 'all', href: '/', label: '全部酒款' }]
    .concat((catalog.categories || []).map(c => ({ type: c.type, href: `/${c.slug}/`, label: t(c.label) })));
  return `<div class="toolbar"><div class="filters" role="group" aria-label="酒款分類">`
    + items.map(it => {
      const on = it.type === activeType;
      return `<a class="${on ? 'active' : ''}" href="${it.href}"${on ? ' aria-current="page"' : ''}>${glass(it.type)}${esc(it.label)}</a>`;
    }).join('')
    + `</div></div>`;
}

const visible = () => (catalog.wines || []).filter(w => w.status !== 'hidden' && w.active !== false);

// slim header for non-homepage pages: same .top bar, no intro / no video
function slimHeader() {
  const brand = esc(t(catalog.brand));
  return `<div class="hb-hero"><header class="top">`
    + `<a class="logo brand" href="/" aria-label="${brand}"><img src="/assets/logo.png" alt="${brand}"><span class="wm">Hong Bon</span></a>`
    + `<div class="top-actions">`
    + `<button class="cart" id="openCart" type="button" aria-label="詢價清單">詢價清單 <b id="count">0</b></button>`
    + `<button class="menu-toggle" id="menuToggle" type="button" aria-label="開啟選單" aria-expanded="false" aria-controls="mobileMenu">☰</button>`
    + `</div></header></div>`;
}

function pageHead(cat) {
  const n = visible().filter(w => w.type === cat.type).length;
  return `<section class="page-head">`
    + `<nav class="breadcrumb" aria-label="breadcrumb"><a href="/">首頁</a><span aria-hidden="true">/</span><span>${esc(t(cat.label))}</span></nav>`
    + `<span class="eyebrow">WINE SELECTION</span>`
    + `<h1>${esc(t(cat.label))}</h1>`
    + `<p>${esc(t(cat.intro)) || `${esc(t(catalog.brand))} 精選${esc(t(cat.label))}，共 ${n} 款。點選酒款加入詢價清單，透過 LINE 與我們確認價格與供貨。`}</p>`
    + `</section>`;
}

function jsonld({ title, canonical, cat }) {
  const org = {
    '@type': 'LiquorStore', name: `${t(catalog.brand)} HONG BON`, url: `${BASE_URL}/`,
    telephone: catalog.phone,
    sameAs: [catalog.lineUrl, catalog.social?.instagram, catalog.social?.facebook].filter(Boolean),
  };
  const graph = cat
    ? [org,
      { '@type': 'CollectionPage', name: title, url: canonical },
      {
        '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: '首頁', item: `${BASE_URL}/` },
          { '@type': 'ListItem', position: 2, name: t(cat.label), item: canonical }],
      }]
    : [org, { '@type': 'WebPage', name: title, url: canonical }];
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })}</script>`;
}

// ---------------------------------------------------------------- render
function render({ canonical, title, description, ogDescription, cat, wines, hero }) {
  const values = {
    LANG: 'zh-Hant',
    TITLE: esc(title),
    DESCRIPTION: esc(description),
    OG_DESCRIPTION: esc(ogDescription || description),
    CANONICAL: canonical,
    OG_IMAGE: `${BASE_URL}/assets/og-image.jpg`,
    BODY_ATTRS: hero ? ' class="lock"' : '',
    PAGE_HEAD: hero ? '' : pageHead(cat),
    COLLECTION_HEAD: hero
      ? '<div class="section-head"><div><span class="eyebrow">CURATED FOR YOU</span><h2>一瓶酒，一種心情</h2></div><p>價格與供貨依專人確認為準</p></div>'
      : '',
    FILTERS: filters(cat ? cat.type : 'all'),
    GRID: wines.map((w, i) => card(w, i)).join(''),
    EXTRA_SCRIPTS: hero ? '<script src="/assets/hero.js"></script>' : '',
    JSONLD: jsonld({ title, canonical, cat }),
  };
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
    out = out.slice(0, start) + (hero ? heroHtml : slimHeader()) + out.slice(end + END.length);
  }

  const left = out.match(/\{\{[A-Z_]+\}\}/g);
  if (left) throw new Error(`unreplaced tokens: ${[...new Set(left)].join(', ')}`);
  return out;
}

function write(relPath, html) {
  const dest = join(ROOT, relPath);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, html);
  console.log(`  wrote ${relPath}  (${html.length} bytes)`);
}

// ---------------------------------------------------------------- homepage
const all = visible();
write('index.html', render({
  canonical: `${BASE_URL}/`,
  title: '宏邦貿易 HONG BON｜專屬選酒',
  description: `${t(catalog.brand)} HONG BON 專屬選酒：依照口味與場合挑選紅酒、白酒、粉紅酒與氣泡酒，整理專屬詢價清單，透過 LINE 或 Email 與我們確認價格與供貨。`,
  // the site used a shorter, punchier line for social previews — preserved as-is
  ogDescription: '依照口味與場合，挑選屬於你的酒款，整理專屬詢價清單。',
  cat: null, wines: all, hero: true,
}));

// ---------------------------------------------------------------- categories
const cats = catalog.categories || [];
for (const cat of cats) {
  const wines = all.filter(w => w.type === cat.type);
  write(join(cat.slug, 'index.html'), render({
    canonical: `${BASE_URL}/${cat.slug}/`,
    title: `${t(cat.label)}｜${t(catalog.brand)} HONG BON`,
    description: `${t(catalog.brand)} ${t(cat.label)}精選，共 ${wines.length} 款。點選酒款加入詢價清單，透過 LINE 與我們確認價格與供貨。`,
    cat, wines, hero: false,
  }));
}

// ---------------------------------------------------------------- sitemap
const policies = ['privacy', 'terms', 'shipping', 'quality'];
const urls = [
  { loc: `${BASE_URL}/`, cf: 'weekly', pr: '1.0' },
  ...cats.map(c => ({ loc: `${BASE_URL}/${c.slug}/`, cf: 'weekly', pr: '0.8' })),
  ...policies.map(p => ({ loc: `${BASE_URL}/${p}.html`, cf: 'yearly', pr: '0.3' })),
];
write('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n'
  + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  + urls.map(u => `  <url>\n    <loc>${u.loc}</loc>\n    <changefreq>${u.cf}</changefreq>\n    <priority>${u.pr}</priority>\n  </url>`).join('\n')
  + '\n</urlset>\n');

console.log(`\ngenerate.mjs done — ${all.length} wines, ${cats.length} categories`);
