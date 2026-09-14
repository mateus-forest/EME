// The supplied GSAP files stay local; loading failures leave the CSS/DOM controls usable.
const vendorLoads = new Map();
const landingStates = new WeakMap();
let motionLoad;

function loadVendor(name, src) {
  if (vendorLoads.has(name)) return vendorLoads.get(name);
  const loading = new Promise((resolve, reject) => {
    let script = document.querySelector(`script[data-eme-landing-vendor="${name}"]`);
    if (script?.dataset.loadState === 'loaded') { resolve(); return; }
    if (script?.dataset.loadState === 'failed') { script.remove(); script = null; }
    const existing = Boolean(script);
    if (!script) {
      script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.dataset.emeLandingVendor = name;
      script.dataset.loadState = 'loading';
    }
    let timeout, settled = false;
    const finish = error => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
      script.dataset.loadState = error ? 'failed' : 'loaded';
      if (error) { script.remove(); reject(error); }
      else resolve();
    };
    const onLoad = () => finish();
    const onError = () => finish(new Error(`Landing motion unavailable: ${name}`));
    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);
    timeout = setTimeout(onError, 15000);
    if (!existing) document.head.append(script);
  });
  vendorLoads.set(name, loading);
  void loading.catch(() => { if (vendorLoads.get(name) === loading) vendorLoads.delete(name); });
  return loading;
}

export function loadLandingMotion() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!motionLoad) {
    motionLoad = (async () => {
      await loadVendor('gsap', '/landing-2026/vendor/gsap-3.14.2.min.js');
      await loadVendor('scroll-trigger', '/landing-2026/vendor/ScrollTrigger-3.14.2.min.js');
      if (!window.gsap || !window.ScrollTrigger) throw new Error('Landing motion unavailable');
      return { gsap: window.gsap, ScrollTrigger: window.ScrollTrigger };
    })().catch(() => { motionLoad = undefined; return null; });
  }
  return motionLoad;
}

