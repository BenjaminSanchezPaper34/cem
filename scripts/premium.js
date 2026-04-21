(function(){
  'use strict';

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ============ FADE-IN AU CHARGEMENT ============
  var markLoaded = function(){
    requestAnimationFrame(function(){ document.body.classList.add('cem-loaded'); });
  };
  if (document.readyState === 'complete') markLoaded();
  else window.addEventListener('load', markLoaded, { once: true });

  window.addEventListener('pageshow', function(ev){
    if (ev.persisted) document.body.classList.remove('cem-leaving');
    document.body.classList.add('cem-loaded');
  });

  // ============ TRANSITION DE PAGE ============
  // View Transitions API si dispo, sinon fade-out body
  document.addEventListener('click', function(e){
    if (reduce) return;
    var a = e.target.closest && e.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#') return;
    if (a.target && a.target !== '_self') return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    var url;
    try { url = new URL(a.href, location.href); } catch(_) { return; }
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.search === location.search) return;
    if (a.hasAttribute('download')) return;

    e.preventDefault();
    var go = function(){ window.location.href = a.href; };

    if (document.startViewTransition) {
      document.startViewTransition(function(){
        return new Promise(function(resolve){
          document.body.classList.add('cem-leaving');
          setTimeout(resolve, 50);
          go();
        });
      });
    } else {
      document.body.classList.add('cem-leaving');
      setTimeout(go, 300);
    }
  });

  if (reduce) return;

  // ============ REVEAL ON SCROLL ============
  var selectors = [
    '.shadow.rounded-corners',
    '[id="u553-5"]', '[id="u674-5"]', '[id="u668-5"]',
    '[id^="u988-"]', '[id^="u2412-"]',
    '[id^="u1495-"]', '[id^="u1504-"]',
    '.AccordionPanel',
    '#u354', '#u705', '#u647', '#u1199'
  ];

  var nodes = [];
  selectors.forEach(function(sel){
    document.querySelectorAll(sel).forEach(function(el){
      if (nodes.indexOf(el) === -1) nodes.push(el);
    });
  });
  nodes.forEach(function(el){ el.classList.add('sr'); });

  if (!('IntersectionObserver' in window)) {
    nodes.forEach(function(el){ el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -50px 0px' });
    nodes.forEach(function(el){ io.observe(el); });
  }

  // ============ PARALLAXE HERO ============
  var hero = document.querySelector('#u331 video, #u2653 video');
  if (hero) {
    var ticking = false;
    window.addEventListener('scroll', function(){
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function(){
        var y = Math.min(window.scrollY, 600);
        hero.style.transform = 'translate3d(0,' + (y * 0.15) + 'px,0) scale(' + (1 + y * 0.00015) + ')';
        ticking = false;
      });
    }, { passive: true });
  }
})();
