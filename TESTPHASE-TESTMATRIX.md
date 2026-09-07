# Testmatrix – Vorbereitung Testphase mit echten Testpersonen

Stand: 2026-09-07. Reine Analyse, keine Code-Änderungen. Basis: Durchsicht von Client
(`client/src`), Server (`server/`) und vorhandener Tests (Vitest im Client, `node --test`
im Server).

## 0. Vor dem Start zu klären / kritische Blocker

Diese Punkte sollten vor oder direkt zu Beginn der Testphase geklärt werden, da sie das
Testergebnis verfälschen oder echte Bugs verdecken/vortäuschen können.

| # | Befund | Datei | Risiko |
|---|---|---|---|
| 1 | Timer-Leave-Guard in `WorkoutDetailView.vue` ist auskommentiert (Zeilen ~2938–2942) | `client/src/views/WorkoutDetailView.vue` | Nutzer kann während laufendem Workout-Timer per Zurück-Geste die Session ohne Warnung verlassen – Datenverlust |
| 2 | `AI_FEEDBACK_MIN_REPETITIONS` / `AI_FEEDBACK_MIN_HISTORY_DAYS` hart auf `1` (Testphase-Kommentar im Code, vor Launch auf 8/28 zurücksetzen) | `server/routes/workouts.js` (Z. 65–81) | Gewollt für Testphase, aber jeder Tester bekommt ab dem 1. Workout „wertendes" KI-Feedback ohne echte Vergleichsbasis – im Testreport vermerken |
| 3 | Wöchentliches Free-Plan-KI-Kontingent (`FREE_AI_WEEKLY_LIMIT`) wird im Haupt-Feedback-Endpoint `/:id/ai-analysis` **nicht** durchgesetzt (nur in `/quick-generator` und `/ai-suggestion`) | `server/routes/workouts.js` | Kontingent-Test für Post-Workout-Feedback läuft ins Leere |
| 4 | Toter Client-Call auf `/api/account/purge` – Endpoint existiert serverseitig nicht (nur `/api/account/delete`) | `client/src/views/SettingsView.vue` (Z. 1252ff.), `server/routes/account.js` | Jede Account-Löschung erzeugt einen sinnlosen fehlschlagenden Request (aktuell folgenlos, aber Code-Leiche) |
| 5 | Bearbeiten eines bereits abgeschlossenen Workouts über direkten Link/Browser-Historie ist technisch nicht gesperrt | `client/src/views/WorkoutDetailView.vue`, `server/routes/workouts.js` (`PUT /:id`) | Ungewollte Überschreibung abgeschlossener Trainingsdaten möglich |
| 6 | Kein globaler Vue-Error-Handler (`app.config.errorHandler`), kein zentrales Express-Error-Middleware | `client/src/main.js`, `server/server.js` | Unerwartete Fehler führen ggf. zu stillem weißen Screen bzw. inkonsistenten Fehlerformaten – ohne Crash-Reporting für Tester kaum nachvollziehbar |
| 7 | Kein Remote-Logging/Crash-Reporting (nur `console.*`, TODO-Kommentar für Sentry etc. vorhanden aber ungenutzt) | `client/src/utils/logger.js`, `server/utils/logger.js` | Fehler bei echten Testpersonen sind ohne aktives Log-Sammeln (`copyDraftDebugLog` in Settings) kaum diagnostizierbar |
| 8 | Ollama-Provider ist nur „im Heimnetzwerk" erreichbar (Kommentar im Code) | `server/services/OllamaProvider.js` | Falls als aktiver Provider konfiguriert, sehen Tester außerhalb des Netzes durchgehend `network_unavailable` |

## 1. Registrierung & Login

**Dateien:** `client/src/utils/firebaseAuth.js`, `client/src/components/WelcomePage.vue`,
`client/src/views/WelcomeView.vue`, `client/src/stores/authStore.js`,
`client/src/utils/authToken.js`, `client/src/main.js`, `client/src/layouts/AuthLayout.vue`,
`server/middleware/firebaseAuth.js`, `server/routes/auth.js`, `server/routes/account.js`

**Vorhandene Tests:** `server/middleware/__tests__/firebaseAuth.test.js` (nur
`isEmailVerifiedFromToken()`), `client/src/utils/__tests__/isEffectivelyEmailVerified.test.js`
(Client-Pendant). Kein Test für Login/Signup-Funktionen, Router-Guards, OAuth-Exchange oder
`authStore.js` selbst.