/** Mount the package interactions inside this landing only, with complete SPA cleanup. */
export function initializeLanding(root, motion = {}) {
  const all = selector => [...root.querySelectorAll(selector)];
  const one = selector => root.querySelector(selector);
  const $ = id => one(`#${id}`);
  const { gsap, ScrollTrigger } = motion || {};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const small = matchMedia('(max-width: 760px)');
  const wide = matchMedia('(min-width: 1600px)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const scene = $('results-scene'), stage = $('card-stage'), word = $('result-word');
  if (!scene || !stage || !word) return () => {};
  const cards = all('.scene-card');
  const selectors = all('[data-choose]');
  const areas = [
    { name: 'Carteira', word: 'MAIS VENDAS.', title: 'Sua carteira em ordem. Mais tempo para atender.', description: 'Clientes e imóveis organizados para encontrar o que precisa e dar continuidade ao atendimento.', features: ['Clientes', 'Imóveis'] },
    { name: 'Vender', word: 'MAIS ALCANCE.', title: 'Sua carteira mais longe. Sua presença mais forte.', description: 'Crie materiais com o Studio IA e distribua seus imóveis pelo catálogo e marketplace. Uma presença com sua identidade e caminhos para captar e qualificar contatos.', features: ['Marketplace', 'Catálogo', 'Studio IA'] },
    { name: 'Documentos', word: 'MAIS VELOCIDADE.', title: 'Clareza para negociar. Agilidade para formalizar.', description: 'Apresente as condições em propostas organizadas e prepare contratos com as informações da negociação. Você revisa cada documento antes de usar.', features: ['Propostas', 'Contratos'] },
    { name: 'Operação', word: 'MAIS CONTROLE.', title: 'Seu dia em ordem. Seu negócio acompanhado.', description: 'Organize compromissos, acompanhe recebimentos e despesas e consulte o desempenho. Mais contexto para planejar sua rotina e acompanhar o negócio.', features: ['Compromissos', 'Financeiro', 'Desempenho'] },
    { name: 'COS', word: 'MAIS OPORTUNIDADES.', title: 'Clareza para decidir. Agilidade para agir.', description: 'Consulte seus dados, encontre pendências e acesse ações rápidas. Uma visão da saúde da operação para escolher o próximo passo.', features: ['Ações rápidas', 'Consultas', 'Saúde da operação'] }
  ];
  const slots = ['active', 'next', 'later', 'earlier', 'previous'];
  // Reinitialization upgrades the same DOM from CSS controls to GSAP without resetting choices.
  const state = landingStates.get(root) || {
    active: Math.max(0, cards.findIndex(card => card.dataset.slot === 'active')),
    manualReduction: false,
    interacted: false,
    introPlayed: false,
    seen: new WeakSet()
  };
  landingStates.set(root, state);
  const seen = state.seen, revealTimelines = new Set();
  const introFurniture = all('.header, .hero-intro h1 > *, .carousel-bar, .area-pills, .hero-bottom, .hero-environment');
  const originalStyles = new Map(all('*').map(element => [element, element.getAttribute('style')]));
  const controller = new AbortController();
  const removeListeners = [];
  const listen = (target, event, handler, options = {}) => {
    target.addEventListener(event, handler, { ...options, signal: controller.signal });
    removeListeners.push(() => target.removeEventListener(event, handler, options));
  };
  let active = state.active, manualReduction = state.manualReduction;
  let intro, swap, ecoTween, touch, pointerFrame = 0, resizeObserver, disposed = false;
  let sectionTriggers = [];
  const motionAllowed = () => Boolean(gsap) && !disposed && !reduced.matches && !manualReduction && !document.hidden;
  if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
  if (gsap) root.dataset.motionEngine = 'gsap';
  else delete root.dataset.motionEngine;

  // The responsive final poses live in CSS; every interrupted tween starts at
  // its current GSAP coordinates rather than jumping to the previous slide.
  function pose(card) {
    const css = getComputedStyle(card);
    const value = name => parseFloat(css.getPropertyValue(name));
    return { xPercent: -50, x: value('--pose-x'), y: value('--pose-y'), z: value('--pose-z'), scale: value('--pose-scale'), rotation: value('--pose-r'), rotationY: value('--pose-ry'), opacity: value('--pose-alpha'), zIndex: value('--pose-layer') };
  }
  function resetPointer() {
    cancelAnimationFrame(pointerFrame); pointerFrame = 0;
    if (gsap) { gsap.killTweensOf(stage); gsap.set(stage, { clearProps: 'transform' }); }
  }
  function stopIntro() {
    intro?.kill(); intro = null;
    if (gsap) gsap.set(introFurniture, { clearProps: 'transform,opacity' });
  }
  function settleHero() {
    stopIntro(); swap?.kill(); swap = null; resetPointer();
    all('.result-outgoing').forEach(element => element.remove());
    if (!gsap) return;
    gsap.set(word, { clearProps: 'transform,opacity' });
    cards.forEach(card => {
      gsap.set(card, pose(card));
      gsap.set(card.querySelector('.card-inner'), { opacity: getComputedStyle(card).getPropertyValue('--quiet').trim() });
    });
    gsap.set(all('.card-art > img'), { clearProps: 'transform' });
  }
  function updateState() {
    state.active = active;
    cards.forEach((card, index) => {
      card.dataset.slot = slots[(index - active + cards.length) % cards.length];
      card.setAttribute('aria-hidden', String(index !== active));
    });
    selectors.filter(button => !button.classList.contains('select-card')).forEach(button => {
      button.setAttribute('aria-pressed', String(Number(button.dataset.choose) === active));
    });
    one('.result-headline').classList.toggle('is-long', areas[active].word.length > 12);
    $('scene-label').textContent = areas[active].name;
    $('result-count').textContent = `${String(active + 1).padStart(2, '0')} / 05`;
    $('result-announcement').textContent = `${areas[active].name}. ${areas[active].word} ${areas[active].title}`;
  }
  function select(index) {
    state.interacted = true;
    const next = (index + areas.length) % areas.length;
    if (next === active) return;
    stopIntro(); swap?.kill(); resetPointer();
    all('.result-outgoing').forEach(element => element.remove());
    const oldWord = word.cloneNode(true);
    oldWord.removeAttribute('id'); oldWord.className = 'result-outgoing';
    active = next; updateState(); word.textContent = areas[active].word;
    if (!motionAllowed()) { settleHero(); return; }
    word.parentElement.append(oldWord);
    const duration = small.matches ? .48 : .8;
    swap = gsap.timeline({ defaults: { ease: 'power3.out' }, onComplete: () => {
      oldWord.remove(); cards.forEach(card => gsap.set(card, { zIndex: pose(card).zIndex }));
    } });
    cards.forEach(card => {
      const target = pose(card), front = card.dataset.slot === 'active';
      const { y, zIndex, ...position } = target;
      gsap.set(card, { zIndex: front ? 6 : zIndex });
      swap.to(card, { ...position, duration }, 0);
      if (front) {
        swap.to(card, { y: y - (small.matches ? 7 : 14), duration: duration * .38, ease: 'power2.out' }, 0)
          .to(card, { y, duration: duration * .62, ease: 'power2.inOut' }, duration * .38);
      } else swap.to(card, { y, duration }, 0);
      swap.to(card.querySelector('.card-inner'), { opacity: getComputedStyle(card).getPropertyValue('--quiet').trim(), duration: duration * .7 }, 0);
      const picture = card.querySelector('.card-art > img');
      if (picture) swap.to(picture, { scale: 1, duration }, 0);
    });
    swap.to(oldWord, { opacity: 0, y: -12, duration: .16 }, 0)
      .fromTo(word, { opacity: 0, y: small.matches ? 17 : 28 }, { opacity: 1, y: 0, duration: small.matches ? .34 : .52 }, small.matches ? .07 : .16);
  }

  function runIntro() {
    if (!motionAllowed() || state.interacted || state.introPlayed) return;
    state.introPlayed = true;
    intro = gsap.timeline({ defaults: { ease: 'power3.out' }, onComplete: () => {
      gsap.set(introFurniture, { clearProps: 'transform,opacity' });
      intro = null;
    } });
    if (!small.matches) intro.fromTo(one('.hero-environment'), { scale: 1.018 }, { scale: 1, duration: 1.8 }, 0);
    intro.fromTo(one('.header'), { opacity: 0, y: -5 }, { opacity: 1, y: 0, duration: .45 }, 0)
      .fromTo(all('.hero-intro h1 > *'), { opacity: 0, y: 8 }, { opacity: 1, y: 0, stagger: .06, duration: .55 }, .12);
    cards.forEach(card => {
      if (!['active', 'next', 'previous'].includes(card.dataset.slot)) return;
      const target = pose(card), front = card.dataset.slot === 'active';
      intro.fromTo(card, { ...target, y: target.y + (small.matches ? 18 : 30), opacity: 0 }, { ...target, duration: small.matches ? .55 : .84 }, front ? .32 : .2);
      const picture = card.querySelector('.card-art > img');
      if (picture && front && !small.matches) intro.fromTo(picture, { scale: 1.045 }, { scale: 1, duration: 1.2 }, .32);
    });
    intro.fromTo(word, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: small.matches ? .5 : .7 }, .45)
      .fromTo(all('.carousel-bar, .area-pills, .hero-bottom'), { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: .45, stagger: .06 }, .55);
  }
  function finishReveals() {
    sectionTriggers.forEach(trigger => trigger.kill()); sectionTriggers = [];
    [...revealTimelines].forEach(timeline => { timeline.progress(1); timeline.kill(); });
    revealTimelines.clear();
  }
  function reveal(element) {
    if (seen.has(element) || !motionAllowed()) return;
    seen.add(element);
    const cleanup = [element], tl = gsap.timeline({ defaults: { ease: 'power3.out' }, onComplete: () => {
      gsap.set(cleanup, { clearProps: 'transform,opacity,--rule-scale' }); revealTimelines.delete(tl);
    } });
    revealTimelines.add(tl);
    const duration = small.matches ? .44 : .72;
    if (element.classList.contains('decision-head')) {
      const lines = element.querySelectorAll('.eyebrow, .decision-line, .decision-head > p');
      cleanup.push(...lines);
      tl.fromTo(lines, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration, stagger: .07 });
    } else if (element.matches('.result-list li')) {
      const number = element.firstElementChild; cleanup.push(number);
      tl.fromTo(element, { opacity: 0, y: 15, '--rule-scale': 0 }, { opacity: 1, y: 0, duration }, 0)
        .fromTo(number, { scale: .82 }, { scale: 1, duration: .5 }, .07)
        .to(element, { '--rule-scale': 1, duration: .7, ease: 'power2.inOut' }, .12);
    } else if (element.classList.contains('decision-card')) {
      tl.fromTo(element, { opacity: 0, y: 24, scale: .98 }, { opacity: 1, y: 0, scale: 1, duration: small.matches ? .5 : .85 });
      if (!small.matches) {
        const light = element.querySelector('.decision-light');
        tl.fromTo(light, { xPercent: -65, opacity: 0 }, { xPercent: 0, opacity: .55, duration: .7, ease: 'power2.inOut' }, .18)
          .to(light, { xPercent: 65, opacity: 0, duration: .8, ease: 'power2.inOut' }, .88);
      }
    } else tl.fromTo(element, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration });
  }
  function setupReveals() {
    if (!motionAllowed() || !ScrollTrigger) return;
    sectionTriggers.forEach(trigger => trigger.kill()); sectionTriggers = [];
    all('.reveal').forEach(element => {
      if (seen.has(element)) return;
      sectionTriggers.push(ScrollTrigger.create({ trigger: element, start: 'top 88%', once: true, onEnter: () => reveal(element) }));
    });
  }
  function syncMotionPreference() {
    const off = reduced.matches || manualReduction;
    state.manualReduction = manualReduction;
    root.classList.toggle('motion-off', off);
    const button = $('motion-toggle');
    button.setAttribute('aria-pressed', String(off)); button.disabled = reduced.matches;
    button.querySelector('span').textContent = reduced.matches ? 'Movimento reduzido' : manualReduction ? 'Ativar movimento' : 'Reduzir movimento';
    settleHero(); finishReveals();
    ecoTween?.progress(1); ecoTween?.kill();
    if (!off) setupReveals();
  }

  const rememberInteraction = () => { state.interacted = true; };
  listen(root, 'pointerdown', rememberInteraction, { passive: true, capture: true });
  listen(root, 'wheel', rememberInteraction, { passive: true, capture: true });
  listen(root, 'keydown', rememberInteraction, { capture: true });
  listen($('next-result'), 'click', () => select(active + 1));
  listen($('previous-result'), 'click', () => select(active - 1));
  selectors.forEach(button => listen(button, 'click', () => {
    select(Number(button.dataset.choose));
    if (button.classList.contains('select-card')) one(`.area-pills [data-choose="${active}"]`).focus({ preventScroll: true });
  }));
  all('.carousel-bar, .area-pills').forEach(group => listen(group, 'keydown', event => {
    let next;
    if (event.key === 'ArrowRight') next = active + 1;
    if (event.key === 'ArrowLeft') next = active - 1;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = 4;
    if (next === undefined) return;
    event.preventDefault(); select(next);
    if (group.classList.contains('area-pills')) group.querySelector(`[data-choose="${active}"]`).focus({ preventScroll: true });
  }));
  listen(scene, 'pointerdown', event => {
    resetPointer();
    if (event.pointerType !== 'touch' || event.target.closest('button')) return;
    touch = { x: event.clientX, y: event.clientY, time: event.timeStamp, id: event.pointerId };
  }, { passive: true });
  listen(scene, 'pointerup', event => {
    const start = touch; touch = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4 && event.timeStamp - start.time < 1000) select(active + (dx < 0 ? 1 : -1));
  }, { passive: true });
  listen(scene, 'pointercancel', () => { touch = null; }, { passive: true });
  listen(scene, 'pointermove', event => {
    if (!motionAllowed() || small.matches || !fine.matches || event.pointerType === 'touch' || scene.contains(document.activeElement)) return;
    cancelAnimationFrame(pointerFrame);
    pointerFrame = requestAnimationFrame(() => {
      pointerFrame = 0;
      if (disposed) return;
      const rect = scene.getBoundingClientRect();
      gsap.to(stage, { x: ((event.clientX - rect.left) / rect.width - .5) * 5, y: ((event.clientY - rect.top) / rect.height - .5) * 3, duration: .6, ease: 'power3.out', overwrite: true });
    });
  }, { passive: true });
  listen(scene, 'pointerleave', resetPointer); listen(scene, 'focusin', resetPointer);
  listen($('motion-toggle'), 'click', () => { state.interacted = true; manualReduction = !manualReduction; syncMotionPreference(); });
  listen(reduced, 'change', syncMotionPreference);
  listen(small, 'change', () => { settleHero(); finishReveals(); setupReveals(); });
  listen(wide, 'change', settleHero);
  listen(fine, 'change', resetPointer);

  const ecoButtons = all('[data-ecosystem]');
  function selectEcosystem(index, focusButton = false) {
    state.interacted = true;
    const area = areas[index];
    ecoButtons.forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.ecosystem) === index)));
    $('eco-label').textContent = area.name; $('eco-title').textContent = area.title; $('eco-description').textContent = area.description;
    $('eco-features').replaceChildren(...area.features.map(feature => { const li = document.createElement('li'); li.textContent = feature; return li; }));
    $('eco-link').href = index === 1 ? '/imoveis' : '/cadastro';
    $('eco-link').firstChild.textContent = index === 1 ? 'Explorar o Marketplace ' : 'Conhecer o EME por dentro ';
    $('eco-announcement').textContent = `${area.name}. ${area.title}`;
    ecoTween?.kill();
    if (motionAllowed()) ecoTween = gsap.fromTo($('eco-detail'), { opacity: .5, y: 7 }, { opacity: 1, y: 0, duration: .32, ease: 'power3.out', onComplete: () => gsap.set($('eco-detail'), { clearProps: 'transform,opacity' }) });
    if (focusButton) ecoButtons.find(button => Number(button.dataset.ecosystem) === index).focus({ preventScroll: true });
  }
  ecoButtons.forEach((button, position) => {
    listen(button, 'click', () => {
      selectEcosystem(Number(button.dataset.ecosystem));
      if (small.matches) { $('eco-title').focus({ preventScroll: true }); $('eco-detail').scrollIntoView({ behavior: motionAllowed() ? 'smooth' : 'instant', block: 'nearest' }); }
    });
    listen(button, 'keydown', event => {
      let target;
      if (['ArrowRight', 'ArrowDown'].includes(event.key)) target = (position + 1) % ecoButtons.length;
      if (['ArrowLeft', 'ArrowUp'].includes(event.key)) target = (position + ecoButtons.length - 1) % ecoButtons.length;
      if (event.key === 'Home') target = 0;
      if (event.key === 'End') target = ecoButtons.length - 1;
      if (target !== undefined) { event.preventDefault(); selectEcosystem(Number(ecoButtons[target].dataset.ecosystem), true); }
    });
  });

  // Smooth anchor scrolling belongs to this page, not the portal's html/body styles.
  listen(root, 'click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href^="#"]');
    if (!link || !root.contains(link)) return;
    const hash = link.getAttribute('href');
    if (hash === '#') return;
    let target;
    try { target = one(`#${CSS.escape(decodeURIComponent(hash.slice(1)))}`); }
    catch { return; }
    if (!target) return;
    event.preventDefault();
    if (window.location.hash !== hash) window.history.pushState(window.history.state, '', hash);
    target.scrollIntoView({ behavior: motionAllowed() ? 'smooth' : 'instant', block: 'start' });
    const tabindex = target.getAttribute('tabindex');
    if (tabindex === null) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    if (tabindex === null) target.removeAttribute('tabindex');
  });
  let sceneWidth = scene.clientWidth;
  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(() => {
      if (disposed || scene.clientWidth === sceneWidth) return;
      sceneWidth = scene.clientWidth; settleHero();
    });
    resizeObserver.observe(scene);
  }
  updateState(); syncMotionPreference(); runIntro();
  function pausePage() { settleHero(); finishReveals(); ecoTween?.progress(1); ecoTween?.kill(); }
  listen(document, 'visibilitychange', () => { if (document.hidden) pausePage(); else setupReveals(); });
  listen(window, 'pagehide', pausePage);
  listen(window, 'pageshow', event => { if (event.persisted) { settleHero(); setupReveals(); } });
  root.dataset.interactionsReady = 'true';

  return () => {
    if (disposed) return;
    disposed = true;
    controller.abort();
    removeListeners.forEach(remove => remove());
    resizeObserver?.disconnect();
    cancelAnimationFrame(pointerFrame);
    pointerFrame = 0;
    touch = null;
    intro?.kill(); swap?.kill(); ecoTween?.kill();
    finishReveals();
    if (gsap) gsap.killTweensOf(stage);
    all('.result-outgoing').forEach(element => element.remove());
    originalStyles.forEach((style, element) => {
      if (style === null) element.removeAttribute('style');
      else element.setAttribute('style', style);
    });
    root.classList.remove('motion-off');
    delete root.dataset.motionEngine;
    delete root.dataset.interactionsReady;
  };
}
