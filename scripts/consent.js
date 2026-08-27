/* Consentement cookies/services tiers CEM — bloquant (CNIL).
   Aucun service tiers (widgets Elfsight : carte, avis, formulaire, Instagram,
   chatbot) n'est chargé avant accord explicite. Les iframes portent
   data-consent-src (pas de src) ; les emplacements affichent une alternative
   utile + bouton « Autoriser et afficher ». Choix mémorisé en localStorage. */
(function () {
  var KEY = 'cem-consent';
  function get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function set(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  function loadTiers() {
    document.documentElement.classList.add('tiers-ok');
    var frames = document.querySelectorAll('iframe[data-consent-src]');
    for (var i = 0; i < frames.length; i++) {
      var f = frames[i];
      if (!f.getAttribute('src')) f.setAttribute('src', f.getAttribute('data-consent-src'));
    }
  }

  function banner() {
    var b = document.createElement('div');
    b.className = 'cem-consent';
    b.setAttribute('role', 'dialog');
    b.setAttribute('aria-label', 'Gestion des cookies');
    b.innerHTML =
      '<p>Ce site utilise des services tiers (carte, avis Google, formulaire, fil Instagram, chatbot — Elfsight) qui peuvent déposer des cookies. ' +
      'Ils ne sont chargés qu’avec votre accord. <a href="/politique-confidentialite.html">En savoir plus</a></p>' +
      '<div class="cem-consent-btns">' +
      '<button type="button" class="cem-consent-ok">Accepter</button>' +
      '<button type="button" class="cem-consent-no">Continuer sans accepter</button>' +
      '</div>';
    document.body.appendChild(b);
    b.querySelector('.cem-consent-ok').addEventListener('click', function () {
      set('oui'); loadTiers(); b.remove();
    });
    b.querySelector('.cem-consent-no').addEventListener('click', function () {
      set('non'); b.remove();
    });
  }

  function init() {
    // boutons « Autoriser et afficher » des emplacements (valent consentement)
    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('.tiers-allow');
      if (btn) { set('oui'); loadTiers(); var bn = document.querySelector('.cem-consent'); if (bn) bn.remove(); }
    });
    var c = get();
    if (c === 'oui') { loadTiers(); return; }
    if (c === null) banner();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
