# CLAUDE.md – PPL Fundamentals (bro-split-app)

Allgemeine Arbeitsregeln, Befehle und Architektur stehen in `agents.md` und gelten vollständig:

@agents.md

Diese Datei ergänzt nur die **festen Absprachen mit Paul** (Projektinhaber) und Dinge, die sonst
bei jeder neuen Sitzung neu gelernt werden müssen. Bei Widerspruch gilt die jüngere Absprache im Chat.

## Feste Absprachen

- **Git führt Paul selbst aus.** Keine `git commit`/`git push` aus der Sandbox. Nach jeder fertigen
  Änderung den exakten Befehl als Codeblock ausgeben (`git add <Dateien>` + `git commit -m "..."`
  + `git push origin main`). Grund: `.git/*.lock`-Dateien aus der Sandbox lassen sich auf dem
  Host-Mount nicht löschen und blockieren danach jedes Git-Kommando. Das gilt auch für scheinbar
  lesende Befehle: `git status` schreibt `.git/index.lock`. Lesend nur mit
  `git --no-optional-locks status` / `git --no-optional-locks diff` arbeiten.
- **Erst vorschlagen, dann umsetzen** bei neuen Features, UI-Änderungen und Formulierungen:
  Vorschlag zeigen, auf Freigabe warten. Klar umrissene Bugfixes dürfen direkt umgesetzt werden.
- **Jeder sichtbare Text in DE und EN** über `t()`/`$t()` und `client/src/i18n/index.js` –
  auch `aria-label`, `placeholder`, `title` und Toast-Meldungen. Keine hartcodierten Strings.
- **Modals** immer: `<Teleport to="body">` + zentriertes Overlay + `useScrollLock()`
  (`client/src/composables/useScrollLock.js`). Schließen des Modals darf laufende Zustände
  (z.B. die Stoppuhr) nicht beenden.
- **Nutzer sind keine Fitness-Experten:** Fachbegriffe (z.B. „Ramp-Up Sets") kurz erklären statt
  voraussetzen; der Begriff darf in Klammern stehen bleiben.
- **KI-Feedback:** Übungsnamen im KI-Text in der App-Sprache (`exerciseNameForAI`), Zahlen im Text
  müssen aus den echten Trainingsdaten stammen (Verifier, `AI_VERIFIER_MODE=active` auf Render).
- Antworten an Paul auf Deutsch, knapp, Ergebnis zuerst.

## Definition of Done (vor jedem Commit-Befehl prüfen)

1. Server: `cd server && npm test` grün.
2. Client: i18n-Check ohne neue Funde – `cd client && npm run i18n:check`
   (läuft zusätzlich als Vitest-Test `src/i18n/__tests__/i18nConsistency.test.js`, also auch in CI
   und im Render-Build).
3. Geänderte `.vue`-Dateien kompilieren (Template + Script), falls `vitest` lokal nicht läuft.
4. Die Abnahmekriterien des freigegebenen Vorschlags einzeln abhaken, inkl. der festen Absprachen
   oben (DE+EN, Modal-Muster).
5. Im Bericht klar trennen: was verifiziert wurde und was nur per Code-Lektüre geprüft ist
   (echte UI-Klicktests gibt es aktuell nicht).

## i18n-Check

- `npm run i18n:check` – nur NEUE Funde, Exit-Code 1 wenn welche da sind
- `npm run i18n:check:all` – alle Funde inkl. Altlasten
- `npm run i18n:baseline` – Baseline neu schreiben, **nur nachdem** Altlasten behoben wurden
  (die Liste `client/scripts/i18n-baseline.json` soll nur schrumpfen, nie wachsen)
- Achtung vue-i18n: ein fehlender Key liefert den Key-String selbst zurück, nicht `undefined`.
  Das Muster `t('a.b') || 'Fallback'` greift deshalb **nie** – der Key muss in DE und EN existieren.

## Infrastruktur

- Render-Workspace `tea-d4dfqujuibrs73b49mbg`; Services: `ppl-app-server`
  (`srv-d4dk4gvgi27c73dmo68g`), `ppl-app-client` (Static Site, `srv-d4dgjquuk2gs73cjd490`),
  `ppl-app-ai-relay` (`srv-daj65flg1s2s739i5elg`). Deploy startet automatisch nach Push auf `main`.
- Render-Env-Vars über das Render-MCP ändern löst einen Redeploy aus. `replace: true` mit leerer
  Liste löscht **alle** Dashboard-Variablen des Service.
- iOS: Client-Änderungen erst nach `npm run build` + `npx cap sync ios` + Xcode-Build sichtbar.

## Bekannte Einschränkungen der Sandbox (Cowork)

- Kein Zugriff auf beliebige externe Hosts (MongoDB Atlas, Firebase Console) – Produktionsdaten
  kopiert Paul bei Bedarf in den Chat.
- Im Repo angelegte Dateien kann die Sandbox nicht wieder löschen. Hilfsskripte (z.B. für die
  SFC-Kompilierung) nur unter `/tmp` ablegen, nie im Projektordner.
- `vitest` hängt in der Sandbox (Rollup-Native-Modul, ARM-Architektur) – läuft aber in CI und
  auf Render. Ersatz lokal: `npm run i18n:check` direkt per Node und SFC-Kompilierung.
- Web-Version (`ppl-app-client.onrender.com`) hat bewusst keine Firebase-Web-Config; die App wird
  nur als iOS-App genutzt.
