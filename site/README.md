# fbe-Website (site/)

Statische Website mit Startseite, kostenlosen Werkzeugen (1RM-Rechner, Wiederholungs-Bereiche), Trainingsplänen, Support, Impressum und Datenschutz. Deutsch und Englisch (`/en/`). Getrennt von der App: Die App (`client/`) wird dadurch nicht verändert.

## Befehle (im Projektordner)
- `npm run site:build` baut nach `site/dist` (ohne `SITE_URL` als lokale Vorschau)
- `npm run site:test` führt die Tests aus
- Vorschau: `python3 -m http.server 4173 -d site/dist`, dann http://localhost:4173

## Wie die Seiten entstehen
- Texte: `src/content.mjs` (Deutsch und Englisch, Seitenliste `PAGES`)
- Pläne: aus `client/src/utils/planTemplates.js` und dem Übungskatalog, Namen und Erklärungen aus `client/src/i18n/index.js`. Ändert sich ein Plan in der App, ändert sich die Seite beim nächsten Build.
- Deutsche Übungsbegriffe: `src/exercise-de.mjs` (englischer Name zuerst, deutscher in Klammern). Ein Test meldet fehlende Einträge.
- Impressum und Datenschutz: Betreiberangaben aus `client/src/config/legalOwner.js`, Texte der App aus der i18n-Datei, dazu ein Website-Teil in `src/render.mjs`.
- Rechner: `assets/calc.js` (dieselbe Formel wie `server/utils/stagnationDiagnosis.js`, ein Test vergleicht beide).
- Keine Cookies, keine Zähl- oder Werbedienste, keine Skripte und Schriften von Dritten.

## Veröffentlichen (Render, Static Site)
1. Neuer Dienst: **Static Site**, Repository `jimsterjam/ppl-app`, Branch `main`.
2. **Build Command:** `cd client && npm ci --ignore-scripts && cd .. && node site/build.mjs`
   (Die Texte der App laden `vue-i18n`, deshalb müssen die Pakete von `client/` installiert sein. Mit `node site/build.mjs` allein bricht der Build auf einem frischen Checkout ab. Der Befehl dauert etwa eine halbe Minute.)
3. **Publish Directory:** `site/dist`
4. **Environment Variable:** `SITE_URL` = die Adresse der Website, ohne Schrägstrich am Ende (zum Beispiel `https://deine-adresse.de`).
5. Unter *Settings → Custom Domains* die Adresse eintragen und die genannten DNS-Einträge beim Anbieter der Adresse setzen.
6. Keine Rewrite-Regel `/*` → `/index.html` anlegen (das ist nur für die App nötig).

## Vor der Veröffentlichung prüfen
- Betreiberangaben in `client/src/config/legalOwner.js` sind die richtigen, denn sie stehen dann öffentlich und für Suchmaschinen auffindbar im Netz.
- Der Website-Teil der Datenschutzerklärung (Hosting bei Render, Server-Protokolle) ist ein Entwurf und gehört juristisch geprüft.
- Aussagen über die App stimmen mit der aktuellen App-Version überein (zum Beispiel Zahl der Übungen, KI-Kontingent).
