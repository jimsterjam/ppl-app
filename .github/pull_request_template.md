## Was / Warum

<!-- Was ändert sich für Nutzer bzw. im Code, und warum? Backlog-Punkt (z. B. A1) nennen. -->

## Verifiziert

<!-- Je Prüfung genau eine Stufe: getestet / teilweise getestet / fehlgeschlagen / nicht getestet.
     Befehl + Ergebnis nennen. Standard: bash scripts/check-all.sh (Client-Änderung: --build). -->

- Server-Tests (`cd server && npm test`):
- Client-Tests inkl. i18n (`cd client && npm test`):
- Lint (`npm run lint`):
- Website-Tests (`npm run site:test`):
- Client-Build (`cd client && npm run build`):
- Selbst-Review vor dem PR (`/code-review`, bei Auth/Speicher/Eingaben auch `/security-review`): Zahl der Funde und was behoben ist

## Nur per Code-Lektüre geprüft

<!-- Was nicht automatisch getestet ist (z. B. UI auf dem iPhone) und wie es geprüft wurde. -->

## Risiko

<!-- niedrig (Doku, Texte, Website) / mittel (normale App- oder Server-Änderung) /
     hoch (Offline-Sync, Auth, Konto-Speicher, Abo, KI-Pipeline). Was kann im schlimmsten Fall passieren? -->

## Wie zurücknehmen

<!-- Server/Website: Revert-PR oder auf Render den vorherigen Deploy wiederherstellen.
     iOS: nicht zurückrollbar, nur durch ein neues Update ersetzbar – daher bei Client-Änderungen sorgfältiger.
     Datenänderungen: wie lassen sie sich rückgängig machen? -->

## Offene Punkte

## iOS-Build nötig?

<!-- Ja bei Client-Änderung: npm run build + npx cap sync ios + Xcode. Sonst: Nein. -->
