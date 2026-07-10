# CHERRIFT v0.2.1 FIXED

Javított 0.2-es tesztcsomag.

## Javítás
A korábbi GitHub Pages verzióban az `index.html` már 0.2-es ID-ket/osztályokat használt, de a `style.css` még a régi 0.1-es UI-ra volt írva. Emiatt szétesett a főmenü.

Ebben a csomagban a HTML/CSS/JS újra egymáshoz van igazítva.

## Indítás
Nyisd meg az `index.html` fájlt böngészőben, vagy futtasd lokális szerverrel:

```bash
python -m http.server 8000
```

Majd:
```text
http://localhost:8000
```

## Tartalom
- CHERRIFT főmenü
- 3 skin: Cherry, Sakura Cherry, Bunny Cherry
- skin = kinézet + lövés + skill
- gear = csak stat
- Crimson / Azure / Verdant gear típusok
- Common / Uncommon / Rare gear
- chest nyitás
- inventory + equip
- mobilos bal oldali teljesebb touch movement
- nagy fullscreen gomb
