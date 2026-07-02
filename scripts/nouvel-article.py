#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Générateur d'article de blog CEM — transforme un texte (post Instagram/LinkedIn/
Facebook) en article SEO complet, référencé et intégré au site.

Ce qu'il fait automatiquement :
  1. Crée blog/<slug>.html : meta description, canonical, Open Graph,
     JSON-LD Article, hero, contenu mis en forme, CTA contact.
  2. Injecte le header/footer partagés (via scripts/sync-chrome.py).
  3. Ajoute la carte de l'article en tête de la page /blog/.
  4. Ajoute l'URL au sitemap.xml (lastmod du jour).

Usage :
  python3 scripts/nouvel-article.py \
      --titre "SMIC 2027 : nouvelle revalorisation" \
      --categorie "Social" \
      --description "Le SMIC augmente de X % au 1er janvier 2027. CEM fait le point." \
      contenu.txt

  # ou en collant le texte directement :
  python3 scripts/nouvel-article.py --titre "..." --categorie "..." --description "..." <<'TXT'
  Le texte du post ici...

  ## Un sous-titre
  - un point
  - un autre point
  TXT

Mise en forme du contenu (mini-markdown) :
  ligne vide        → nouveau paragraphe
  ## Titre          → sous-titre <h2>
  - élément         → liste à puces
  1. élément        → liste numérotée
  **texte**         → gras
  > texte           → encadré "Le saviez-vous" (cem-fact)

