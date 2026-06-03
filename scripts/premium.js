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

  // ============ MENU MOBILE (pages internes, nav .cem-nav) ============
  (function(){
    var inner = document.querySelector('.cem-nav .cem-nav-inner');
    if (!inner) return;
    var burger = document.createElement('button');
    burger.type = 'button';
    burger.className = 'cem-burger';
    burger.setAttribute('aria-label', 'Ouvrir le menu');
    burger.setAttribute('aria-expanded', 'false');
    burger.innerHTML = '<span></span><span></span><span></span>';
    inner.appendChild(burger);

    var menu = document.createElement('div');
    menu.className = 'cem-mobile-menu';
    menu.innerHTML =
      '<a href="/#services">Missions</a>' +
      '<a href="/les-comites-sociaux-et-economiques-cse.html">CSE</a>' +
      '<a href="/outils/simulateur-lmnp.html">Simulateur LMNP</a>' +
      '<span class="cem-mm-soon">Facturation électronique <em>Bientôt</em></span>' +
      '<a href="/blog/">Blog</a>' +
      '<a class="cem-mm-cta" href="/#contact">Contact</a>' +
      '<div class="cem-mm-socials">' +
        '<a href="https://www.facebook.com/conseilexpertisemanagement" target="_blank" rel="noopener" aria-label="Facebook"><img src="/images/facebook-blanc-ledix9.svg" alt="Facebook" width="22" height="22"></a>' +
        '<a href="https://www.instagram.com/cem.expertise.comptable/" target="_blank" rel="noopener" aria-label="Instagram"><img src="/images/instagram-blanc-ledix9.svg" alt="Instagram" width="22" height="22"></a>' +
        '<a href="https://www.linkedin.com/company/cem-expertcomptable" target="_blank" rel="noopener" aria-label="LinkedIn"><img src="/images/linkedin-blanc-cem.svg" alt="LinkedIn" width="22" height="22"></a>' +
      '</div>';
    document.body.appendChild(menu);  /* sur body : le backdrop-filter de la nav confinerait un enfant fixed */

    var close = function(){ menu.classList.remove('open'); burger.classList.remove('open'); burger.setAttribute('aria-expanded','false'); document.body.style.overflow=''; };
    burger.addEventListener('click', function(){
      var open = !menu.classList.contains('open');
      menu.classList.toggle('open', open);
      burger.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.style.overflow = open ? 'hidden' : '';
    });
    menu.addEventListener('click', function(e){ if (e.target.closest('a')) close(); });
    window.addEventListener('resize', function(){ if (window.innerWidth > 720) close(); });
  })();

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

  // Active le masquage .sr maintenant qu'on est sûr de pouvoir révéler (fail-safe SEO)
  document.documentElement.classList.add('cem-js');

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

  // Inclut aussi tout élément ayant déjà la classe .sr posée dans le HTML
  document.querySelectorAll('.sr').forEach(function(el){
    if (nodes.indexOf(el) === -1) nodes.push(el);
  });

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
