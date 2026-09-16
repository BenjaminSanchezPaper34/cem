/* Services tiers CEM — modèle opt-out Paper34 (décision studio du 06/09/2026).
   Aucun bandeau à l'arrivée : les services d'affichage (Elfsight : carte,
   avis Google, formulaire, Instagram, chatbot) se chargent par défaut.
   Le visiteur peut couper chaque service à tout moment depuis le panneau
   « Préférences de confidentialité » (lien dans le footer) ; le refus est
   mémorisé dans le navigateur (clé cem-off-<service>) et relu au chargement.
   Un service coupé laisse un encadré de repli avec l'info utile + bouton de
   réactivation. Couper un service déjà chargé impose un rechargement. */
(function () {
  var SERVICES = {
    carte:      'Carte des cabinets (Elfsight / Google Maps)',
    avis:       'Avis clients Google (Elfsight)',
    formulaire: 'Formulaire de contact (Elfsight)',
    instagram:  'Fil Instagram (Elfsight)',
    chatbot:    'Chatbot CEM (Elfsight)'
  };
  function cle(s) { return 'cem-off-' + s; }
  function coupe(s) { try { return localStorage.getItem(cle(s)) === 'off'; } catch (e) { return false; } }
  function couper(s) { try { localStorage.setItem(cle(s), 'off'); } catch (e) {} }
  function rallumer(s) { try { localStorage.removeItem(cle(s)); } catch (e) {} }

  function purgerElfsight() {
    try {
      [localStorage, sessionStorage].forEach(function (st) {
        Object.keys(st).forEach(function (k) { if (/elfsight|eapps/i.test(k)) st.removeItem(k); });
      });
    } catch (e) {}
  }

  // Charge (ou rétablit) un service : iframes data-consent-src + conteneurs .tiers
  function charger(s) {
    var frames = document.querySelectorAll('iframe[data-consent-src][data-service="' + s + '"]');
    for (var i = 0; i < frames.length; i++) {
      var f = frames[i];
      if (!f.getAttribute('src')) f.setAttribute('src', f.getAttribute('data-consent-src'));
      var box = f.closest('.tiers'); if (box) box.classList.remove('off');
    }
    document.documentElement.classList.remove('off-' + s);
  }
  function marquerCoupe(s) {
    document.documentElement.classList.add('off-' + s);
    var frames = document.querySelectorAll('iframe[data-service="' + s + '"]');
    for (var i = 0; i < frames.length; i++) {
      var box = frames[i].closest('.tiers'); if (box) box.classList.add('off');
    }
  }

  function appliquer() {
    Object.keys(SERVICES).forEach(function (s) { if (coupe(s)) marquerCoupe(s); else charger(s); });
  }

  /* --- Panneau de préférences (jamais affiché spontanément) --- */
  var panneau = null;
  function construirePanneau() {
    if (panneau) return panneau;
    panneau = document.createElement('div');
    panneau.className = 'cem-prefs';
    panneau.setAttribute('role', 'dialog');
    panneau.setAttribute('aria-label', 'Préférences de confidentialité');
    var html = '<p class="cem-prefs-titre">Préférences de confidentialité</p>' +
      '<p class="cem-prefs-txt">Ces services externes enrichissent le site et peuvent déposer des cookies. ' +
      'Vous pouvez les désactiver à tout moment. <a href="/politique-confidentialite.html">En savoir plus</a></p><ul>';
    Object.keys(SERVICES).forEach(function (s) {
      html += '<li><span>' + SERVICES[s] + '</span>' +
        '<button type="button" role="switch" data-service="' + s + '" aria-label="Activer ou désactiver : ' + SERVICES[s] + '"><span></span></button></li>';
    });
    html += '</ul><div class="cem-prefs-btns"><button type="button" class="cem-prefs-close">Fermer</button></div>';
    panneau.innerHTML = html;
    document.body.appendChild(panneau);
    panneau.querySelector('.cem-prefs-close').addEventListener('click', fermer);
    panneau.addEventListener('click', function (e) {
      var sw = e.target.closest('button[role="switch"]'); if (!sw) return;
      var s = sw.getAttribute('data-service');
      if (coupe(s)) { rallumer(s); charger(s); peindre(); }
      else { couper(s); purgerElfsight(); window.location.reload(); } // un script tiers exécuté ne se retire pas
    });
    return panneau;
  }
  function peindre() {
    if (!panneau) return;
    var sws = panneau.querySelectorAll('button[role="switch"]');
    for (var i = 0; i < sws.length; i++) {
      var on = !coupe(sws[i].getAttribute('data-service'));
      sws[i].setAttribute('aria-checked', on ? 'true' : 'false');
    }
  }
  function ouvrir() { construirePanneau(); peindre(); panneau.classList.add('open'); }
  function fermer() { if (panneau) panneau.classList.remove('open'); }

  function init() {
    appliquer();
    // Boutons de repli « Réactiver » dans les encadrés coupés
    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('.tiers-allow');
      if (btn) {
        var box = btn.closest('.tiers'); var f = box && box.querySelector('iframe[data-service]');
        var s = f ? f.getAttribute('data-service') : null;
        if (s) { rallumer(s); charger(s); }
        return;
      }
      var lien = e.target.closest && e.target.closest('a[href="#preferences"], .cem-prefs-link');
      if (lien) { e.preventDefault(); ouvrir(); }
    });
    if (window.location.hash === '#preferences') ouvrir();
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fermer(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
