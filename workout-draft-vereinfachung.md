# Workout-Draft-System: Vereinfachung & Umsetzungsplan

Erstellt am: 2026-06-15
Basis: `WORKOUT_SAVE_FLOW_ANALYSE.md` (Stand 2026-06-03)

## 1. Ausgangslage

Das bestehende System modelliert "Workout in Bearbeitung" als Sonderzustand
eines echten Workouts (`_isDraft`/`isDraft`-Flags, IDs wie `draft`/`draft-xxx`),
das durch dieselben Pfade läuft wie ein fertiges Workout: Store-Array,
IndexedDB, Sync-Queue, API, Mongoose.

Probleme dadurch:
- `_isDraft` ist Client-only und muss nach jeder API-Antwort manuell
  reappliziert werden (Mongoose strippt es)
- Drafts müssen explizit aus der Sync-Queue herausgehalten werden
  (`queueAction`-Guard)
- Drafts müssen beim Caching/Merge bewahrt werden (`cacheWorkouts`,
  `workoutMerge.js`)
- Tombstones nötig, um gelöschte Drafts nicht wiederauferstehen zu lassen
- Mehrere ID-Formate (`draft`, `draft-xxx` mit/ohne realId, Offline-ID,
  echte ObjectId) → mehrere unterschiedliche Code-Pfade
- 7 dokumentierte Invarianten, die bei jeder Änderung beachtet werden müssen
- Resultat: "Neu starten" und "Editieren" laufen über unterschiedliche
  ID-Pfade und verhalten sich nach App-Resume unterschiedlich (der Bug,
  der diese ganze Analyse ausgelöst hat)

## 2. Zielbild

Klare Trennung von zwei Welten:

- **"Workout in Bearbeitung"** — existiert ausschließlich lokal, kennt
  der Server nicht, hat keine Sync-Queue-Berührung
- **"Workout"** — persistente Entität, existiert auf dem Server, läuft
  über die bestehende, robuste Save-Maschinerie (optimistisches Update,
  Offline-Fallback, Sync-Queue)

### Neue Datenstruktur

Ein einziger localStorage-Eintrag pro Nutzer:

```json
// Key: active_workout_${uid}
{
  "workout": { /* vollständiges, gerade bearbeitetes Workout-Objekt */ },
  "editingWorkoutId": "64f3a2b1...",  // oder null, wenn neu
  "startedAt": "2026-06-15T10:00:00.000Z",
  "lastModifiedAt": "2026-06-15T10:05:30.000Z"
}
```

localStorage statt sessionStorage/IndexedDB, weil es auf iOS/Capacitor
zuverlässig App-Kills und Backgrounding überlebt und synchron lesbar ist.

### "Gibt es ein aktives Workout?"

Genau eine Frage, eine Antwort: **Existiert `active_workout_${uid}` in
localStorage?** Kein `hasDraft`-Getter über das Workouts-Array, kein
`isDraftLike()`, kein `isOpenDraftWorkout()`.

## 3. Neuer Ablauf

**Neues Workout starten**
`active_workout_${uid}` wird mit leerem Workout und `editingWorkoutId: null`
angelegt.

**Bestehendes Workout editieren**
Das reale Workout wird geladen und in dieselbe Struktur geschrieben, diesmal
mit `editingWorkoutId: <realId>`. Aus Sicht von Auto-Save, Lifecycle und
UI-Anzeige ist das identisch zu "Neu starten" — nur dieses eine Feld
unterscheidet die Fälle.

**Auto-Save während der Bearbeitung**
Debounced Writer, schreibt ausschließlich `active_workout_${uid}` (workout +
lastModifiedAt aktualisieren). Kein API-Call, kein IndexedDB-Workouts-Eintrag,
keine Sync-Queue.

**App verlassen / Lifecycle**
Ein einziger Handler (statt sechs) schreibt bei `visibilitychange`,
`pagehide`, `appStateChange`, Route-Leave, `beforeUnmount` denselben
localStorage-Key. Da localStorage über App-Neustarts hinweg erhalten bleibt,
ist der "Draft verschwindet nach Resume"-Bug strukturell ausgeschlossen.

**App-Start / Resume**
Beim Start wird `active_workout_${uid}` gelesen. Existiert er, zeigt
Dashboard/BottomNav den Hinweis und bietet "Fortsetzen" (öffnet
WorkoutDetailView mit diesen Daten) oder "Verwerfen" an.

**Explizites Speichern**
- `editingWorkoutId` vorhanden → `updateWorkout(editingWorkoutId, payload
  mit completed: true)` (bestehende PUT-Logik, Branch C)
- `editingWorkoutId` ist `null` → `createWorkout(payload mit
  completed: true)` (bestehende POST-Logik)
- Bei Erfolg/Queue: `active_workout_${uid}` löschen, Ergebnis ins
  `workouts`-Array übernehmen