Après génération : git add -A && git commit && git push (déploiement auto).
"""
import argparse, datetime, html, os, re, subprocess, sys, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
SITE = "https://www.cem-expertcomptable.fr"

def slugify(t):
    t = unicodedata.normalize('NFKD', t).encode('ascii', 'ignore').decode()
    t = re.sub(r"[^a-zA-Z0-9]+", "-", t).strip('-').lower()
    return re.sub(r"-{2,}", "-", t)

def inline(t):
    t = html.escape(t, quote=False)
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", r'<a href="\2">\1</a>', t)  # [texte](url)
    return t

def md_to_html(src):
    """Mini-markdown -> HTML aux classes du site."""
    out, i = [], 0
    lines = src.replace('\r\n', '\n').split('\n')
    while i < len(lines):
        ln = lines[i].rstrip()
        if not ln.strip():
            i += 1; continue
        if ln.startswith('## '):
            out.append('<h2>%s</h2>' % inline(ln[3:].strip())); i += 1; continue
        if ln.startswith('> '):
            buf = []
            while i < len(lines) and lines[i].startswith('> '):
                buf.append(inline(lines[i][2:].strip())); i += 1
            out.append('<div class="cem-fact"><div class="label">Le saviez-vous ?</div><p style="margin:0">%s</p></div>' % '<br>'.join(buf)); continue
        if re.match(r'^[-•] ', ln):
            buf = []
            while i < len(lines) and re.match(r'^[-•] ', lines[i].rstrip()):
                buf.append('<li>%s</li>' % inline(lines[i].rstrip()[2:].strip())); i += 1
            out.append('<ul>%s</ul>' % ''.join(buf)); continue
        if re.match(r'^\d+[.)] ', ln):
            buf = []
            while i < len(lines) and re.match(r'^\d+[.)] ', lines[i].rstrip()):
                buf.append('<li>%s</li>' % inline(re.sub(r'^\d+[.)] ', '', lines[i].rstrip()))); i += 1
            out.append('<ol>%s</ol>' % ''.join(buf)); continue
        # paragraphe : accumule jusqu'à la ligne vide
        buf = []
        while i < len(lines) and lines[i].strip() and not re.match(r'^(## |> |[-•] |\d+[.)] )', lines[i].rstrip()):
            buf.append(inline(lines[i].strip())); i += 1
        out.append('<p>%s</p>' % ' '.join(buf))
    return '\n\n      '.join(out)

TEMPLATE = '''<!DOCTYPE html>
<html lang="fr-FR">
<head>
<title>{titre_esc} — Le saviez-vous ? CEM</title>
<meta name="description" content="{desc_esc}">
<link rel="canonical" content-type="text/html" href="{url}">
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="index, follow, max-image-preview:large"><link rel="shortcut icon" href="/images/a-gabarit-favicon.ico"><link rel="icon" type="image/svg+xml" href="/images/favicon.svg"><link rel="manifest" href="/site.webmanifest"><meta name="theme-color" content="#0b1d3a"><link rel="stylesheet" href="/css/sub.css"><link rel="stylesheet" href="/css/premium.css"><script src="/scripts/premium.js" defer></script>
<meta property="og:title" content="{titre_esc} — Le saviez-vous ? CEM">
<meta property="og:description" content="{desc_esc}">
<meta property="og:type" content="article">
<meta property="og:url" content="{url}">
<meta property="og:locale" content="fr_FR">
<meta property="og:image" content="{site}/images/logo-blanc-cem.svg">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">{{"@context":"https://schema.org","@type":"Article","headline":"{titre_json}","description":"{desc_json}","datePublished":"{date}","author":{{"@type":"Organization","name":"CEM Expert-comptable","url":"{site}/"}},"publisher":{{"@type":"Organization","name":"CEM","logo":{{"@type":"ImageObject","url":"{site}/images/logo-blanc-cem.svg"}}}},"mainEntityOfPage":"{url}","inLanguage":"fr-FR","articleSection":"{cat_json}"}}</script>
</head>
<body>
<a href="#main" class="skip-link">Aller au contenu</a>
<header class="cem-nav"></header>
<main id="main">
  <section class="cem-hero">
    <div class="wrap">
      <p class="crumbs"><a href="/">Accueil</a> / <a href="/blog/">Blog</a> / {cat_esc}</p>
      <span class="eyebrow">Le saviez-vous ?</span>
      <h1>{titre_esc}</h1>
      <p class="lead">{lead_esc}</p>
    </div>
  </section>
  <section class="cem-content">
    <article class="cem-article"><div class="wrap-narrow">
    <div class="meta"><span class="tag">{cat_esc}</span><time datetime="{date}">{date}</time></div>

      {corps}

      <h2>Besoin d'un conseil personnalisé ?</h2>
      <p><a href="/#contact">Parlons de votre situation</a> — l'équipe CEM vous accompagne à Agde et Paris.</p>

    <div style="margin-top:48px;padding-top:24px;border-top:1px solid #e3e7ef;"><p><a href="/blog/">← Retour au blog</a></p></div>
  </div></article>
  </section>
</main>
<footer class="cem-foot"></footer>
</body>
</html>
'''

def main():
    ap = argparse.ArgumentParser(description="Génère un article de blog CEM depuis un texte de post.")
    ap.add_argument('--titre', required=True)
    ap.add_argument('--categorie', required=True, help='Ex: Fiscalité, Social, Numérique, CSE, Stratégie fiscale')
    ap.add_argument('--description', required=True, help='Meta description (140-160 caractères idéalement)')
    ap.add_argument('--lead', default=None, help='Phrase d\'accroche du hero (défaut: la description)')
    ap.add_argument('--slug', default=None)
    ap.add_argument('--date', default=None, help='AAAA-MM-JJ (défaut: aujourd\'hui)')
    ap.add_argument('contenu', nargs='?', default=None, help='Fichier texte du contenu (sinon: stdin)')
    a = ap.parse_args()

    slug = a.slug or slugify(a.titre)
    date = a.date or datetime.date.today().isoformat()
    lead = a.lead or a.description
    path = 'blog/%s.html' % slug
    url = '%s/blog/%s.html' % (SITE, slug)
    if os.path.exists(path):
        sys.exit('ERREUR: %s existe déjà (utilisez --slug pour en choisir un autre).' % path)

    src = open(a.contenu, encoding='utf-8').read() if a.contenu else sys.stdin.read()
    if not src.strip():
        sys.exit('ERREUR: contenu vide.')

    j = lambda t: t.replace('\\', '\\\\').replace('"', '\\"')
    page = TEMPLATE.format(
        titre_esc=html.escape(a.titre, quote=False), desc_esc=html.escape(a.description, quote=True),
        lead_esc=html.escape(lead, quote=False), cat_esc=html.escape(a.categorie, quote=False),
        titre_json=j(a.titre), desc_json=j(a.description), cat_json=j(a.categorie),
        date=date, url=url, site=SITE, corps=md_to_html(src),
    ).replace('<link rel="canonical" content-type="text/html" href=', '<link rel="canonical" href=')
    open(path, 'w', encoding='utf-8').write(page)
    print('✓ %s créé' % path)

    # Carte en tête du blog (après la carte outil "simulateur")
    idx = open('blog/index.html', encoding='utf-8').read()
    card = ('<a href="/blog/%s.html" class="cem-card sr"><span class="tag">%s</span><h3>%s</h3><p>%s</p>'
            '<span class="arrow">Lire l\'article →</span></a>') % (
            slug, html.escape(a.categorie, quote=False), html.escape(a.titre, quote=False), html.escape(lead, quote=False))
    anchor = 'Ouvrir le simulateur →</span></a>'
    if anchor in idx:
        idx = idx.replace(anchor, anchor + card, 1)
    else:
        idx = idx.replace('<div class="cem-cards">', '<div class="cem-cards">' + card, 1)
    open('blog/index.html', 'w', encoding='utf-8').write(idx)
    print('✓ carte ajoutée en tête de /blog/')

    # Sitemap
    sm = open('sitemap.xml', encoding='utf-8').read()
    if url not in sm:
        blog_line = '<url><loc>%s/blog/</loc>' % SITE
        entry = '  <url><loc>%s</loc><lastmod>%s</lastmod><changefreq>yearly</changefreq><priority>0.7</priority></url>\n' % (url, date)
        i = sm.find(blog_line)
        i = sm.find('\n', i) + 1 if i > -1 else sm.find('</urlset>')
        sm = sm[:i] + entry + sm[i:]
        open('sitemap.xml', 'w', encoding='utf-8').write(sm)
        print('✓ sitemap.xml mis à jour')

    # Header/footer partagés
    subprocess.run([sys.executable, 'scripts/sync-chrome.py'], check=True)
    print('\nArticle prêt : %s' % url)
    print('Pour publier : git add -A && git commit -m "Blog: %s" && git push' % a.titre)

if __name__ == '__main__':
    main()
