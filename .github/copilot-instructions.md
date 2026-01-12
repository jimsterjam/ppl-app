Ziel
----
Dieses Repository ist eine kleine Monorepo-App mit einem Vue/Vite/Capacitor-Frontend und einem Node/Express-Backend. Die Datei hier gibt Agenten genau die Informationen, die sie brauchen, um schnell produktiv zu werden (Aufbau, Start-/Build‑Befehle, Konventionen, Integrationspunkte).

Kurzüberblick
--------------
- Architektur: Frontend in `client/` (Vue 3 + Vite + Capacitor), Backend in `server/` (Express, Mongoose optional). Siehe [client/package.json](client/package.json) und [server/package.json](server/package.json).
- API: Backend exponiert REST-Endpunkte unter `/api/*` (Router in `server/routes/`). Schlüsselfiles: [server/server.js](server/server.js), [server/routes/workouts.js](server/routes/workouts.js), [server/routes/exercises.js](server/routes/exercises.js).
- Auth: Server prüft Firebase-ID-Tokens via `server/middleware/firebaseAuth.js` und `server/utils/firebaseAdmin.js` (serviceAccount.json oder env `FIREBASE_ADMIN_CREDENTIAL_JSON`).

Wichtige Befehle / Dev-Workflows
-------------------------------
- Monorepo-Dev (empfohlen): `npm run dev` im Repo-Root startet die standard Dev-Umgebung (siehe `./dev-stable.sh`). Siehe [package.json](package.json).
- Server einzeln: `cd server && npm run dev` (nodemon). Start/Prod: `npm run start` im `server`-Ordner.
- Client einzeln (lokal): `cd client && npm run dev` (Vite). Build: `cd client && npm run build` oder `npm run build` im Root (delegiert).
- Capacitor / iOS helper: `npm run ios`, `npm run cap:sync` aus `client/` (siehe [client/package.json](client/package.json)).

Umgebungsvariablen & Secrets
---------------------------
- Server lädt `server/.env` (dotenv mit relativem Pfad in [server/server.js](server/server.js)).
- Kritisch: `MONGO_URI` ist required (siehe [server/utils/validateEnv.js](server/utils/validateEnv.js)). Fehlt es, beendet der Server den Start.
- Optional / Features: `OPENAI_API_KEY` aktiviert echte OpenAI-Anfragen; ohne Key läuft das Backend in Demo‑/Fallback‑Modus. `PORT` kann überschreiben.
- Firebase Admin: `server/serviceAccount.json` wird verwendet, wenn `FIREBASE_ADMIN_CREDENTIAL_JSON` nicht gesetzt ist.

Daten & Integrationen (wichtige Patterns)
-----------------------------------------
- Bild-Uploads:
  - Übungen: werden in GridFS gespeichert (Bucket-Name: `exerciseImages`) — Suche: `saveToGridFS` / `getExerciseBucket` in [server/server.js](server/server.js).
  - Workouts (Cover): werden als Dateien unter `server/public/uploads/workouts/` geschrieben (siehe `processAndStoreWorkoutImage`).
- Statische Fallback-Daten: Wenn DB leer, nutzt `server/data/exercises.js` als Fallback (siehe [server/routes/exercises.js](server/routes/exercises.js)).
- AI-Integration: `server/routes/workouts.js` initialisiert OpenAI on‑demand. Wenn `OPENAI_API_KEY` vorhanden ist, wird `openai` verwendet, sonst Demo‑Antworten. Agenten sollten die Funktion `generateGPT4Suggestion` / `generateDemoSuggestion` beachten (erwartet JSON-Ausgabe vom Modell).
- DB: Mongo optional — viele endpoints arbeiten auch mit statischen Daten/fallbacks, aber echte persistente Features benötigen `MONGO_URI`.

Konventionen & hilfreiche Hinweise
---------------------------------
- ESM-Only: Projekt nutzt `type: "module"`; verwende `import`/`export` (keine `require`).
- Auth-Konvention: Geschützte Endpunkte verwenden `firebaseAuthMiddleware` → erwartet `Authorization: Bearer <idToken>` Header.
- Logging & env-checks: `server/utils/logger.js` und `server/utils/validateEnv.js` zentralisieren Logging und ENV-Validierung — Änderungen dort beeinflussen Startup/Crash-Verhalten.
- Performance/DB: Routen wie `validateAndMapExercisesWithAutoAdd` bevorzugen Batch-Queries statt Einzelabfragen — folge diesem Muster bei Erweiterungen.

Praktische Beispiele
--------------------
- Starten Server lokal (dev):

  cd server
  npm run dev

- Simpler curl-Test (geschützte Route, ersetze TOKEN und ID):

  curl -H "Authorization: Bearer $TOKEN" -F "image=@./cover.jpg" http://localhost:3001/api/workouts/WORKOUT_ID/image

- API-Health & Test:

  GET http://localhost:3001/api/health
  GET http://localhost:3001/api/test

Was ein Agent vermeiden sollte
----------------------------
- Geheimnisse direkt in Commits: `serviceAccount.json` und `.env` gehören nicht ins Repo (prüfe trotzdem `server/serviceAccount.json` existence fallback).
- Annahmen über DB‑Schema: Verwende vorhandene Models in `server/models/` (z. B. `Workout.js`, `Exercise.js`) statt frei erfundener Felder.

Änderungen an dieser Datei
-------------------------
Wenn du weitere, projekt-spezifische Regeln entdeckst (z. B. CI-Checks, spezielle ESLint/Prettier-Settings), erweitere diese Datei knapp und verlinke die relevanten Dateien.

Feedback
--------
Bitte prüfe diese Zusammenfassung und sag, ob ich Details zu bestimmten Bereichen (z. B. DB-Schema, CI, iOS build flow) ergänzen soll.
