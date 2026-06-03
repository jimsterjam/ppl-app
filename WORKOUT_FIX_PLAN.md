# WORKOUT_FIX_PLAN.md

Priorisierter Fix-Plan auf Basis von `WORKOUT_SAVE_BUGS.md` (Stand nach Commit `117d1cb`).

**Priorisierungs-Prinzipien:**
1. Root Causes vor Symptomen
2. Fixes ohne Abhängigkeiten zu anderen Bugs zuerst
3. Fixes mit hohem Seiteneffekt-Risiko ans Ende
4. Akzeptierte Tradeoffs werden nicht gefixt (Bug 8)

---

### ~~Schritt 1: `runAutoSaveNow` – fehlendes `_isDraft: true` im Draft-Branch~~ ✅ ERLEDIGT

- **Behebt Bug:** 2
- **Änderungen an:** `client/src/views/WorkoutDetailView.vue` (~L1166, `runAutoSaveNow()` Branch `draft-*` mit realId)
- **Voraussetzung:** keine
- **Regressions-Risiko:** niedrig

**Begründung:** Einzeilige Payload-Ergänzung (`_isDraft: true, isDraft: true`). Keine Abhängigkeit zu anderen Bugs. Kein Risiko, da `performSaveWorkout` als einzige Stelle `_isDraft: false` setzt und durch `suppressDraftPersistence` geschützt ist.

---

### ~~Schritt 2: `updateWorkout()` Branch 2 – `_isDraft`-Flag nach `createWorkoutApi()`-Fallback setzen~~ ✅ ERLEDIGT

- **Behebt Bug:** 3
- **Änderungen an:** `client/src/stores/userStore.js` (~L678–689, `updateWorkout()` Branch 2 nach `this.workouts.push(newWorkout)`)
- **Voraussetzung:** keine
- **Regressions-Risiko:** niedrig

**Begründung:** Root Cause für den Fall `id='draft'` + `completed: true`. Das neue Workout wird korrekt vom Server zurückgegeben, muss danach nur noch `_isDraft: false` / `isDraft: false` erhalten, wenn `updates.completed === true`. Isolierter Branch ohne Auswirkung auf andere Pfade.

---

### ~~Schritt 3: `createWorkout()` – `completed` und `_isDraft` aus dem Payload respektieren~~ ✅ ERLEDIGT

- **Behebt Bug:** 1
- **Änderungen an:** `client/src/stores/userStore.js` (~L565–582, `createWorkout()` — `newWorkoutAsDraft` → `newWorkoutInStore`)
- **Voraussetzung:** Schritt 2 muss vorher erledigt sein (beide Bugs liegen in `userStore.js` nahe beieinander; Schritt 2 klärt die Semantik von `updateWorkout` Branch 2, sodass klar ist, welcher Pfad `createWorkout()` überhaupt noch aufruft)
- **Regressions-Risiko:** mittel

**Begründung:** Root Cause für das „Banner bleibt nach Save" in Branch B2. Fix muss zwischen WorkoutBuilder-Kontext (kein `completed` im Payload → Draft bleibt Draft) und finalem Save-Kontext (`completed: true` übergeben → nicht auf `false` erzwingen) unterscheiden. Mittleres Risiko, weil `createWorkout()` von mehreren Stellen aufgerufen wird.

**Fix-Logik (Pseudocode):**
```js
const shouldKeepAsDraft = newWorkout.completed !== true && updates?.completed !== true
const newWorkoutAsDraft = {
  ...newWorkout,
  _isDraft: shouldKeepAsDraft,
  isDraft: shouldKeepAsDraft,
  completed: updates?.completed === true ? true : (newWorkout.completed ?? false)
}
```

---

### ~~Schritt 4: Stats-Cache nach Sync-Reconciliation invalidieren~~ ✅ ERLEDIGT

- **Behebt Bug:** 7
- **Änderungen an:** `client/src/main.js` (~L319–332, `workout-reconciled` Event-Handler)
- **Voraussetzung:** keine
- **Regressions-Risiko:** niedrig

