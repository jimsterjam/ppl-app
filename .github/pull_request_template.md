## Was / Warum

<!-- Was ändert sich für Nutzer bzw. im Code, und warum? Backlog-Punkt (z. B. A1) nennen. -->

## Verifiziert

<!-- Je Prüfung genau eine Stufe: getestet / teilweise getestet / fehlgeschlagen / nicht getestet.
     Befehl + Ergebnis nennen. Standard: bash scripts/check-all.sh (Client-Änderung: --build). -->

- Server-Tests (`cd server && npm test`):
- Client-Tests inkl. i18n (`cd client && npm test`):
- Lint (`npm run lint`):
- Client-Build (`cd client && npm run build`):

## Nur per Code-Lektüre geprüft

<!-- Was nicht automatisch getestet ist (z. B. UI auf dem iPhone) und wie es geprüft wurde. -->

## Offene Punkte / Risiken

## iOS-Build nötig?

<!-- Ja bei Client-Änderung: npm run build + npx cap sync ios + Xcode. Sonst: Nein. -->
