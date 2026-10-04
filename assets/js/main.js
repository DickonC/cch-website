/* CCH Solutions — site interactions. No dependencies. */
(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const isDesktop = () => window.innerWidth > 900;

  /* ------------------------------------------------------------------
     Hero: particles that assemble into the CCH mark
     ------------------------------------------------------------------ */
  const hero = $('.hero');
  const canvas = $('#hero-canvas');
  const ctx = canvas.getContext('2d');
  const markPaths = $$('#cch-mark path').map(p => new Path2D(p.getAttribute('d')));
  const VB = { x: 672, y: 852, w: 576, h: 216 };
  const COLORS = ['#2f8cff', '#45a8ff', '#5cd6ff'];

  let particles = [];
  let W = 0, H = 0, DPR = 1;
  let mouse = { x: -9999, y: -9999 };
  let heroVisible = true;
  let scatter = 0;
  let markAlpha = 1;
  let rafId = null;

  function layoutMark() {
    if (isDesktop()) {
      const w = Math.min(W * 0.36, 540);
      return { w, cx: W * 0.75, cy: H * 0.48, alpha: 1 };
    }
    // Mobile: a smaller mark sitting above the headline
    const w = Math.min(W * 0.62, 340);
    return { w, cx: W / 2, cy: 92 + (w * VB.h / VB.w) / 2, alpha: 0.85 };
  }

  function buildParticles() {
    const rect = hero.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);

    const { w, cx, cy, alpha } = layoutMark();
    markAlpha = alpha;
    const h = w * (VB.h / VB.w);
    const s = w / VB.w;

    // Rasterise the mark off-screen, then sample filled pixels on a grid
    const off = document.createElement('canvas');
    off.width = Math.ceil(W);
    off.height = Math.ceil(H);
    const o = off.getContext('2d');
    o.translate(cx - w / 2, cy - h / 2);
    o.scale(s, s);
    o.translate(-VB.x, -VB.y);
    markPaths.forEach(p => o.fill(p));

    const data = o.getImageData(0, 0, off.width, off.height).data;
    const gap = Math.max(3, Math.round(w / 120));
    const old = particles;
    particles = [];
    let i = 0;
    for (let y = 0; y < off.height; y += gap) {
      for (let x = 0; x < off.width; x += gap) {
        if (data[(y * off.width + x) * 4 + 3] > 128) {
          const prev = old[i++];
          const ang = Math.random() * Math.PI * 2;
          particles.push({
            tx: x, ty: y,
            x: prev ? prev.x : (reduceMotion ? x : Math.random() * W),
            y: prev ? prev.y : (reduceMotion ? y : Math.random() * H),
            vx: 0, vy: 0,
            size: gap * (0.42 + Math.random() * 0.3),
            c: Math.min(2, Math.floor(((x - (cx - w / 2)) / w) * 3 + Math.random() * 0.8)),
            sx: Math.cos(ang), sy: Math.sin(ang),
            spread: 120 + Math.random() * 380,
            ph: Math.random() * Math.PI * 2,
          });
        }
      }
    }
  }

  function step(t) {
    const R = 90, R2 = R * R;
    const time = t * 0.0012;
    for (const p of particles) {
      const tx = p.tx + p.sx * p.spread * scatter + Math.sin(time + p.ph) * 0.8;
      const ty = p.ty + p.sy * p.spread * scatter + Math.cos(time + p.ph) * 0.8;
      p.vx += (tx - p.x) * 0.045;
      p.vy += (ty - p.y) * 0.045;

      const dx = p.x - mouse.x, dy = p.y - mouse.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < R2 && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const f = (1 - d / R) * 5;
        p.vx += (dx / d) * f;
        p.vy += (dy / d) * f;
      }
      p.vx *= 0.82;
      p.vy *= 0.82;
      p.x += p.vx;
      p.y += p.vy;
    }
  }

  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const a = markAlpha * clamp(1 - scatter * 1.15);
    if (a <= 0) return;
    ctx.globalAlpha = a;
    for (let c = 0; c < COLORS.length; c++) {
      ctx.fillStyle = COLORS[c];
      ctx.beginPath();
      for (const p of particles) {
        if (p.c === c) ctx.rect(p.x, p.y, p.size, p.size);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function loop(t) {
    rafId = null;
    if (!heroVisible) return;
    step(t);
    draw();
    rafId = requestAnimationFrame(loop);
  }
  function startLoop() {
    if (reduceMotion) { draw(); return; }
    if (!rafId) rafId = requestAnimationFrame(loop);
  }

  buildParticles();
  startLoop();

  new IntersectionObserver(([e]) => {
    heroVisible = e.isIntersecting;
    if (heroVisible) startLoop();
  }).observe(hero);

  if (!reduceMotion) {
    hero.addEventListener('pointermove', e => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    });
    hero.addEventListener('pointerleave', () => { mouse.x = mouse.y = -9999; });
  }

  let lastW = window.innerWidth;
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      // Mobile browsers fire resize when the URL bar shows/hides; only rebuild on width changes
      if (window.innerWidth !== lastW) {
        lastW = window.innerWidth;
        buildParticles();
        if (reduceMotion) draw();
      }
      sizeHScroll();
      onScroll();
    }, 150);
  });

  /* ------------------------------------------------------------------
     Typed command line in the hero
     ------------------------------------------------------------------ */
  const typedEl = $('#typed');
  const words = ['invoice processing', 'weekly reports', 'data entry', 'stock syncing', 'client reminders', 'quote generation', 'the boring bits'];
  if (!reduceMotion && typedEl) {
    let wi = 0, ci = words[0].length, deleting = true;
    const tick = () => {
      const word = words[wi];
      if (deleting) {
        ci--;
        if (ci <= 0) { deleting = false; wi = (wi + 1) % words.length; }
      } else {
        ci++;
        if (ci >= words[wi].length) { deleting = true; typedEl.textContent = words[wi]; return setTimeout(tick, 1900); }
      }
      typedEl.textContent = (deleting ? word : words[wi]).slice(0, ci);
      setTimeout(tick, deleting ? 35 : 70 + Math.random() * 50);
    };
    setTimeout(tick, 2600);
  }

  /* ------------------------------------------------------------------
     Scroll-driven bits
     ------------------------------------------------------------------ */
  const nav = $('#nav');
  const progressBar = $('.scroll-progress');
  const heroContent = $('.hero__content');
  const story = $('#story');
  const storySteps = $$('.story__step');
  const panels = $$('.panel');
  const storyBar = $('.story__bar span');
  const windowTitle = $('#window-title');
  const clockValue = $('#clock-value');
  const titles = ['weekly_invoices_FINAL_v3.xlsx', 'process_map', 'weekly_invoices.py', 'scheduler — logs'];
  const hs = $('#how');
  const track = $('#hscroll-track');
  const stepCards = $$('.step', track);
  let hsDistance = 0;
  let lastY = window.scrollY;
  let currentStep = -1;

  // number the code lines once
  $$('.code .ln').forEach((ln, i) => ln.setAttribute('data-n', i + 1));

  function sizeHScroll() {
    if (!isDesktop()) { hs.style.height = ''; hsDistance = 0; return; }
    const last = stepCards[stepCards.length - 1];
    const gutter = parseFloat(getComputedStyle(track).paddingRight) || 40;
    hsDistance = Math.max(0, last.offsetLeft + last.offsetWidth + gutter - window.innerWidth);
    hs.style.height = `${window.innerHeight + hsDistance}px`;
  }

  function updateStory(vh) {
    const r = story.getBoundingClientRect();
    const total = r.height - vh;
    const p = clamp(-r.top / total);
    const idx = Math.min(3, Math.floor(p * 4));
    const lp = clamp(p * 4 - idx);
    storyBar.style.setProperty('--p', p.toFixed(4));

    if (idx !== currentStep) {
      currentStep = idx;
      storySteps.forEach((s, i) => s.classList.toggle('is-active', i === idx));
      panels.forEach((pn, i) => {
        pn.classList.toggle('is-active', i === idx);
        pn.classList.toggle('is-past', i < idx);
      });
      windowTitle.textContent = titles[idx];
    }

    panels.forEach((pn, i) => {
      $$('[data-at]', pn).forEach(el => {
        const at = parseFloat(el.dataset.at);
        el.classList.toggle('on', i < idx || (i === idx && lp * 1.25 >= at));
      });
    });

    if (idx === 0) {
      const mins = Math.round(clamp(lp * 1.25) * 390);
      clockValue.textContent = `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
    }
    panels[1].classList.toggle('is-live', idx > 1 || (idx === 1 && lp > 0.55));
  }

  function updateHScroll(vh) {
    if (!hsDistance) {
      stepCards.forEach(c => c.classList.add('is-on'));
      return;
    }
    const r = hs.getBoundingClientRect();
    const p = clamp(-r.top / (r.height - vh));
    track.style.transform = `translate3d(${-p * hsDistance}px,0,0)`;
    stepCards.forEach(c => {
      const left = c.offsetLeft - p * hsDistance;
      c.classList.toggle('is-on', left < window.innerWidth * 0.7);
    });
  }

  let ticking = false;
  function onScroll() {
    ticking = false;
    const y = window.scrollY;
    const vh = window.innerHeight;
    const max = document.documentElement.scrollHeight - vh;
    progressBar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;

    // nav: solid after leaving the top, hide on scroll down, show on scroll up
    nav.classList.toggle('is-scrolled', y > 20);
    if (!nav.classList.contains('is-open')) {
      if (y > lastY + 4 && y > 400) nav.classList.add('is-hidden');
      else if (y < lastY - 4) nav.classList.remove('is-hidden');
    }
    lastY = y;

    // hero: content drifts up and fades, particles scatter
    const hp = clamp(y / (H * 0.85));
    scatter = reduceMotion ? 0 : hp;
    if (!reduceMotion) {
      heroContent.style.transform = `translate3d(0,${y * 0.25}px,0)`;
      heroContent.style.opacity = String(clamp(1 - hp * 1.3));
    } else {
      draw();
    }

    updateStory(vh);
    updateHScroll(vh);
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });

  /* ------------------------------------------------------------------
     Nav: mobile menu + current-section highlight
     ------------------------------------------------------------------ */
  const toggle = $('#nav-toggle');
  const setMenu = open => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.style.overflow = open ? 'hidden' : '';
  };
  toggle.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  $$('#nav-links a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  const navLinks = $$('.nav__links a:not(.btn)');
  const sectionObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      navLinks.forEach(a => a.classList.toggle('is-current', a.getAttribute('href') === `#${e.target.id}`));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  navLinks.forEach(a => { const s = $(a.getAttribute('href')); if (s) sectionObs.observe(s); });

  /* ------------------------------------------------------------------
     Reveal on scroll
     ------------------------------------------------------------------ */
  const revealObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); revealObs.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  $$('[data-reveal]').forEach(el => revealObs.observe(el));

  /* ------------------------------------------------------------------
     Service cards: glow follows the pointer
     ------------------------------------------------------------------ */
  $$('.card').forEach(card => {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });

  /* ------------------------------------------------------------------
     Savings calculator
     ------------------------------------------------------------------ */
  const WEEKS = 46, WEEK_HOURS = 37.5;
  const inHours = $('#c-hours'), inPeople = $('#c-people'), inRate = $('#c-rate');
  const outs = { hours: $('#r-hours'), weeks: $('#r-weeks'), cost: $('#r-cost') };
  const shown = { hours: 0, weeks: 0, cost: 0 };
  const fmt = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
  const fmt1 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });
  let tweenId = null;

  function setFill(input) {
    const pct = ((input.value - input.min) / (input.max - input.min)) * 100;
    input.style.setProperty('--fill', `${pct}%`);
  }

  function render(vals) {
    outs.hours.textContent = fmt.format(vals.hours);
    outs.weeks.textContent = fmt1.format(vals.weeks);
    outs.cost.textContent = `£${fmt.format(vals.cost)}`;
  }

  function calc() {
    [inHours, inPeople, inRate].forEach(setFill);
    $('#o-hours').textContent = inHours.value;
    $('#o-people').textContent = inPeople.value;
    $('#o-rate').textContent = `£${inRate.value}`;

    const hours = inHours.value * inPeople.value * WEEKS;
    const target = { hours, weeks: hours / WEEK_HOURS, cost: hours * inRate.value };

    if (reduceMotion) { Object.assign(shown, target); return render(shown); }
    cancelAnimationFrame(tweenId);
    const from = { ...shown };
    const start = performance.now();
    const dur = 500;
    const tick = now => {
      const k = clamp((now - start) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      for (const key in target) shown[key] = from[key] + (target[key] - from[key]) * e;
      render(shown);
      if (k < 1) tweenId = requestAnimationFrame(tick);
    };
    tweenId = requestAnimationFrame(tick);
  }
  [inHours, inPeople, inRate].forEach(i => i.addEventListener('input', calc));

  // count up the first time the calculator comes into view
  [inHours, inPeople, inRate].forEach(setFill);
  new IntersectionObserver(([e], obs) => {
    if (e.isIntersecting) { calc(); obs.disconnect(); }
  }, { threshold: 0.3 }).observe($('#calculator'));

  /* ------------------------------------------------------------------
     Contact: copy email + brief → mailto
     ------------------------------------------------------------------ */
  const copyBtn = $('#copy-email');
  copyBtn.addEventListener('click', async () => {
    const email = copyBtn.dataset.email;
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      const t = document.createElement('textarea');
      t.value = email;
      document.body.appendChild(t);
      t.select();
      document.execCommand('copy');
      t.remove();
    }
    const label = $('.email__copy-label', copyBtn);
    copyBtn.classList.add('is-done');
    label.textContent = 'Copied ✓';
    setTimeout(() => { copyBtn.classList.remove('is-done'); label.textContent = 'Copy'; }, 2000);
  });

  const form = $('#brief');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(form);
    const name = (fd.get('name') || '').trim();
    const business = (fd.get('business') || '').trim();
    const task = (fd.get('task') || '').trim();
    const freq = fd.get('freq') || 'Not sure';

    let ok = true;
    [['name', name], ['task', task]].forEach(([field, val]) => {
      const el = form.elements[field];
      el.classList.toggle('is-invalid', !val);
      if (!val && ok) { el.focus(); ok = false; }
    });
    if (!ok) return;

    const subject = `Project enquiry${business ? ` from ${business}` : ` from ${name}`}`;
    const body = [
      `Hi Dickon,`,
      ``,
      `Name: ${name}`,
      business ? `Business: ${business}` : null,
      `How often: ${freq}`,
      ``,
      `The task:`,
      task,
      ``,
      `Thanks,`,
      name,
    ].filter(l => l !== null).join('\n');

    window.location.href = `mailto:dickon.collins@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
  $$('#brief input, #brief textarea').forEach(el => el.addEventListener('input', () => el.classList.remove('is-invalid')));

  /* ------------------------------------------------------------------
     Misc
     ------------------------------------------------------------------ */
  $('#year').textContent = new Date().getFullYear();

  sizeHScroll();
  onScroll();
  requestAnimationFrame(() => document.documentElement.classList.add('is-loaded'));

  console.log(
    '%cCCH Solutions%c\nReading the source? We like you already.\nSay hello: dickon.collins@gmail.com',
    'font: 700 20px system-ui; color: #2f8cff;',
    'font: 13px ui-monospace, monospace; color: #8d98ab;'
  );
})();
