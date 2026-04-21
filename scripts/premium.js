(function(){
  'use strict';

  // Fade-in au chargement
  var markLoaded = function(){
    requestAnimationFrame(function(){ document.body.classList.add('cem-loaded'); });
  };
  if (document.readyState === 'complete') markLoaded();
  else window.addEventListener('load', markLoaded, { once: true });

  // Transition de page : fade-out avant navigation interne
  document.addEventListener('click', function(e){
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
    document.body.classList.add('cem-leaving');
    setTimeout(function(){ window.location.href = a.href; }, 320);
  });

  // Restaure la visibilité si retour via bouton "Précédent"
  window.addEventListener('pageshow', function(ev){
    if (ev.persisted) document.body.classList.remove('cem-leaving');
    document.body.classList.add('cem-loaded');
  });
})();