| Fall | Typ | Schritte / Erwartung |
|---|---|---|
| Email/Passwort-Registrierung erfolgreich | Happy Path | Registrieren → Verifizierungsmail erhalten → Link klicken → Login möglich |
| Google-Login (Web + nativ iOS) | Happy Path | Redirect-Flow (Web) bzw. Plugin-Flow (nativ) führt zu eingeloggtem Zustand |
| Apple-Login (Web + nativ iOS) | Happy Path | Login funktioniert auch wenn Apple `emailVerified` nicht liefert (federated → automatisch als verifiziert behandelt) |
| Login mit falschem Passwort | Fehlerfall | Klartext-Fehlermeldung über `mapAuthError()`, kein Absturz |
| Login mit nicht existierendem Account | Fehlerfall | `auth/user-not-found` korrekt übersetzt |
| Registrierung mit bereits vergebener Email | Fehlerfall | Meldung „bereits verwendet" + Button „Verifizierung erneut senden" (Heuristik auf Fehlertext prüfen, ggf. falsch-negativ) |
| Login ohne Email-Verifizierung | Fehlerfall | Sofortiger `signOut`, Meldung „bitte verifizieren"; serverseitig zusätzlich 403 `EMAIL_NOT_VERIFIED` falls UI-Schutz umgangen wird |
| Verifizierungsmail kommt nicht an | Edge Case | Aktuell nur Server-Log, kein Nutzer-Hinweis bei Mail-Versandfehler – gezielt testen (z. B. ungültige Mail-Domain) |
| OAuth-Abbruch durch Nutzer (Google/Apple) | Edge Case | Native: generische Fehlermeldung; Web-Redirect: App bleibt ohne jede Meldung auf Welcome-Seite – prüfen ob das verwirrend wirkt |
| Login ohne Internetverbindung | Edge Case | `signInWithEmail`/`signUpWithEmail` haben keinen Timeout-Wrapper (anders als OAuth) – Verhalten bei sehr langsamer/instabiler Verbindung (captive portal) gezielt testen |
| Token läuft während Session ab | Edge Case | Offline: Redirect zu `welcome?reason=offline-expired`; Online: Refresh via Firebase bei jeder Navigation – beides einzeln testen |
| Doppeltes schnelles Klicken auf Registrieren | Edge Case | Bekannter, bereits gefixter Race (`suppressWatcher` 5s-Fenster) – kurzes Dashboard-Aufblitzen möglich, gezielt beobachten |
| Passwort mit nur 6 Zeichen via direktem API-Call | Edge Case | Client erzwingt 8 Zeichen + Buchstabe/Zahl, Firebase selbst nur 6 – nicht über UI reproduzierbar, nur relevant falls jemand die API direkt anspricht |

## 2. Navigation & Routing

**Dateien:** `client/src/router/index.js`, `client/src/layouts/AuthLayout.vue`,
`client/src/main.js` (Resume-Snapshot-Logik), `client/src/views/WorkoutDetailView.vue`,
`client/src/utils/workoutDetailNavigationFlow.js`

**Vorhandene Tests:** Keine.

| Fall | Typ | Schritte / Erwartung |
|---|---|---|
| Navigation zwischen allen Bottom-Nav-Tabs | Happy Path | Kein Flackern, korrekte aktive Markierung |
| Geschützte Route ohne Login aufrufen | Happy Path | Redirect zu `welcome?redirect=<ziel>`, nach Login landet man am ursprünglichen Ziel |
| App im Hintergrund/Vordergrund wechseln (Dashboard/Welcome) | Happy Path | Route wird über Resume-Snapshot wiederhergestellt (max. 7 Tage alt) |
| Zurück-Navigation während laufendem Workout-Timer | **Fehlerfall (Regression!)** | Erwartet: Bestätigungsdialog vor Verlassen. Tatsächlich: Guard ist auskommentiert – kein Dialog, siehe Blocker #1 |
| Tab-Wechsel mit ungespeicherten Workout-Änderungen | Edge Case | Nur lokaler Guard in `WorkoutDetailView.vue` (ohne Timer-Warnung), kein globaler „unsaved changes"-Schutz – Verhalten je Zieltab prüfen |
| Direkter Deep-Link auf `#/workouts/<echte-id>` eines fremden/fertigen Workouts | Edge Case | Keine erkennbare Berechtigungsprüfung auf Workout-Ebene – gezielt mit zwei Testaccounts prüfen |
| Auth-Zustand zwischen Router-Guard und `AuthLayout.vue` divergiert | Edge Case | Beide prüfen Login separat und leicht unterschiedlich – z. B. bei sehr langsamer Auth-Hydration (bis 1800ms Polling) beobachten |