**Verwerfen ohne Speichern**
Nur `localStorage.removeItem('active_workout_' + uid)`. Kein API-Call, keine
IndexedDB-Aufräumarbeit nötig, da nie etwas dorthin geschrieben wurde.

## 4. Was entfällt

- `_isDraft` / `isDraft` als Felder auf Workout-Objekten
- `draftTombstones.js` (`isDraftLike`, `filterOutDeletedDrafts`,
  `isDraftDeleted`)
- `hasDraft`, `draftType`, `draftTimestamp` (Getter in userStore)
- `isOpenDraftWorkout()` in DashboardView
- `DETAIL_DRAFT_KEY`, `workout_detail_draft_${uid}`,
  `getDetailDraftKey(uid)`
- `workout_map_${draftId}` + `resolveRealIdFromDraftId()`
- Sonderbehandlung von `draft`/`draft-xxx`-IDs in `updateWorkout`,
  `applyWorkoutLimit`, `cacheWorkouts`, `queueAction`
- Die sechs einzelnen Lifecycle-Handler aus Abschnitt 16 der Analyse
  (→ einer)

## 5. Was unverändert bleibt

Die gesamte Save-Maschinerie für **echte** Workouts bleibt bestehen:
optimistisches Update, 2s-Timeout-Race + lateUpdate, Offline-Fallback,
Sync-Queue, Retry-Logik. Sie wird nur noch **einmal pro Workout** ausgelöst
(beim expliziten Speichern), nicht mehr kontinuierlich während der
Bearbeitung.

## 6. Hinweise / Risiken

- Wird die App während der Bearbeitung wirklich hart beendet (Force-Quit)
  und kommt der OS-Storage unter Druck, könnte ein In-Progress-Draft
  theoretisch verloren gehen — das ist im Sinne der Anforderung
  ("nur explizit Gespeichertes ist sicher") akzeptabel, sollte aber kurz
  auf einem echten Gerät getestet werden.
- Während der Migration sollten alte und neue Anzeige-Logik nicht
  gleichzeitig aktiv sein (Phase 4 schaltet hart um), sonst können
  kurzzeitig zwei unterschiedliche "aktives Workout"-Zustände entstehen.

## 7. Migrationsplan (Phasen)

1. Neues, isoliertes Modul `activeWorkoutDraft.js` — additiv, ungenutzt
2. WorkoutDetailView befüllt beim Start/Edit zusätzlich (parallel) den
   neuen Draft — Altsystem unverändert
3. Auto-Save + Lifecycle-Handler auf das neue Modul umstellen, alte
   Server/IndexedDB-Calls aus diesem Pfad entfernen
4. BottomNav/Dashboard auf neue Quelle (`hasActiveDraft`) umstellen
5. `performSaveWorkout()` auf zwei Fälle reduzieren
   (editingWorkoutId ja/nein), Cleanup über `clearActiveDraft`
6. "Verwerfen"-Funktion + App-Start-Resume-Dialog auf neues Modul
7. Altsystem vollständig entfernen (siehe Abschnitt 4)

---

# Prompt-Plan für die Umsetzung

Jeder Prompt baut auf dem vorherigen auf. Vor jedem Schritt: vorherigen
Schritt abschließen und kurz testen. Verweise im Prompt jeweils auf
`WORKOUT_SAVE_FLOW_ANALYSE.md` und dieses Dokument als Kontext.

### Prompt 1 — Neues Modul (isoliert)

```
Kontext: WORKOUT_SAVE_FLOW_ANALYSE.md und workout-draft-vereinfachung.md
(Abschnitt 2 und 7, Phase 1).

Erstelle ein neues Modul client/src/utils/activeWorkoutDraft.js mit
folgenden Funktionen:

- getActiveDraft(uid): liest active_workout_${uid} aus localStorage,
  gibt das geparste Objekt oder null zurück
- setActiveDraft(uid, workout, editingWorkoutId): schreibt
  { workout, editingWorkoutId, startedAt, lastModifiedAt } 
  (startedAt nur beim ersten Schreiben setzen, sonst beibehalten)
- updateActiveDraft(uid, workout): aktualisiert nur workout +
  lastModifiedAt, wenn ein Draft existiert
- clearActiveDraft(uid): entfernt den Key
- hasActiveDraft(uid): boolean

Binde das Modul NOCH NICHT in bestehenden Code ein - rein additiv,
isoliert. Zeig mir den Code, bevor du etwas anderes änderst.
```

### Prompt 2 — Parallel befüllen beim Start/Edit

