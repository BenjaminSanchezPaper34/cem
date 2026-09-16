/* Événements maison Vercel Web Analytics (sans cookie, exempté de consentement) :
   relient un post / une recherche à un appel, un mail, un clic outil. */
(function(){
  function ev(n,p){ try{ window.va && window.va('event',{name:n,data:p||{}}); }catch(e){} }
  document.addEventListener('click',function(e){
    var a=e.target.closest&&e.target.closest('a,button'); if(!a) return;
    var h=(a.getAttribute('href')||'');
    if(h.indexOf('tel:')===0) return ev('tel',{num:h.slice(4)});
    if(h.indexOf('mailto:')===0) return ev('email');
    if(/instagram\.com/.test(h)) return ev('instagram');
    if(/linkedin\.com/.test(h)) return ev('linkedin');
    if(/facebook\.com/.test(h)) return ev('facebook');
    if(/#contact/.test(h)) return ev('contact');
    if(/simulateur-lmnp/.test(h)) return ev('outil_lmnp');
    if(/diagnostic-facturation/.test(h)) return ev('outil_facturation');
    if(a.classList.contains('cem-chat-fab')) return ev('chatbot');
  },{passive:true});
})();