## 3. Workout-Erstellung (alle Wege)

**Dateien:** `client/src/components/WorkoutBuilder.vue`, `client/src/utils/exerciseList.js`,
`client/src/utils/activeWorkoutDraft.js`, `client/src/utils/workoutBuilderFlow.js`,
`client/src/utils/workoutFavorites.js`, `client/src/api/favoriteWorkouts.js`,
`server/routes/favoriteWorkouts.js`, `client/src/views/QuickWorkoutGeneratorView.vue`,
`server/routes/workouts.js` (`POST /quick-generator`), `server/utils/workoutSanitizer.js`

**Vorhandene Tests:** `client/src/utils/__tests__/favoriteSaveFlow.test.js`,
`client/src/utils/__tests__/favoriteWorkoutsSync.test.js`,
`server/utils/__tests__/workoutSanitizer.test.js`. Kein Test für den manuellen Builder selbst,
den Quick-Generator-Endpoint (Demo- und OpenAI-Zweig) oder `activeWorkoutDraft.js`.

### 3a) Manueller Builder

| Fall | Typ | Schritte / Erwartung |
|---|---|---|
| Workout-Typ wählen, Übungen hinzufügen, erstellen | Happy Path | Draft wird lokal angelegt (IndexedDB + localStorage), Navigation zu Workout-Detail |
| Erstellen ohne ausgewählte Übungen | Fehlerfall | Button bleibt disabled, keine leere Anfrage möglich |
| Erstellen ohne Login | Fehlerfall | Fehlermeldung „bitte anmelden", Button disabled |
| Workout-Limit erreicht (Subscription) | Fehlerfall | Generische Fehlermeldung ohne technischen Grund – prüfen ob für Tester verständlich |
| Equipment-Filter ergibt leere Übungsliste | Edge Case | Hinweistext „Keine Übungen verfügbar", aber kein Weg, den Filter direkt zurückzusetzen – UX-Test |
| Katalog lädt langsam/schlägt fehl | Edge Case | Mehrstufiger Fallback (`getMergedSortedExercises` → `loadDefaultExercises()` → `normalizedExercises`) gezielt mit gedrosselter Verbindung testen |

### 3b) Aus Favoriten starten

| Fall | Typ | Schritte / Erwartung |
|---|---|---|
| Favorit anlegen und später starten | Happy Path | Werte werden korrekt vorausgefüllt, Auto-Start funktioniert |
| Favorit-Limit (10 pro Typ) erreicht | Fehlerfall | `LIMIT_REACHED`-Meldung |
| Ungültiger Favoriten-Name (Sonderzeichen/leer) | Fehlerfall | `INVALID_NAME`-Meldung |
| Favorit offline anlegen, Server-Sync schlägt fehl | Edge Case | Bleibt nur lokal, **kein** automatischer Retry (anders als Workouts) – erst nächster Login merged; explizit gegentesten |
| Zwei Geräte ändern denselben Favoriten offline | Edge Case | „Last write wins" nach `updatedAt` beim Merge – mit zwei Testgeräten reproduzieren |

### 3c) KI-generiertes Workout (Quick-Generator)

| Fall | Typ | Schritte / Erwartung |
|---|---|---|
| Workout mit Ziel/Level/Typ/Equipment/Dauer generieren | Happy Path | Übungen erscheinen, Übernahme in den Builder möglich |
| OpenAI nicht erreichbar/Quota erschöpft | Fehlerfall | Automatischer Fallback auf statischen Demo-Generator, kein Fehler für Nutzer sichtbar |
| Server nicht erreichbar/Timeout (45s) | Fehlerfall | Fehlermeldung via `handleAPIError`, **kein** Offline-Fallback (anders als beim Speichern) |
| Leere Ergebnisliste vom Server | Fehlerfall | Generische Fehlermeldung `quickGenerator.error` |
| Sehr eingeschränktes Equipment (`bodyweight_only`) | Edge Case | Hinweistext „Auswahl kann ungenauer sein" – gezielt prüfen, ob vorgeschlagene Übungen wirklich ohne Geräte machbar sind (granulares `equipmentAvailability` wird laut Analyse nicht ausgewertet) |
| Free-Plan-Wochenkontingent erschöpft | Edge Case | Fällt still auf Demo-Modus zurück (`generationMode: 'demo_quota_limited'`), UI zeigt das aktuell nicht an – prüfen ob Tester das bemerken/verstehen |
| Burst-Limit (mehrfach kurz hintereinander generieren) | Edge Case | 429 nach 6 Requests/60s erwartet |

