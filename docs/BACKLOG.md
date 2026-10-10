# Backlog & Arbeitsstand

**Einzige Quelle für den Arbeitsstand** (offene Aufgaben, bekannte Probleme, Entscheidungen).
Regeln und Absprachen stehen in `CLAUDE.md`, nicht hier. Der Ablauf, mit dem Claude diese Datei
nutzt, steht in `.claude/skills/weiterarbeiten/SKILL.md`.

Aktueller Stand = diese Datei auf `main` **plus** offene PRs von `claude/*`-Branches (eine PR
trägt ihre Backlog-Änderung mit; bis zum Merge steht sie nur dort).

Kennzeichnung: **[A]** autonom erlaubt · **[F]** Freigabe von Paul nötig · **[P]** wartet auf Paul
(Info, Entscheidung oder Handgriff außerhalb des Repos). Priorität: P1 (zuerst) bis P3.

Zuletzt aktualisiert: 2026-10-10

---

## Offen – autonom erlaubt [A]

| # | Prio | Aufgabe | Hinweise |
|---|---|---|---|
| A3 | P2 | Lint-Warnungen abbauen (aktuell 82, v. a. `no-unused-vars`) | Kleine PRs je Bereich, keine Verhaltensänderung, Zahl darf nur sinken. `server/routes` teils erledigt (PR dieser Runde); dort bleiben nur ungenutzte Funktionen in `workouts.js` (`countMatchingCompletedWorkouts`, `validateAndMapExercisesWithAutoAdd`, `estimateWorkoutDurationSeconds`) – Entfernen oder Nutzen klären. Größte Reste: `WorkoutDetailView.vue` (13), `StatsView.vue` (10), `relay/app.test.js` (6). |
| A4 | P3 | Erledigte Planungsdokumente im Root nach `docs/archive/` verschieben | `WORKOUT_FIX_PLAN.md` (komplett ✅), `CODE_OPTIMIZATION_PLAN.md`/`MOBILE_OPTIMIZATION_PLAN.md` (fast fertig), Ollama-Dokumente. **Vorher** Verweise prüfen (Code-Kommentare, `.github/agents/`, `agents.md`) und mit anpassen. |
| A8 | P3 | Relay-Wecken nur einmal gleichzeitig | `ensureRelayAwake` (`server/utils/aiClientFactory.js`) läuft bei parallelen Aufrufen (Warmup, Analyse, Verifier, Nachladen) mehrfach mit je 25 Anfragen. Auf einen gemeinsamen laufenden Versuch warten. Rein technisch, kein Verhalten für Nutzer. |
| A9 | P3 | Eval-/Qualitäts-Skripte an die FAKTEN-REGEL anpassen | `server/scripts/evalCases/*.js`, `qualityLoopRunner.js`, `regressionTest_aiCoach.js` erwarten noch Texte mit Zahlen/Satzaussagen (alter Prompt). Nicht Teil von CI. Mit echtem KI-Zugang prüfen, wie der neue Prompt wirkt. |
| A10 | P3 | Startton in `WorkoutSplash.vue` lädt `/sounds/start-long.mp3`, die Datei gibt es nicht | `client/public/sounds/` existiert nicht (nie im Repo). Ton klären (Datei ergänzen oder Synthese wie im Timer) – ohne Ton-Entscheidung von Paul nur melden. |
| A11 | P3 | Intervall-Timer-Mitteilungen (`timerStore.js`) ohne Ton | Gleiches Muster wie beim Pausentimer: ohne `sound` stumm im Hintergrund. Nach dem Test des Pausen-Weckers (P4) mit `restEndSignal.js` angleichen. |
| A6 | P3 | Tests für Flows aus `TESTPHASE-TESTMATRIX.md` ohne Testabdeckung ergänzen | Erst Lücke benennen, dann je Flow ein kleiner PR. Nur reine Logik (Utils), keine UI-Mount-Tests ohne Infrastruktur. |

## Offen – Freigabe nötig [F]