**Begründung:** Der `workout-reconciled`-Handler im Store ersetzt bereits den Eintrag mit der echten Server-ID. Ein einzelner `this.invalidateStatsCache()`-Aufruf danach ist ausreichend und hat keine Seiteneffekte.

---

### ~~Schritt 5: `hasDraft`-Getter auf `isDraftLike()` ausweiten~~ ✅ ERLEDIGT

- **Behebt Bug:** 5
- **Änderungen an:** `client/src/stores/userStore.js` (~L136–150, `hasDraft`, `draftType`, `draftTimestamp` Getter)
- **Voraussetzung:** Schritt 1–3 müssen vorher erledigt sein (erst wenn sichergestellt ist, dass `_isDraft` nach allen Save-Pfaden korrekt gesetzt wird, kann `hasDraft` auf ID-basierte Erkennung ausgeweitet werden, ohne False Positives durch hängende Draft-IDs zu erzeugen)
- **Regressions-Risiko:** mittel

**Begründung:** Erweitert die Draft-Erkennung auf Workouts mit `draft-*`-ID aber fehlendem `_isDraft: true`. Mittleres Risiko: Falls nach Schritten 1–3 noch verwaiste `draft-*`-Einträge im Store existieren (fehlender Tombstone), würden sie das Banner dauerhaft sichtbar halten. Daher erst nach den `_isDraft`-Fixes.

---

### Schritt 6: `sessionStorage`-Draft-Key um UID-Suffix erweitern ✅ ERLEDIGT

- **Behebt Bug:** 6
- **Änderungen an:**
  - `client/src/utils/workoutBuilderFlow.js` — `getDetailDraftKey(uid)` Hilfsfunktion exportiert
  - `client/src/views/WorkoutDetailView.vue` — lokales `getDetailDraftKey()` nutzt UID aus `authStore`; `clearAllDetailDraftSnapshots()` leert auch Legacy-Key
  - `client/src/views/DashboardView.vue` — lokales `getDetailDraftKey()` nutzt UID aus `authStore`/`getCurrentUser`
  - `client/src/components/BottomNav.vue` — sessionStorage-Read prüft UID-Key zuerst, fällt auf Legacy-Key zurück
  - `client/src/components/RecentWorkouts.vue` — sessionStorage-Write nutzt `getDetailDraftKey(userId)`
  - `client/src/components/WorkoutBuilder.vue` — beide sessionStorage-Writes nutzen `getDetailDraftKey(userIdComputed.value)`
- **Nicht geändert:** `userStore.js` (löscht bereits DETAIL_DRAFT_KEY + alle `workout_detail_draft_*` Keys), `SettingsView.vue` (`includes('workout_detail_draft')` erfasst beide Key-Varianten)

---

## Nicht geplant

| Bug | Grund |
|-----|-------|
| Bug 4 (`postSaveCleanup` + lateUpdate-Race) | `lateIdx !== -1`-Guard existiert bereits; echter Race minimal – Priorität nicht rechtfertigbar |
| Bug 8 (`_isDraft: false` in IndexedDB bei Offline-Save) | Akzeptiertes Design: Offline-Final-Save muss `_isDraft: false` setzen; Stats-Divergenz ist transient bis Sync läuft |

---

## Zusammenfassung

```
Schritt 1  →  Bug 2   (WorkoutDetailView.vue)          Risiko: niedrig
Schritt 2  →  Bug 3   (userStore.js)                   Risiko: niedrig
Schritt 3  →  Bug 1   (userStore.js)                   Risiko: mittel    [braucht Schritt 2]
Schritt 4  →  Bug 7   (userStore.js)                   Risiko: niedrig
Schritt 5  →  Bug 5   (userStore.js)                   Risiko: mittel    [braucht Schritte 1–3]
Schritt 6  →  Bug 6   (6 Dateien)                      Risiko: hoch      ✅ ERLEDIGT
```