## 4. Speichern & Bearbeiten von Workouts

**Dateien:** `client/src/views/WorkoutDetailView.vue`, `client/src/utils/activeWorkoutDraft.js`,
`client/src/utils/workoutDeletion.js`, `server/routes/workouts.js` (`POST /`, `PUT /:id`,
`DELETE /:id`), `server/models/Workout.js`

**Vorhandene Tests:** Kein direkter Test für Save/Update/Delete-Routen oder den Save-Flow in
`WorkoutDetailView.vue`. Indirekt abgedeckt über `favoriteSaveFlow.test.js` (simuliert Logik,
ruft nicht die echte Komponente auf).

| Fall | Typ | Schritte / Erwartung |
|---|---|---|
| Workout ausfüllen und speichern | Happy Path | Sätze werden übernommen, Workout erscheint in Stats/History |
| Workout mit fehlenden Notizen speichern | Happy Path | Modal „Notizen unvollständig" mit Option „Feedback später bewerten" |
| Workout während laufendem Session-Timer speichern | Happy Path | Timer-Guard-Modal, danach korrekte Dauer-Berechnung |
| Speichern ohne Internetverbindung | Fehlerfall | Sollte in Sync-Queue landen und später automatisch nachsynchronisiert werden – explizit mit Flugmodus testen |
| Doppelklick auf Speichern-Button | Edge Case | Guard vorhanden (`saving.value`) – auf tatsächliche Wirksamkeit bei sehr schnellem Doppelklick testen |
| Bereits abgeschlossenes Workout per Deep-Link erneut öffnen und ändern | **Edge Case (Risiko, siehe Blocker #5)** | Aktuell keine Sperre – wird überschrieben inkl. neuer KI-Analyse-Anfrage |
| Workout löschen, das bereits KI-Feedback für ein späteres Workout beeinflusst hat | Edge Case | Nachgelagerte `ai_feedback`-Caches werden korrekt invalidiert (`findWorkoutsAffectedByDeletion`, getestet) – End-to-End mit echtem Folge-Workout verifizieren |
| „Alle Workouts löschen" bei getrennter DB-Verbindung | Edge Case | Server gibt bewusst `200`/`deletedCount:0` statt Fehler zurück – UI-Verhalten dabei prüfen |
| Zwei Geräte bearbeiten dasselbe Workout gleichzeitig online | Edge Case | Kein Konfliktschutz, „last write wins" ohne Warnung – mit zwei Testgeräten gezielt reproduzieren |
| App-Kill mitten in der Satz-Eingabe | Edge Case | Draft wird bei jeder Änderung + Lifecycle-Events gesichert; letzter Tastendruck vor Kill ggf. verloren (kein synchrones Schreiben pro Zeichen) |

## 5. Persistenz / Offline-Verhalten

**Dateien:** `client/src/utils/offlineStorage.js`, `client/src/utils/syncManager.js`,
`client/src/utils/draftTombstones.js`, `client/src/utils/workoutMerge.js`

**Vorhandene Tests:** `client/src/utils/__tests__/workoutMerge.test.js`,
`client/src/utils/__tests__/draftTombstones.test.js`. Kein Test für `syncManager.js`
(Sync-Queue/Retry) oder `offlineStorage.js` (IndexedDB-Operationen) selbst.

| Fall | Typ | Schritte / Erwartung |
|---|---|---|
| Workout offline erstellen, später online gehen | Happy Path | Automatischer Sync (Trigger: `online`-Event, Sichtbarkeitswechsel, 15s-Polling) |
| Workout offline löschen, das noch nicht synchronisiert war | Edge Case | Tombstone verhindert Wiederbeleben durch verspäteten Sync |
| Sync schlägt mit 5xx/Netzwerkfehler fehl | Fehlerfall | Retry mit 45s Backoff (`RETRYABLE_SYNC_BACKOFF_MS`), max. 3 Versuche bei definitiven Fehlern |
| Sync ohne gültigen Auth-Token (Token abgelaufen während offline) | Edge Case | `scheduleNoAuthRetry()` (3s Delay) statt hartem Fehlschlag |
| Über 400 Workouts lokal gespeichert | Edge Case | Älteste werden automatisch entfernt (`MAX_OFFLINE_WORKOUTS`) – mit Testdaten-Menge verifizieren |
| iOS/Safari IndexedDB-Abbruch (bekanntes Plattform-Problem) | Edge Case | Automatischer Retry (2 Versuche, Backoff) bereits eingebaut – auf echtem Gerät unter Last testen |

## 6. KI-Feedback

**Dateien:** `server/routes/workouts.js` (`POST /:id/ai-analysis`, `GET /feedbacks`),
`server/services/AIProvider.js`, `OpenAIProvider.js`, `OllamaProvider.js`,
`server/utils/aiUtils.js`, `server/models/Workout.js`, `server/models/FeedbackRating.js`,
`server/services/feedbackRatingService.js`, `client/src/components/PostWorkoutSummary.vue`,
`AIFeedbackHistory.vue`, `AiFeedbackDeltaSummary.vue`, `AiFeedbackRatingWidget.vue`

**Vorhandene Tests:** `server/utils/__tests__/feedbackRatingService.test.js`,
`client/src/utils/__tests__/feedbackRatingHelpers.test.js`,
`server/utils/__tests__/findWorkoutsAffectedByDeletion.test.js`. Kein Test für `aiUtils.js`,
die Provider-Klassen oder den `/:id/ai-analysis`-Endpoint selbst.

| Fall | Typ | Schritte / Erwartung |
|---|---|---|
| Workout abschließen, KI-Feedback wird generiert | Happy Path | Kurzes, direktes Feedback im neuen „Coach-Chat"-Ton erscheint |
| Feedback mit Daumen hoch/runter bewerten + Korrekturtext | Happy Path | Bewertung wird gespeichert, Korrektur landet erst nach explizitem Opt-in als dauerhafte Notiz |
| „Feedback später bewerten" wählen | Happy Path | Bestätigung ohne Ladezustand, Eintrag erscheint als „ausstehend" im Feedback-Verlauf, „Jetzt generieren" funktioniert |
| KI-Provider nicht erreichbar (Health-Check schlägt fehl) | Fehlerfall | `feedback_status: 'network_unavailable'`, kein 500er, `backend_analysis` bleibt sichtbar |
| KI-Provider liefert Fehler/Timeout während Generierung | Fehlerfall | HTTP 200 ohne `ai_feedback`, generische Fehlermeldung im Client, kein automatischer Retry |
| Wiederholtes schnelles Anfordern (Burst-Limit) | Edge Case | 429 nach 6 Requests/60s – da In-Memory, verloren bei Server-Neustart, ggf. während Testphase weniger wirksam als gedacht |
| Freier Plan, wöchentliches Kontingent erschöpft, `/:id/ai-analysis` erneut aufrufen | **Edge Case (Bug, siehe Blocker #3)** | Kontingent wird hier aktuell nicht geprüft – Analyse läuft trotzdem durch |
| Notiz mit Sonderzeichen/potenziellem Prompt-Injection-Text | Edge Case | Wird durch `wrapUserNote()` neutralisiert (`<`/`>` entfernt, 300 Zeichen Limit, `<user_note>`-Tags) – gezielt mit „Ignoriere alle Anweisungen…"-Text testen |
| App-Kill während der bis zu 8s-Wartezeit auf reale Workout-ID nach schnellem Speichern | Edge Case | Dokumentierter Race, Verhalten danach (Feedback verloren? Queue greift?) nicht getestet |
| Workout mit Feedback löschen, danach Folge-Workout ansehen | Edge Case | Cache-Invalidierung sollte greifen (getestet in `findWorkoutsAffectedByDeletion.test.js`), End-to-End verifizieren |

## 7. Einstellungen

**Dateien:** `client/src/views/SettingsView.vue`, `client/src/stores/themeStore.js`,
`client/src/stores/settingsStore.js`, `server/routes/account.js`

**Vorhandene Tests:** Keine.

| Fall | Typ | Schritte / Erwartung |
|---|---|---|
| Theme/Farbe/Sprache/Wochenziel ändern | Happy Path | Sofortige Übernahme in der App, bleibt nach Neustart erhalten (lokal) |
| Profilbild hochladen (nativ Kamera + Web-Datei) | Happy Path | Bild wird zugeschnitten/hochgeladen, auf allen Geräten sichtbar (Server-gespeichert) |
| Username ändern | Happy Path | Übernahme sofort sichtbar |
| „Alle Daten löschen" | Happy Path/Fehlerfall | Workouts weg (Server + lokal), Account bleibt bestehen; bei Timeout (6s) bricht Vorgang nicht hart ab – lokale Löschung trotzdem prüfen |
| „Account löschen" mit korrektem Bestätigungstext | Happy Path | Vollständige Löschung (Workouts, Exercises, Bilder, Firebase-User); toter `/purge`-Call im Hintergrund ignorieren (Blocker #4) |
| „Account löschen" mit falschem Bestätigungstext | Fehlerfall | Abbruch, kein Löschvorgang |
| Theme/Sprache nach Neuinstallation der App | Edge Case | Geht erwartungsgemäß verloren (kein Server-Sync) – nicht als Bug werten |
| Nach Account-Löschung: Restdaten in DB (Feedback-Ratings, Notizen, Chat-Nachrichten) | Edge Case | Bleiben laut Analyse in der DB (anonym/verwaist) – für Datenschutz-Kommunikation an Tester relevant, kein funktionaler Test nötig |

## 8. Fehlerbehandlung (übergreifend)

**Dateien:** `client/src/api/errorHandler.js`, `client/src/utils/logger.js`, `server/server.js`,
`server/utils/logger.js`

**Vorhandene Tests:** Keine.

| Fall | Typ | Schritte / Erwartung |
|---|---|---|
| 401 durch abgelaufenes Token mitten in einer Eingabe (z. B. Workout-Erstellung) | Edge Case | `handleAPIError` triggert automatischen Redirect zu `/` – prüfen ob dabei unbemerkt Eingaben verloren gehen |
| Netzwerkfehler bei API-Calls, die **nicht** über `errorHandler.js` laufen (viele Komponenten machen eigenes try/catch) | Edge Case | Uneinheitliches Fehlerbild möglich – bewusst mehrere unterschiedliche Views mit Flugmodus testen |
| Unerwarteter Rendering-Fehler in einer Komponente | Edge Case | Kein globaler Vue-Error-Handler – möglicher stiller weißer Screen; gezielt beobachten, ob es dazu kommt |
| Serverseitig unbehandelte Exception außerhalb einer Route | Edge Case | Kein `unhandledRejection`/`uncaughtException`-Handler – im schlimmsten Fall Prozess-Crash ohne Log; für Testphase Render-Logs im Blick behalten |
| Tester meldet „App tut nichts" ohne sichtbare Fehlermeldung | Prozess | Diagnose-Log-Export (`copyDraftDebugLog` in Settings) als Standard-Vorgehen für Bug-Reports etablieren, da kein Remote-Crash-Reporting existiert |

## 9. Zusammenfassung: Test-Reihenfolge-Empfehlung

1. Blocker-Liste (Abschnitt 0) vor dem eigentlichen Testauftakt einmal gezielt durchgehen –
   insbesondere Punkt 1 (Timer-Leave-Guard) und Punkt 5 (Bearbeiten abgeschlossener Workouts),
   da beide zu echtem Datenverlust/-verfälschung führen können.
2. Auth-Flows (Abschnitt 1) mit allen drei Login-Methoden auf mind. zwei echten iOS-Geräten.
3. Alle drei Wege der Workout-Erstellung (Abschnitt 3) inkl. Offline-Varianten.
4. Speichern/Bearbeiten/Löschen (Abschnitt 4) inkl. Mehrgeräte-Konfliktszenario.
5. KI-Feedback (Abschnitt 6), bewusst inkl. Kontingent- und Netzwerk-Fehlerfällen.
6. Einstellungen (Abschnitt 7), insbesondere beide Löschpfade.
7. Fehlerbehandlung/Diagnose-Workflow (Abschnitt 8) einmal bewusst mit Flugmodus/schlechter
   Verbindung durchspielen, um zu sehen, wie „stumm" Fehler tatsächlich sind.
