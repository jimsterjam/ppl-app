# Review-Regeln für fbe – Form Beats Ego

Diese Datei liest der KI-Reviewer (GitHub Copilot) bei jedem Pull Request. Sie sagt, was in diesem
Repo als Fehler zählt. Aufbau, Befehle und feste Absprachen stehen in `CLAUDE.md` und `agents.md`;
bei Widerspruch gelten diese beiden.

## Kurz zum Projekt

- `client/`: Vue 3 + Pinia + Capacitor 7, wird nur als iOS-App genutzt. Texte DE/EN in
  `client/src/i18n/index.js`. Offline-first: Workouts in IndexedDB (`utils/offlineStorage.js`),
  Sync-Warteschlange in `utils/syncManager.js`.
- `server/`: Node/Express 5 + MongoDB/Mongoose auf Render. Auth über Firebase-ID-Token
  (`middleware/firebaseAuth.js`). KI-Feedback in `routes/workouts.js` und `services/`.
- `site/`: statische Website formbeatsego.de, erzeugt aus Plänen, Katalog und Texten der App.
- Eine Person (Jimmy) prüft und mergt. Die meisten PRs schreibt ein Agent.

## Was hier als Fehler zählt (höchste Priorität zuerst)

1. **Daten eines anderen Kontos werden sichtbar.** Einstellungen und laufende Zustände gehören zum
   Konto, nicht zum Gerät: gespeicherte Werte nur über `client/src/utils/userScopedStorage.js`
   (`readPref`/`writePref`), Einträge mit `uid` über `belongsToActiveAccount`. Serverrouten
   filtern immer nach der UID aus dem Token, nie nach einer UID aus dem Request-Body.
2. **Ein Workout geht verloren oder entsteht doppelt** (Offline-Sync, Entwürfe, Tombstones,
   Wiederholungen nach Fehlern). Ein vom Server abgelehnter Save wird vom Client endlos wiederholt –
   Freitext deshalb serverseitig kürzen statt ablehnen (`server/utils/textLimits.js`).
3. **Nutzertext erreicht die KI ungeschützt** oder wird mit `v-html` angezeigt. Vor der KI immer
   einkapseln (`wrapUserNote`, `wrapExerciseName`, `wrapQuickGeneratorFreeText`,
   `wrapCorrectionText`). Request-Bodies nie ungeprüft speichern.
4. **Eine Zahl im KI-Text stammt nicht aus den echten Trainingsdaten**, oder Gewichte/Wiederholungen
   werden falsch gerundet oder umgerechnet.
5. **Ein sichtbarer Text fehlt in DE oder EN**, ist hart codiert (auch `aria-label`,
   `placeholder`, `title`, Toasts), oder nutzt `t('key') || 'Fallback'` (greift nie; ESLint
   meldet nur die direkte Form, über eine Variable oder einen Ternary bleibt es ein Fund). Übungsnamen in der App immer englisch.
6. **Capacitor-Plugin direkt aus einer async-Funktion zurückgegeben oder mit `await` verarbeitet** (z. B.
   `return LocalNotifications`). Auf iOS wirft dann der Abruf von `.then` am Plugin-Proxy; immer über
   `wrapPlugin` (`client/src/utils/capacitorPlugin.js`) weiterreichen. Tests dafür mit dem Proxy-Mock aus
   `capacitorPluginThenable.test.js`, nicht mit einem normalen Objekt.
7. **Ein Test prüft nichts**: Assertion, die immer besteht, Mock statt echter Funktion, Test
   außerhalb der Globs in `server/package.json` bzw. `client/src/**/__tests__/`.
8. **Die Doku lügt**: `CLAUDE.md`, `agents.md`, `site/README.md` oder diese Datei beschreiben
   etwas, das der Diff anders macht, oder eine Zeile darin wird durch den Diff veraltet.

## So schreibst du Funde

- Jeder Fund mit **Datei und Zeile** als Beleg und einem konkreten Ablauf, der zum Fehler führt.
  Keine Vermutung nur aus einem Funktions- oder Variablennamen.
- Fehler, die der PR nicht eingeführt hat, als **„bestehend"** kennzeichnen.
- **Höchstens drei Kleinigkeiten** (Stil, Benennung, Formulierung) pro Review; Formatierung prüft
  Prettier/ESLint.
- Gleiche Fehlerart an mehreren Stellen: einmal nennen und alle Stellen auflisten.
- Einen Fund, der schon in einem früheren Review dieses PRs steht, nicht wiederholen.
- Zusammenfassung beginnt mit der Zahl der Funde. Wenn nichts zu beheben ist, das klar sagen.

## Nicht prüfen

- `client/public/data/default-exercises.json` und `client/public/exercises/**` (Katalog-Rohdaten,
  bekannte Dubletten bleiben bewusst so)
- `client/scripts/i18n-baseline.json`, `**/package-lock.json`
- `client/ios/App/Pods/**`, `client/ios/App/App/public/**`, `client/dist/**`, `site/dist/**`
- Bilder und Binärdateien (PNG, MP4, JPG)

## Bewusst so, kein Fund

- Favoriten (`client/src/utils/workoutFavorites.js`) synchronisieren einfacher als Workouts
  (nur `localStorage` + Server ohne Warteschlange).
- Die Web-Version hat keine Firebase-Web-Konfiguration; die App läuft nur auf iOS.
- Website: Übungsnamen englisch mit deutschem Begriff in Klammern (Ausnahme zur App-Regel).