| # | Aufgabe | Stand / was fehlt |
|---|---|---|
| F1 | Kostenlos = Tracking ohne Limits, KI nur mit Pro | Entscheidung getroffen (01.10.). Umsetzung: `FREE_AI_MONTHLY_LIMIT` → 0, Limits 3 Workouts/Woche + 6 Übungen in `client/src/stores/subscriptionStore.js` entfernen. **Zeitpunkt** mit Paul abstimmen (Tester verlieren KI-Feedback). |
| F2 | In-App-Kauf (StoreKit) für Pro | Offen: RevenueCat oder StoreKit direkt; eine oder zwei Abo-Stufen. Braucht App-Store-Connect-Vertrag (P2). |
| F3 | Stillstand-Diagnose v2 | Rückblick in Einheiten statt 12 Wochen, Berechnung nach Workout-Speichern statt beim Dashboard-Öffnen, „Warum?“-Begründung mit Daten, Antworten „Probiere ich aus / Mache ich bewusst so / Passt nicht“. Wartet nicht mehr auf Tester-Gespräche (04.10.). |
| F4 | Modell „Persönlicher Rahmen, ehrlicher Maßstab“ (Trainingsprofil, Phasen wie Diät/krank, Ziel „Halten“) | Konzept im Chat 02.10. Wartet nicht mehr auf Tester-Gespräche (04.10.). |
| F5 | Monatsbericht (Pro) | Freigegeben 10.10. Etappen (je ein PR): **1 Server** (Berechnung, Speicherung, Endpunkte `/api/reports/monthly`; Branch `claude/monthly-report-server`, PR offen) · 2 Client (Dashboard-Zeile „Dein Monatsbericht“ statt Coach-Diagnose-Zeile, Berichtsansicht, Texte DE/EN) · 3 Diagramme (Gewichtskurve je Übung wählbar, Wochenbalken; Chart.js ist im Projekt) · 4 PDF (erst Druckansicht/iOS-Teilen testen, sonst Bibliothek – dann Freigabe für neue Abhängigkeit) · 5 Aufräumen (alte Diagnose-Zeile und „Geplant“-Knöpfe entfernen). |
| F6 | KI-Schwellen auf Produktionswerte vor Launch | `AI_FEEDBACK_MIN_REPETITIONS`/`_HISTORY_DAYS` stehen auf 1 (Prod: 8/28) – Render-Variablen, macht Paul. |
| F7 | Crash-Reporting (z. B. Sentry) | Neuer externer Dienst + Datenübertragung. |
| F8 | Android-Version | Zurückgestellt (01.10.), erst App Store fertig. |
| F9 | „KI-Feedback“ ist eine Zusammenfassung | **Teil 1 erledigt (08.10.):** alle Fakten (Zahlen, Sätze, Richtung) schreibt der Code, die KI nur die Einordnung – erzwungen durch `feedbackFactGuard.js`. **Offen:** KI nur für echtes Coaching (Ursache, nächste Einheit, Verlauf über Wochen – vgl. F3/F4), Bezeichnung in der App anpassen („Zusammenfassung“ statt „KI-Feedback“), Preis-/Pro-Frage. |
| F11 | Auswertung auch ohne KI anzeigen | Die fest berechnete Übersicht (Sätze, Gewicht, Wiederholungen, „Nächstes Mal“) braucht keine KI. Fällt die KI aus (Relay-429, Timeout), bleibt das Feedback bisher „Wird erstellt…“. Vorschlag: Übersicht sofort speichern/zeigen, KI-Einordnung nachliefern. Berührt Ablauf, Kontingent und Anzeige – Freigabe nötig. |
| F10 | KI-Relay zuverlässig erreichbar machen | Render Free liefert beim Aufwecken teils 429 (Logs 01.–04.10.), GitHub-Pinger läuft unregelmäßig (Median 16 Min., bis 109 Min.). Optionen: Relay auf Render Starter (~7 $/Monat), Relay als Cloudflare Worker (kostenlos, neuer Dienst), Server auf Starter und Relay weglassen. Entscheidung + Konto/Secrets: Paul. |

## Wartet auf Paul [P]