```
Kontext: wie oben, Phase 2.

In WorkoutDetailView.vue: Beim Start eines neuen Workouts UND beim
Öffnen zum Editieren eines bestehenden Workouts soll zusätzlich
(parallel zum bestehenden System, das unverändert bleibt)
setActiveDraft(uid, workout, editingWorkoutId) aus dem neuen Modul
aufgerufen werden. editingWorkoutId ist die echte MongoDB-ID beim
Editieren, sonst null.

Ändere NICHTS an der bestehenden Draft-/_isDraft-Logik. Zeig mir
zuerst, an welchen Stellen (Zeilennummern) du das einfügen würdest,
bevor du es umsetzt.
```

### Prompt 3 — Auto-Save & Lifecycle umstellen

```
Kontext: wie oben, Phase 3.

Stelle den Auto-Save-Pfad (Deep-Watcher -> triggerAutoSave ->
runAutoSaveNow) so um, dass er NUR noch updateActiveDraft(uid, workout)
aus dem neuen Modul aufruft (debounced). Entferne aus diesem Pfad alle
bestehenden Aufrufe von saveWorkoutOffline / store.updateWorkout.

Konsolidiere danach die Lifecycle-Handler aus Abschnitt 16 der Analyse
(visibilitychange, pagehide, beforeunload, Capacitor appStateChange,
Route-Leave, beforeUnmount) zu EINEM gemeinsamen Handler, der ebenfalls
nur updateActiveDraft(uid, workout) aufruft.

Zeig mir zuerst einen Plan mit betroffenen Funktionen/Zeilen, bevor du
etwas änderst.
```

### Prompt 4 — UI-Anzeige umstellen

```
Kontext: wie oben, Phase 4.

Stelle BottomNav und DashboardView so um, dass der Hinweis auf ein
aktives Workout ausschließlich auf hasActiveDraft(uid) aus
activeWorkoutDraft.js basiert - statt auf hasDraft / isOpenDraftWorkout
aus dem userStore.

Entferne die Abhängigkeit dieser beiden Komponenten von
hasDraft/draftType/draftTimestamp, lass die Getter im Store selbst aber
vorerst unangetastet (kommt in Phase 7). Zeig mir die betroffenen
Template- und Script-Stellen vor der Änderung.
```

### Prompt 5 — performSaveWorkout vereinfachen

```
Kontext: wie oben, Phase 5.

Vereinfache performSaveWorkout() in WorkoutDetailView.vue: Statt der
bisherigen Branches (favoriteAdjust, draft, draft-xxx mit/ohne realId,
normale ObjectId) soll es nur noch zwei Fälle geben, basierend auf
editingWorkoutId aus getActiveDraft(uid):

- editingWorkoutId vorhanden -> store.updateWorkout(editingWorkoutId,
  payload mit completed: true, token)
- editingWorkoutId ist null -> store.createWorkout(payload mit
  completed: true, token)

Nach erfolgreichem Speichern bzw. erfolgreichem Einreihen in die
Offline-Queue: clearActiveDraft(uid) aufrufen, Ergebnis ins
workouts-Array übernehmen, dann postSaveCleanup() (ohne die
draft-spezifischen Teile) und Navigation wie bisher.

Zeig mir zuerst eine vollständige Liste der betroffenen Branches und
Aufrufer, bevor du Code änderst.
```

### Prompt 6 — Verwerfen + Resume-Dialog

```
Kontext: wie oben, Phase 6.

Implementiere/prüfe:
1. Eine "Workout verwerfen"-Aktion, die ausschließlich
   clearActiveDraft(uid) aufruft - keine API-Calls, keine
   IndexedDB-Workouts-Änderung.
2. Beim App-Start: getActiveDraft(uid) lesen. Existiert ein Draft,
   zeigt das Dashboard den bestehenden "Workout fortsetzen?"-Hinweis,
   der bei Klick WorkoutDetailView mit workout + editingWorkoutId aus
   dem Draft initialisiert.

Zeig mir zuerst, wo der bestehende Resume-Dialog aktuell seine Daten
herbekommt, bevor du die Quelle umstellst.
```

### Prompt 7 — Altsystem entfernen

```
Kontext: wie oben, Phase 7 / Abschnitt 4.

Phasen 1-6 sind umgesetzt und getestet. Suche jetzt im gesamten Repo
nach allen Vorkommen von:
- _isDraft, isDraft (als Feld auf Workout-Objekten)
- draftTombstones.js und seinen Exporten (isDraftLike,
  filterOutDeletedDrafts, isDraftDeleted)
- hasDraft, draftType, draftTimestamp (userStore-Getter)
- isOpenDraftWorkout
- DETAIL_DRAFT_KEY, workout_detail_draft_${uid}, getDetailDraftKey
- workout_map_${draftId}, resolveRealIdFromDraftId
- draft/draft-xxx-Sonderbehandlung in updateWorkout, applyWorkoutLimit,
  cacheWorkouts, queueAction

Liste mir ALLE Fundstellen mit Datei und Zeilennummer auf, gruppiert
nach Datei - noch ohne etwas zu löschen. Wir entscheiden danach
gemeinsam die Reihenfolge der Entfernung.
```
