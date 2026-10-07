/* ================= CONFIG =================
   Replace `video` with your own clip when ready
   (put the file next to this HTML, e.g. "/assets/intro-pour.mp4"). */
const CONFIG = {
  video:          'https://assets.mixkit.co/videos/52407/52407-720.mp4',
  videoMobile:    '',          // optional 9:16 clip for phones; falls back to `video`
  startAt:        0,           // seconds into the clip where the intro starts
  introMs:        5200,        // how long the pour plays before it fades away
  objPosition:    '50% 50%',   // framing of the glass in the intro
  bannerMs:       5000,        // banner image switch interval
  oncePerSession: true,        // returning visitors skip the intro
  maxLockMs:      12000        // hard cap: never leave the page scroll-locked
};
/* ========================================= */

(() => {
  const $ = s => document.querySelector(s);
  const body = document.body, hero = $('#hero'), media = $('#media'), vid = $('#vid'),
        ui = $('#introUi'), prog = $('#prog'), tag = $('#lineTag');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = matchMedia('(max-width:860px)').matches;
  const pad = n => String(n).padStart(2, '0');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const t=v=>v&&typeof v==="object"?((document.documentElement.lang||"").toLowerCase().indexOf("en")===0?(v.en||v.zh||""):(v.zh||v.en||"")):(v==null?"":String(v));
  media.style.setProperty('--obj', CONFIG.objPosition);

  let handed = false;
  const releaseLock = () => {
    if (handed) return;
    handed = true;
    body.classList.add('intro-done', 'gone');
    body.classList.remove('lock');
    revealHero();   // if this fired because of an error, the hero still has to be visible
  };
  // watchdog: a JS error must never leave the page stuck at overflow:hidden
  const watchdog = setTimeout(releaseLock, CONFIG.maxLockMs);

  /* ---------- Banner carousel ---------- */
  const frame = $('#frame'), bar = $('#bBar'), num = $('#bNum'), pauseBtn = $('#bPause'), bctl = $('#hero .bctl');
  let slides = [], idx = 0, paused = false, running = false, tStart = 0, progress = 0;

  const fitFrame = img => { if (img.naturalWidth) frame.style.aspectRatio = img.naturalWidth + ' / ' + img.naturalHeight; };
  const collect = () => { slides = [...frame.querySelectorAll('img')]; };

  function build(list) {
    frame.innerHTML = list.map((s, i) =>
      `<img class="${i === 0 ? 'on' : ''}" src="${esc(s.image)}" alt="${esc(s.alt)}"${i ? ' loading="lazy"' : ''}>`).join('');
    collect();
    num.innerHTML = `${pad(1)} <small>/ ${pad(slides.length)}</small>`;
    if (bctl) bctl.hidden = slides.length < 2;
    idx = 0; progress = 0;
    const first = slides[0];
    if (first) {
      if (first.complete) fitFrame(first);
      else first.addEventListener('load', () => fitFrame(first), { once: true });
    }
  }

  function show(i) {
    if (slides.length < 2) return;
    slides[idx].classList.remove('on');
    idx = (i + slides.length) % slides.length;
    slides[idx].classList.add('on');
    num.innerHTML = `${pad(idx + 1)} <small>/ ${pad(slides.length)}</small>`;
    tStart = performance.now(); progress = 0;
  }

  $('#bPrev').onclick = () => show(idx - 1);
  $('#bNext').onclick = () => show(idx + 1);
  pauseBtn.onclick = () => {
    paused = !paused; pauseBtn.textContent = paused ? '播放' : '暫停';
    if (!paused) tStart = performance.now() - progress * CONFIG.bannerMs;
  };

  function bannerTick(now) {
    if (!paused && slides.length > 1) {
      progress = Math.min(1, (now - tStart) / CONFIG.bannerMs);
      bar.style.transform = `scaleX(${progress})`;
      if (progress >= 1) show(idx + 1);
    }
    requestAnimationFrame(bannerTick);
  }
  function startBanner() { if (running) return; running = true; tStart = performance.now(); requestAnimationFrame(bannerTick); }
  if (reduce) { paused = true; pauseBtn.textContent = '播放'; }

  collect();
  if (slides[0] && slides[0].complete) fitFrame(slides[0]);
  else if (slides[0]) slides[0].addEventListener('load', () => fitFrame(slides[0]), { once: true });
  if (bctl) bctl.hidden = slides.length < 2;

  // catalogue drives the banner; the markup above is the no-JS / offline fallback
  (async () => {
    try {
      const r = await fetch('/catalog.json');
      if (!r.ok) throw new Error('catalog');
      const s = await r.json();
      const list = (s.heroSlides || [])
        .map(x => ({ image: x.image, alt: t(x.alt) || `${t(s.brand)}精選圖片` }))
        .filter(x => x.image);
      if (list.length) build(list);
    } catch (e) { /* keep the markup fallback */ }
  })();

  /* ---------- Intro ---------- */
  const node = tag.firstChild;
  if (node && node.nodeType === 3) {
    const txt = node.textContent;
    node.remove();
    const frag = document.createDocumentFragment();
    [...txt].forEach((c, i) => {
      const s = document.createElement('span');
      s.textContent = c; s.setAttribute('aria-hidden', 'true'); s.style.setProperty('--d', (i * 70) + 'ms');
      frag.append(s);
    });
    tag.prepend(frag);
  }

  let t0 = 0, rafId = 0;

  function revealHero() { hero.classList.add('revealed'); startBanner(); }

  function cleanup() {
    body.classList.add('gone');
    vid.pause(); vid.removeAttribute('src'); vid.load();   // free the video once it's gone
  }

  function endIntro(fast) {
    if (handed) return;
    handed = true;
    clearTimeout(watchdog);
    cancelAnimationFrame(rafId);
    scrollTo(0, 0);
    body.classList.add('intro-done');
    setTimeout(revealHero, fast ? 250 : 550);
    setTimeout(() => body.classList.remove('lock'), 900);
    setTimeout(cleanup, 1900);
    try { sessionStorage.setItem('hb-intro', '1'); } catch (e) {}
  }

  function tick(now) {
    const p = Math.min(1, (now - t0) / CONFIG.introMs);
    prog.style.transform = `scaleX(${p})`;
    if (p >= 1) return endIntro(false);
    rafId = requestAnimationFrame(tick);
  }

  function startIntro() {
    ui.classList.add('on');
    setTimeout(() => ui.classList.add('words'), 900);
    t0 = performance.now();
    rafId = requestAnimationFrame(tick);
  }

  let seen = false; try { seen = sessionStorage.getItem('hb-intro') === '1'; } catch (e) {}
  if (reduce || (CONFIG.oncePerSession && seen)) {
    clearTimeout(watchdog);
    handed = true;
    body.classList.add('intro-done', 'gone'); body.classList.remove('lock');
    revealHero();
    return;
  }

  vid.src = (mobile && CONFIG.videoMobile) || CONFIG.video;
  vid.addEventListener('loadeddata', () => { if (CONFIG.startAt) vid.currentTime = CONFIG.startAt; }, { once: true });
  vid.addEventListener('playing', () => vid.classList.add('ready'), { once: true });

  $('#skip').addEventListener('click', () => endIntro(true));
  addEventListener('keydown', e => { if (e.key === 'Escape') endIntro(true); });

  // begin once the footage is playing (max wait 2.5s so slow networks aren't stuck)
  let started = false;
  const begin = () => { if (!started) { started = true; startIntro(); } };
  vid.addEventListener('playing', begin, { once: true });
  vid.addEventListener('error', begin, { once: true });
  vid.play().catch(begin);
  setTimeout(begin, 2500);
})();
