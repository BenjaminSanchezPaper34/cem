/* Popup du jeu concours La Nuit du Trail 2026.
   Affichée une seule fois par visiteur (localStorage), 3 s après l'arrivée,
   jusqu'au 21/10/2026 inclus, jamais sur la page du concours elle-même.
   Fermeture : croix, clic sur le fond, touche Échap. À retirer après le tirage. */
(function () {
  var FIN = new Date('2026-10-22T00:00:00+02:00');
  var CLE = 'cem-pop-ndt2026';
  if (new Date() >= FIN) return;
  if (/nuit-du-trail-2026/.test(location.pathname)) return;
  try { if (localStorage.getItem(CLE)) return; } catch (e) { return; }

  function va(name, data) { try { window.va && window.va('event', { name: name, data: data }); } catch (e) {} }

  function ouvrir() {
    var pop = document.createElement('div');
    pop.className = 'cem-pop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-modal', 'true');
    pop.setAttribute('aria-label', 'Jeu concours La Nuit du Trail');
    pop.innerHTML =
      '<div class="cem-pop-box">' +
        '<button type="button" class="cem-pop-close" aria-label="Fermer">&times;</button>' +
        '<img src="/images/nuit-du-trail-concours-600.webp" width="600" height="800" alt="Jeu concours : 5 dossards à gagner pour La Nuit du Trail Agde, le 31 octobre">' +
        '<div class="cem-pop-txt"><p><strong>5 dossards à gagner</strong> pour La Nuit du Trail, samedi 31 octobre à Agde. Participation sur nos réseaux jusqu\'au 21 octobre.</p>' +
        '<a class="cem-pop-cta" href="/nuit-du-trail-2026?utm_source=site&amp;utm_medium=popup&amp;utm_campaign=nuit-du-trail-2026">Je participe</a></div>' +
      '</div>';
    document.body.appendChild(pop);
    try { localStorage.setItem(CLE, '1'); } catch (e) {}
    va('concours_popup_vue');
    requestAnimationFrame(function () { pop.classList.add('open'); });
    var btn = pop.querySelector('.cem-pop-close');
    btn.focus();
    function fermer() { pop.classList.remove('open'); document.removeEventListener('keydown', esc); setTimeout(function () { pop.remove(); }, 300); }
    function esc(e) { if (e.key === 'Escape') fermer(); }
    btn.addEventListener('click', fermer);
    pop.addEventListener('click', function (e) { if (e.target === pop) fermer(); });
    document.addEventListener('keydown', esc);
    pop.querySelector('.cem-pop-cta').addEventListener('click', function () { va('concours_popup_clic'); });
  }
  setTimeout(ouvrir, 3000);
})();