| # | Was |
|---|---|
| P1 | Tester-Gespräche (Leitfaden im Chat 02.10.) – optional, keine Voraussetzung mehr für F3/F4 (04.10.) |
| P2 | App Store Connect: Bezahlvertrag/Steuer/Bank, Screenshots, Texte, Support-URL, Datenschutzangaben, Demo-Zugang |
| P3 | Impressum/Datenschutz: echte Angaben (beim Wechsel TestFlight → App Store), öffentliche Datenschutz-URL |
| P4 | iOS-Build mit Stand `main` testen: Diagnose (#7/#8), FAQ (#6), Texteingaben (#9), Pausentimer (#10/#11), Pausen-Gong nach App-Wechsel und Pausen-Wecker (AlarmKit, iOS 26) bei gesperrtem Bildschirm und Stumm-Schalter. Xcode: `rest-end.wav` und die vier `rest-alarm-*.wav` in „Copy Bundle Resources“, `RestAlarmPlugin.swift` und `MainViewController.swift` unter „Compile Sources“; **Build-Fehler im Swift-Plugin an Claude melden** (nicht kompiliert). Debug-Log kopieren: `audio-state`, `audio-rearm`, `rest-alarm`, `rest-notification` |

## Bekannte Probleme

- KI-Feedback-Schwellen stehen auf Testwerten (siehe F6).
- KI-Feedback bleibt bis zu 30 Min. auf „Wird erstellt…“, wenn der Relay nicht erreichbar ist (429), erst dann „Nicht erstellt“ – siehe F10.
- Render baut den Relay vom Branch `ai-relay`, nicht von `main`; dort fehlt u. a. `trust proxy` aus `main`.
- Kein Remote-Crash-Reporting; Fehler bei Testern nur über „Debug-Log kopieren“ in den Einstellungen.
- Pro-Upgrade ist ein Schein-Upgrade ohne Zahlung (`server/routes/subscription.js` `/upgrade`).
- Stillstand-Diagnose sieht Bestleistungen älter als 12 Wochen nicht („seit X Wochen“ zu niedrig) – Teil von F3.
- `vitest` hängt in der lokalen Cowork-Sandbox (läuft in CI und Cloud-Sessions).
- Server-Tests laufen nur aus `server/utils/__tests__/*.test.js` (Glob in `server/package.json`).

## Entscheidungen (Log)

Nur Produkt-/Architekturentscheidungen mit Datum. Dauerhafte Arbeitsregeln gehören in `CLAUDE.md`.

- 2026-10-10 – Monatsbericht (Pro, Absprache Paul): Zeitraum 28 Tage, Bericht frühestens 28 Tage nach dem ersten Workout und danach alle 28 Tage, **mindestens 12 Einheiten** im Zeitraum (weniger belegt keinen Fortschritt). Auf dem Server gespeichert (Sammlung `MonthlyReport`, ein Bericht je Nutzer und Erzeugungstag), Konto-Löschung und Datenexport berücksichtigen ihn. Inhalt: Zahlen mit Vormonatsvergleich, Gewichtskurve (tatsächlich bewegtes Gewicht, Übung wählbar), Einheiten je Woche, Stillstand (keine „Geplant“-Knöpfe), Fazit-Schlüssel statt KI-Text. Dauerzeile „Coach-Diagnose“ entfällt; Dashboard-Zeile nur bei neuem Bericht.
- 2026-10-10 – Pausenende außerhalb der App: AlarmKit-Wecker (iOS 26, alle Geräte) statt normaler Mitteilung; Mitteilung nur noch Ersatz (Mitteilungston kam beim Test nicht).
- 2026-10-10 – Pausentimer-Einstellungen: Timer-Knopf öffnet Auswahl „Pausentimer“ / „Workout-Timer“. Pausentimer: Schalter, Pausenzeiten je Ziel (Kraft, Muskelaufbau, Speed) und Übungsart (nur im Gerät gespeichert, Vorrang: gemerkte Pause der Übung > eigener Standard > eingebauter Standard) und Ton am Pausenende (Standard iOS-Wecker + 4 eigene Melodien). Melodien: Noten in `restMelodies.js`, Wecker-Dateien `rest-alarm-<id>.wav` per `node scripts/generate-rest-melodies.mjs` erzeugt (nicht von Hand ändern). Kein „nur Mitteilung“ (Absprache).
- 2026-10-10 – Pausentimer-Einstellungen entschlackt (Absprache Paul): „Pause automatisch starten“ und „groß in der Mitte“ sind fest an (kein Schalter; frühere Geräte-Werte werden ignoriert), Hinweis zum iOS-Standardton entfernt, Stepper −15/+15 verkleinert.
- 2026-10-08 – Fakten vom Code, KI nur Einordnung: Der KI-Text darf keine Zahlen, Satzbezüge und keine Aussage zu Gewicht/Wiederholungen/Sätzen enthalten; entsprechende Zeilen werden entfernt, die Übersicht zeigt die Fakten je Satz.
- 2026-10-04 – KI-Text mit einer Zahl, die nicht aus den Trainingsdaten stammt, wird nicht ausgeliefert (fester Hinweis statt Text).
- 2026-10-04 – Tester-Gespräche sind keine Voraussetzung mehr für neue Coach-Funktionen.
- 2026-10-03 – Autonomer Arbeitsmodus: Backlog in `docs/BACKLOG.md`, Ablauf im Skill `weiterarbeiten`.
- 2026-10-02 – Texteingaben werden beim Speichern gekürzt statt abgelehnt (Offline-Sync).
- 2026-10-02 – „Ist so geplant“ blendet Diagnose 6 Wochen aus, danach Nachfrage.
- 2026-10-02 – Diagnose v1 ohne KI-Text: feste Texte mit echten Zahlen (zuverlässig, kostenlos).
- 2026-10-01 – Kostenlos = Tracking ohne Limits; alles mit KI-Aufrufen (Feedback, Diagnose) kostet.
- 2026-10-01 – Android zurückgestellt; zuerst App-Store-Release.
- 2026-09-30 – Timer-Fenster nur noch beim Speichern, nicht beim Verlassen der Seite.

## Erledigt (die letzten 15)

- 2026-10-10 – Pausen-Wecker (AlarmKit, eigenes Swift-Plugin `RestAlarm`) für das Pausenende bei gesperrtem Bildschirm/Stumm-Schalter, Mitteilung als Ersatz; Swift ungeprüft (P4)
- 2026-10-09 – Pausen-Gong nach App-Wechsel (iOS-Zustand „interrupted“) und Ton der Pausenende-Mitteilung im Hintergrund (`rest-end.wav`); auf dem Gerät noch ungeprüft (P4)
- 2026-10-08 – F9 Teil 1: Fakten je Satz kommen nur noch vom Code (Übersicht inkl. Wiederholungen je Satz), KI-Text ohne Zahlen/Satzaussagen (Auslöser: „Satz 7 von 6 auf 5“, tatsächlich 6 → 6)
- 2026-10-06 – A7 KI-Analyse vergleicht nur noch mit abgeschlossenen Workouts (Entwürfe/unfertige zählen weder als letzte Session noch im Verlauf noch beim Körpergewicht)
- 2026-10-04 – Feedback-Zahlen: 1,25-kg-Schritte genau (31,25 statt 31,3), keine Ø-Gewichte an die KI, KI-Text mit erfundener Zahl wird zurückgehalten
- 2026-10-04 – A5 `server/.env.example` angelegt (nur Namen/Platzhalter), `.gitignore` lässt sie zu
- 2026-10-03 – A2 Testmatrix Abschnitt 0 aktualisiert (#1, #3, #4, #5, #6 erledigt; #2, #7, #8 offen)
- 2026-10-03 – A1 Toter Aufruf `/api/account/purge` aus SettingsView entfernt (Löschung läuft über `/api/account/delete`)
- 2026-10-03 – #11 Pausentimer klappt bei 10 s Restzeit wieder groß auf
- 2026-10-02 – #10 Pausentimer: Expand-Button oben rechts, Warmup-Toggle deutlicher
- 2026-10-02 – #9 Texteingaben: Längengrenzen beim Speichern, Regeln in CLAUDE.md
- 2026-10-02 – #8 Diagnose: eigener Rhythmus, leichte Tage, „Ist so geplant“
- 2026-10-02 – #7 Stillstand-Diagnose (Pro)
- 2026-10-01 – #6 FAQ aktualisiert, neue Einträge Ablauf/Symbole, Ziel-Abfrage 8–12/1–6
- 2026-10-01 – #5 Push/Merge auf `main` für Claude technisch gesperrt
