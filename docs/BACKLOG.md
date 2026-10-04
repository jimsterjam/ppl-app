# Backlog & Arbeitsstand

**Einzige Quelle für den Arbeitsstand** (offene Aufgaben, bekannte Probleme, Entscheidungen).
Regeln und Absprachen stehen in `CLAUDE.md`, nicht hier. Der Ablauf, mit dem Claude diese Datei
nutzt, steht in `.claude/skills/weiterarbeiten/SKILL.md`.

Aktueller Stand = diese Datei auf `main` **plus** offene PRs von `claude/*`-Branches (eine PR
trägt ihre Backlog-Änderung mit; bis zum Merge steht sie nur dort).

Kennzeichnung: **[A]** autonom erlaubt · **[F]** Freigabe von Paul nötig · **[P]** wartet auf Paul
(Info, Entscheidung oder Handgriff außerhalb des Repos). Priorität: P1 (zuerst) bis P3.

Zuletzt aktualisiert: 2026-10-03

---

## Offen – autonom erlaubt [A]

| # | Prio | Aufgabe | Hinweise |
|---|---|---|---|
| A3 | P2 | Lint-Warnungen abbauen (aktuell 82, v. a. `no-unused-vars`) | Kleine PRs je Bereich, keine Verhaltensänderung, Zahl darf nur sinken. `server/routes` teils erledigt (PR dieser Runde); dort bleiben nur ungenutzte Funktionen in `workouts.js` (`countMatchingCompletedWorkouts`, `validateAndMapExercisesWithAutoAdd`, `estimateWorkoutDurationSeconds`) – Entfernen oder Nutzen klären. Größte Reste: `WorkoutDetailView.vue` (13), `StatsView.vue` (10), `relay/app.test.js` (6). |
| A4 | P3 | Erledigte Planungsdokumente im Root nach `docs/archive/` verschieben | `WORKOUT_FIX_PLAN.md` (komplett ✅), `CODE_OPTIMIZATION_PLAN.md`/`MOBILE_OPTIMIZATION_PLAN.md` (fast fertig), Ollama-Dokumente. **Vorher** Verweise prüfen (Code-Kommentare, `.github/agents/`, `agents.md`) und mit anpassen. |
| A6 | P3 | Tests für Flows aus `TESTPHASE-TESTMATRIX.md` ohne Testabdeckung ergänzen | Erst Lücke benennen, dann je Flow ein kleiner PR. Nur reine Logik (Utils), keine UI-Mount-Tests ohne Infrastruktur. |

## Offen – Freigabe nötig [F]

| # | Aufgabe | Stand / was fehlt |
|---|---|---|
| F1 | Kostenlos = Tracking ohne Limits, KI nur mit Pro | Entscheidung getroffen (01.10.). Umsetzung: `FREE_AI_MONTHLY_LIMIT` → 0, Limits 3 Workouts/Woche + 6 Übungen in `client/src/stores/subscriptionStore.js` entfernen. **Zeitpunkt** mit Paul abstimmen (Tester verlieren KI-Feedback). |
| F2 | In-App-Kauf (StoreKit) für Pro | Offen: RevenueCat oder StoreKit direkt; eine oder zwei Abo-Stufen. Braucht App-Store-Connect-Vertrag (P2). |
| F3 | Stillstand-Diagnose v2 | Rückblick in Einheiten statt 12 Wochen, Berechnung nach Workout-Speichern statt beim Dashboard-Öffnen, „Warum?“-Begründung mit Daten, Antworten „Probiere ich aus / Mache ich bewusst so / Passt nicht“. Nach Tester-Gesprächen (P1). |
| F4 | Modell „Persönlicher Rahmen, ehrlicher Maßstab“ (Trainingsprofil, Phasen wie Diät/krank, Ziel „Halten“) | Konzept im Chat 02.10. Nach Tester-Gesprächen. |
| F5 | Berichte (Monatsanalyse als PDF/CSV) | Neue Abhängigkeit (z. B. `pdfkit`) braucht Freigabe. |
| F6 | KI-Schwellen auf Produktionswerte vor Launch | `AI_FEEDBACK_MIN_REPETITIONS`/`_HISTORY_DAYS` stehen auf 1 (Prod: 8/28) – Render-Variablen, macht Paul. |
| F7 | Crash-Reporting (z. B. Sentry) | Neuer externer Dienst + Datenübertragung. |
| F8 | Android-Version | Zurückgestellt (01.10.), erst App Store fertig. |

## Wartet auf Paul [P]

| # | Was |
|---|---|
| P1 | Tester-Gespräche (Leitfaden im Chat 02.10.) – Notizen an Claude geben |
| P2 | App Store Connect: Bezahlvertrag/Steuer/Bank, Screenshots, Texte, Support-URL, Datenschutzangaben, Demo-Zugang |
| P3 | Impressum/Datenschutz: echte Angaben (beim Wechsel TestFlight → App Store), öffentliche Datenschutz-URL |
| P4 | iOS-Build mit Stand `main` testen: Diagnose (#7/#8), FAQ (#6), Texteingaben (#9), Pausentimer (#10/#11) |

## Bekannte Probleme

- KI-Feedback-Schwellen stehen auf Testwerten (siehe F6).
- Kein Remote-Crash-Reporting; Fehler bei Testern nur über „Debug-Log kopieren“ in den Einstellungen.
- Pro-Upgrade ist ein Schein-Upgrade ohne Zahlung (`server/routes/subscription.js` `/upgrade`).
- Stillstand-Diagnose sieht Bestleistungen älter als 12 Wochen nicht („seit X Wochen“ zu niedrig) – Teil von F3.
- `vitest` hängt in der lokalen Cowork-Sandbox (läuft in CI und Cloud-Sessions).
- Server-Tests laufen nur aus `server/utils/__tests__/*.test.js` (Glob in `server/package.json`).

## Entscheidungen (Log)

Nur Produkt-/Architekturentscheidungen mit Datum. Dauerhafte Arbeitsregeln gehören in `CLAUDE.md`.

- 2026-10-03 – Autonomer Arbeitsmodus: Backlog in `docs/BACKLOG.md`, Ablauf im Skill `weiterarbeiten`.
- 2026-10-02 – Texteingaben werden beim Speichern gekürzt statt abgelehnt (Offline-Sync).
- 2026-10-02 – „Ist so geplant“ blendet Diagnose 6 Wochen aus, danach Nachfrage.
- 2026-10-02 – Diagnose v1 ohne KI-Text: feste Texte mit echten Zahlen (zuverlässig, kostenlos).
- 2026-10-01 – Kostenlos = Tracking ohne Limits; alles mit KI-Aufrufen (Feedback, Diagnose) kostet.
- 2026-10-01 – Android zurückgestellt; zuerst App-Store-Release.
- 2026-09-30 – Timer-Fenster nur noch beim Speichern, nicht beim Verlassen der Seite.

## Erledigt (die letzten 15)

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
- 2026-10-01 – #4 Impressum ohne `v-html`
- 2026-09-30 – #3 Lint-Autofix (240 → 100 Warnungen)
- 2026-09-30 – #2 Timer-Guard-Test an neues Verhalten angepasst
