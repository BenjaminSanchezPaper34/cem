#!/usr/bin/env python3
"""
Synchronise le header (.cem-nav) et le footer (.cem-foot) de TOUTES les pages
internes à partir d'une source unique : _chrome/header.part et _chrome/footer.part.

=> Pour modifier les onglets / le footer partout : on édite UNIQUEMENT les deux
   fichiers _chrome/*.part, puis on lance ce script.
=> Pour une nouvelle page : on met un <header class="cem-nav"></header> et un
   <footer class="cem-foot"></footer> (même vides) puis on lance ce script ; ils
   héritent automatiquement du header/footer commun. Le balisage reste dans le
   HTML (bon pour le SEO), pas d'injection JS.

Usage:  python3 scripts/sync-chrome.py
"""
import re, glob, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

header = open('_chrome/header.part', encoding='utf-8').read().rstrip('\n')
footer = open('_chrome/footer.part', encoding='utf-8').read().rstrip('\n')

pages = []
for pat in ('*.html', 'blog/*.html', 'outils/*.html'):
    pages += glob.glob(pat)
# Uniquement les pages qui utilisent le design system partagé (sub.css)
pages = [p for p in sorted(set(pages)) if 'css/sub.css' in open(p, encoding='utf-8').read()]

n_head = n_foot = 0
for f in pages:
    s = open(f, encoding='utf-8').read()
    s2, c1 = re.subn(r'<header class="cem-nav">.*?</header>', lambda _: header, s, count=1, flags=re.S)
    s2, c2 = re.subn(r'<footer class="cem-foot">.*?</footer>', lambda _: footer, s2, count=1, flags=re.S)
    n_head += c1; n_foot += c2
    if s2 != s:
        open(f, 'w', encoding='utf-8').write(s2)

print(f"Pages internes : {len(pages)}")
print(f"Headers synchronisés : {n_head}")
print(f"Footers synchronisés : {n_foot}")
print("Source : _chrome/header.part + _chrome/footer.part")
