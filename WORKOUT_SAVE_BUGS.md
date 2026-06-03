# WORKOUT_SAVE_BUGS.md

Bug-Inventar für den Save-Workout-Flow. Basis: Analyse aller relevanten Dateien im Client und Server (Stand nach Commit `117d1cb`).

**Letzte Aktualisierung:** 2026-06-03 — Schritte 1–6 aus WORKOUT_FIX_PLAN.md abgeschlossen. Bugs 1–3, 5–7 behoben.

**Konventionen:**
- 🔴 Aktiv – reproduzierbar, kein Fix vorhanden
- 🟡 Latent – nur unter Randbedingungen (Slow Network, Multi-User, Offline)
- ✅ Behoben – Fix in diesem oder einem früheren Commit

---

## Aktive Bugs

Keine offenen Bugs mehr — alle priorisierten Bugs aus dieser Runde wurden behoben.
Bug 4 ist nicht regressionsfähig (Guard bereits vorhanden). Bug 8 ist akzeptiertes Design.

---

## Früher aktive Bugs (jetzt behoben)

---

### Bug 1: `createWorkout()` überschreibt `completed: true` nach erfolgreichem Draft-Save ✅

- **Symptom:** Wenn Branch B2 (`performSaveWorkout` → Draft ohne realId) ein Workout via `store.createWorkout(payload)` mit `completed: true` speichert, erscheint das Workout im Store sofort danach mit `_isDraft: true, completed: false` – als hätte der Save nicht funktioniert. Das Dashboard-Banner bleibt sichtbar, obwohl das Workout auf dem Server korrekt angelegt wurde.
- **Ursache:** `userStore.js` → `createWorkout()` (~L570–580): Nach dem API-Aufruf wird das zurückgegebene Workout bedingungslos überschrieben:
  ```js
  const newWorkoutAsDraft = {
    ...newWorkout,
    _isDraft: true,
    isDraft: true,
    completed: false   // ← überschreibt completed: true aus dem Payload
  }
  ```
  Diese Zeilen ignorieren, ob das Workout gerade final gespeichert (`completed: true`) oder nur angelegt wird.
- **Betroffene Dateien:**
  - `client/src/stores/userStore.js` (~L570–585, `createWorkout()`)
  - `client/src/views/WorkoutDetailView.vue` (~L2200–2270, `performSaveWorkout()` Branch B2)
- **Seiteneffekte bei Fix:** `createWorkout()` wird auch beim Anlegen eines neuen Workouts im WorkoutBuilder aufgerufen – dort soll das Workout tatsächlich als Draft bleiben. Der Fix muss `completed` und `_isDraft` aus den `updates` respektieren, wenn sie explizit übergeben werden, und darf nur dann auf Draft-Defaults fallen, wenn `updates.completed` nicht gesetzt ist.
- **Behoben in:** Schritt 3 (WORKOUT_FIX_PLAN.md) — `shouldKeepAsDraft = workoutData?.completed !== true && newWorkout.completed !== true`; `completed` aus `workoutData` wird respektiert.

---

### Bug 2: `runAutoSaveNow()` – Draft-Branch mit realId sendet kein `_isDraft: true` ✅

- **Symptom:** Wenn auto-save für ein `draft-*`-Workout läuft, das bereits eine gemappte realId hat (Workout wurde vom WorkoutBuilder im Hintergrund angelegt), wird der Store-Update ohne `_isDraft: true` gesendet. Der Store-Eintrag verliert `_isDraft` für einen kurzen Moment, bis der nächste Auto-Save-Zyklus ihn wiederherstellt. `hasDraft` kann flackern → Dashboard-Banner kurz ausblenden.
- **Ursache:** `WorkoutDetailView.vue` → `runAutoSaveNow()` (~L1164):
  ```js
  await store.updateWorkout(realId, { ...wWithoutId, exercises, notes }, token)
  //                                  ^^^^ kein _isDraft: true im Payload
  ```
  Alle anderen Branches derselben Funktion setzen `_isDraft: keepDraft` explizit. Dieser Branch nicht.
- **Betroffene Dateien:**
  - `client/src/views/WorkoutDetailView.vue` (~L1154–1175, `runAutoSaveNow()` Branch `draft-*` mit realId)
  - `client/src/stores/userStore.js` (~L692–760, `updateWorkout()` → `_isDraft` re-apply greift nur wenn `updates._isDraft !== undefined`)
- **Seiteneffekte bei Fix:** Einfach `_isDraft: true, isDraft: true` zum Payload hinzufügen. Keine Regression zu erwarten, da `performSaveWorkout` die einzige Stelle ist, die `_isDraft: false` setzt.
- **Behoben in:** Schritt 1 (WORKOUT_FIX_PLAN.md) — `_isDraft: true, isDraft: true` zu `updateWorkout`-Aufruf in `runAutoSaveNow` Branch `draft-*` mit realId hinzugefügt.

---

### Bug 3: `updateWorkout()` Branch 2 (invalid ObjectId / id=`'draft'`) fügt neues Workout ohne `_isDraft` in den Store ein ✅

- **Symptom:** `performSaveWorkout` kann `store.updateWorkout(id='draft', { completed: true, ... }, token)` aufrufen. Da `'draft'` kein valides ObjectId ist, wechselt `updateWorkout()` intern zu `createWorkoutApi()`. Das neu erstellte Workout wird via `this.workouts.push(newWorkout)` in den Store eingefügt – aber `newWorkout` kommt vom Server und enthält kein `_isDraft`. Das Workout landet als `_isDraft: undefined` im Store, was `hasDraft` nicht zu `false` resetzt (korrekt), aber auch nicht zu `true` (korrekt). Allerdings wird kein `postSaveCleanup` auf den alten `'draft'`-Eintrag angewendet: Der alte Draft-Slot bleibt unter `id='draft'` im Store erhalten, bis er durch `clearDraft()` entfernt wird.
- **Ursache:** `userStore.js` → `updateWorkout()` Branch 2 (~L660–680):
  ```js
  this.workouts = this.workouts.filter(w => String(w?._id || '') !== String(id));
  if (newWorkout) {
    this.workouts.push(newWorkout);  // ← kein _isDraft-Handling, kein cleanup des 'draft'-Slots
  }
  ```
- **Betroffene Dateien:**
  - `client/src/stores/userStore.js` (~L660–685, `updateWorkout()` Branch 2)
  - `client/src/views/WorkoutDetailView.vue` (~L2280–2340, `performSaveWorkout()` Branch B2 flow via `updateWorkout`)
- **Seiteneffekte bei Fix:** Beim Filtern wird `id='draft'` bereits entfernt, also kein doppelter Eintrag. Fix muss lediglich `newWorkout._isDraft` und `isDraft` entsprechend dem `updates.completed`-Wert setzen.
- **Behoben in:** Schritt 2 (WORKOUT_FIX_PLAN.md) — `const shouldBeDraft = updates.completed !== true`; `this.workouts.push({ ...newWorkout, _isDraft: shouldBeDraft, isDraft: shouldBeDraft })`.

---

### Bug 4: `postSaveCleanup` + `lateUpdate`-Race bei langsamer Verbindung (>2 s) — Nicht geplant

- **Symptom:** Bei sehr langsamer Netzwerkverbindung (PUT-Response > 2 s): `performSaveWorkout` wartet auf `store.updateWorkout()`, das intern einen 2-Sekunden-Timeout-Race startet. Nach Timeout gibt `updateWorkout` den optimistischen State zurück. `postSaveCleanup` läuft sofort danach und löscht den IndexedDB-Eintrag sowie den Store-Eintrag (via `clearDraft()`). Wenn die echte API-Antwort dann später ankommt, feuert der `lateUpdate`-Handler in `updateWorkout` und fügt das Workout erneut in `this.workouts` ein – mit `_isDraft: false` (weil `updates._isDraft` in `updates` aus `performSaveWorkout` explizit `false` ist). Das Dashboard zeigt dann kurz ein vermeintlich neues completed Workout ohne den Cleanup-Status.
- **Ursache:** `userStore.js` → `updateWorkout()` lateUpdate-Handler (~L720–740): Der Handler prüft nicht ob der Workout-Eintrag in der Zwischenzeit durch `postSaveCleanup` aus dem Store entfernt wurde.
  ```js
  .then((lateUpdate) => {
    if (!lateUpdate) return
    const lateIdx = this.workouts.findIndex(w => w._id === id)
    if (lateIdx !== -1) {           // ← guard existiert
      this.workouts[lateIdx] = { ... }
    }
    // ← aber: wenn lateIdx === -1 (nach postSaveCleanup), wird nichts getan.
    //    Dennoch: applyWorkoutLimit() könnte durch andere Pfade ggf. Einträge reorganisieren.
  })
  ```
  Der `lateIdx === -1`-Fall ist eigentlich korrekt geschützt. Das eigentliche Problem ist subtiler: `optimisticWithTs` wird von `updateWorkout` zurückgegeben und enthält `_isDraft: true` wenn `updates._isDraft` nicht in `updates` war. `performSaveWorkout` setzt in allen Branches `_isDraft: false` in den Updates – das bedeutet `optimisticWithTs._isDraft` bleibt `false` nach dem `{ ...optimistic, ...updates }` Merge (weil `updates._isDraft: false` ins Optimistic fließt). `postSaveCleanup` löscht den Store-Eintrag korrekt. Echter Race ist daher minimal – **Priorität niedrig**.
- **Betroffene Dateien:**
  - `client/src/stores/userStore.js` (~L715–745, `updateWorkout()` lateUpdate-Handler)
  - `client/src/views/WorkoutDetailView.vue` (~L2280–2310, `postSaveCleanup()`)
- **Seiteneffekte bei Fix:** Keiner – lateUpdate-Handler hat bereits den `lateIdx !== -1`-Guard.
- **Status:** Nicht geplant — `lateIdx === -1`-Guard schützt den kritischen Pfad bereits; echter Race minimal.

---

### Bug 5: `hasDraft`-Getter ist enger definiert als `isDraftLike()` – Inkonsistenz ✅

- **Symptom:** Ein Workout mit `_id = 'draft-xyz'` und `_isDraft: false` (z. B. nach einem fehlgeschlagenen `_isDraft`-Cleanup) wird von `hasDraft` **nicht** als Draft erkannt (`w._isDraft === true` → false), aber von `isDraftLike()` schon (`id.startsWith('draft-')` → true). Das Dashboard-Banner kann fehlen, obwohl ein echter Draft-Eintrag im Store sitzt.
- **Ursache:** `userStore.js` → `hasDraft` Getter (~L137):
  ```js
  hasDraft: (state) => state.workouts.some(w => w._isDraft === true)
  ```
  `isDraftLike()` in `draftTombstones.js` prüft zusätzlich `w._id === 'draft'` und `w._id?.startsWith('draft-')`. Diese Prüfung fehlt im `hasDraft`-Getter.
- **Betroffene Dateien:**
  - `client/src/stores/userStore.js` (~L137, `hasDraft` Getter)
  - `client/src/utils/draftTombstones.js` (`isDraftLike()`)
  - `client/src/components/BottomNav.vue` (liest `hasDraft`)
  - `client/src/views/DashboardView.vue` (liest `hasDraft`)
- **Seiteneffekte bei Fix:** Wenn `hasDraft` auch `id.startsWith('draft-')` prüft, könnten alte (abgebrochene) Draft-IDs ohne `_isDraft: true`, die noch nicht tombgestoned wurden, fälschlicherweise das Banner auslösen. Fix sollte daher auf `_isDraft === true || isDraftLike(w)` erweitern und gleichzeitig sicherstellen, dass `clearDraft()` konsequent tombstonet.
- **Behoben in:** Schritt 5 (WORKOUT_FIX_PLAN.md) — `hasDraft`, `draftType`, `draftTimestamp` Getter auf `isDraftLike(w) && w.completed !== true` umgestellt.

---

### Bug 6: `sessionStorage`-Key `workout_detail_draft` ohne User-ID-Suffix ✅

- **Symptom:** Wenn zwei Nutzer dasselbe Gerät verwenden (z. B. Shared Device oder Browser-Tab-Wechsel ohne Logout), sieht Nutzer B nach dem Einloggen das Draft-Banner von Nutzer A, weil der `sessionStorage`-Eintrag überschrieben statt getrennt pro User gespeichert wird.
- **Ursache:** `workoutBuilderFlow.js`:
  ```js
  export const DETAIL_DRAFT_KEY = 'workout_detail_draft'
  ```
  Kein UID-Suffix. Alle Schreibstellen (`writeDraftSessionSnapshot`, `persistInProgressDraft`, `WorkoutDetailView.vue`) und Lesestellen (`BottomNav`, `DashboardView`) teilen denselben Key.
- **Betroffene Dateien:**
  - `client/src/utils/workoutBuilderFlow.js` (`DETAIL_DRAFT_KEY`)
  - `client/src/views/WorkoutDetailView.vue` (schreibt/liest `DETAIL_DRAFT_KEY`)
  - `client/src/views/DashboardView.vue` (liest `DETAIL_DRAFT_KEY`)
  - `client/src/components/BottomNav.vue` (liest `DETAIL_DRAFT_KEY`)
- **Seiteneffekte bei Fix:** `DETAIL_DRAFT_KEY` muss dynamisch mit UID generiert werden. Alle Read/Write-Stellen müssen auf die neue Helper-Funktion umgestellt werden. Beim Logout muss der UID-spezifische Key geleert werden.
- **Behoben in:** Schritt 6 (WORKOUT_FIX_PLAN.md) — `getDetailDraftKey(uid)` in `workoutBuilderFlow.js` exportiert; alle 5 Write/Read-Stellen auf UID-basierten Key umgestellt; `clearDraft()` leert bereits alle `workout_detail_draft_*`-Keys.

---

### Bug 7: Stats-Cache nach optimistischem Fallback in Branch B2 potentiell veraltet ✅

- **Symptom:** Branch B2 (`performSaveWorkout`, Draft ohne realId) versucht zuerst `store.createWorkout(payload)`. Schlägt das fehl, wird `store.createWorkoutOptimistic(createPayload)` aufgerufen, danach `store.invalidateStatsCache()`. `createWorkoutOptimistic()` erstellt das Workout lokal mit `completed: workoutData.completed ?? false` – wenn `createPayload.completed: true` übergeben wurde, wird `completed: true` korrekt gesetzt. Korrekt. **Aber:** Das offline-erstellte Workout landet in der Sync-Queue mit `_offlineCreated: true`. Bis der Sync die echte Server-ID zurückliefert, zeigen die Stats ein Workout mit einer temporären `offline_xxx`-ID. Nach dem Sync (Reconciliation) wird der Store-Eintrag ersetzt, aber `invalidateStatsCache()` wird **nicht** erneut aufgerufen. Stats können also die falsche Anzahl aufweisen bis zum nächsten manuellen Reload.
- **Ursache:** `syncManager.js` → `syncWorkoutAction('create', ...)` (~L340–380): Nach Reconciliation wird ein `workout-reconciled` CustomEvent dispatcht, aber kein Stats-Cache-Invalidierungs-Event. `userStore.js` lauscht auf `workout-reconciled`, ersetzt den Store-Eintrag, ruft aber kein `invalidateStatsCache()` auf.
- **Betroffene Dateien:**
  - `client/src/utils/syncManager.js` (~L340–380, `syncWorkoutAction()` Reconciliation)
  - `client/src/stores/userStore.js` (Event-Handler für `workout-reconciled`)
- **Seiteneffekte bei Fix:** Nach Reconciliation `invalidateStatsCache()` aufrufen. Kein Nachteil, da Stats ohnehin neu geladen werden müssen.
- **Behoben in:** Schritt 4 (WORKOUT_FIX_PLAN.md) — `workout-reconciled` Event-Handler in `main.js` ruft `userStore.invalidateStatsCache()` auf.

---

### Bug 8: `updateWorkoutApi()`-Offline-Fallback – `_isDraft: false` landet in IndexedDB und Sync-Queue — Akzeptiertes Design

- **Symptom:** Wenn `performSaveWorkout` mit `{ completed: true, _isDraft: false }` aufruft und das Netz ausfällt, springt `api/workouts.js updateWorkout()` in den Offline-Fallback. Das Workout wird mit `_isDraft: false` in IndexedDB gespeichert und in die Sync-Queue eingereiht. Das ist für den finalen Save-Pfad korrekt. **Aber:** Nach dem nächsten App-Start liest `loadWorkouts` das IndexedDB-Workout mit `_isDraft: false` – der `cacheWorkouts`-Draft-Schutz greift nur wenn `_isDraft: true` im existierenden Eintrag ist. Das Workout erscheint im Dashboard als completed – korrekt. **Edge Case:** Wenn dann ein `fetchWorkouts`-Aufruf scheitert (z. B. kurzer Netz-Blip) und das Workout noch nicht auf dem Server ist (Sync noch nicht ausgeführt), zeigt die Stats-Ansicht ein Workout an, das serverseitig noch nicht existiert.
- **Ursache:** `client/src/api/workouts.js` → `updateWorkout()` Offline-Fallback (~L400–420):
  ```js
  const offlineWorkout = { ...existingWorkout, ...workoutData, _offlineUpdated: true }
  ```
  Wenn `workoutData._isDraft === false` (aus `performSaveWorkout`), überschreibt dieser Wert `_isDraft` in IndexedDB. Das ist beabsichtigt für den finalen Save – kann aber inkonsistent wirken wenn Sync noch aussteht.
- **Betroffene Dateien:**
  - `client/src/api/workouts.js` (~L400–420, `updateWorkout()` Offline-Fallback)
  - `client/src/utils/offlineStorage.js` (`saveWorkoutOffline`)
- **Seiteneffekte bei Fix:** Dieser Bug ist ein Design-Tradeoff: Der Offline-Fallback für `completed` Saves muss `_isDraft: false` setzen, damit das Workout nicht als Draft im Dashboard auftaucht. Ein Fix müsste die Stats-Ansicht robuster machen (z. B. `_offlineCreated`/`_offlineUpdated`-Flag in Stats herausfiltern, bis Sync erfolgt ist). **Priorität: niedrig/akzeptiertes Verhalten.**

---

## Behobene Bugs

---

### Bug F1: Auto-Save re-markierte Workout als Draft nach finalem Save ✅

- **Symptom:** Nach `performSaveWorkout` lief `runAutoSaveNow` erneut und setzte `_isDraft: true` – das Workout wirkte im Dashboard als aktiver Draft.
- **Fix:** Guards `saving.value` und `suppressDraftPersistence.value` verhindern Auto-Save während und nach `performSaveWorkout`. Commit: vorherige Session.
- **Dateien:** `client/src/views/WorkoutDetailView.vue` (`runAutoSaveNow`, `triggerAutoSave`, `performSaveWorkout`)

---

### Bug F2: ERR_NETWORK löste endlosen Offline-Fallback-Retry aus ✅

- **Symptom:** Auf iOS/LAN-Verbindung mit transienten Fehlern wurden Workouts in die Sync-Queue aufgenommen und sofort wieder versucht zu syncen – Endlosschleife.
- **Fix:** `ERR_NETWORK` wird in `updateWorkout` nicht als Retry-Trigger behandelt; Sync-Queue erhält Backoff für retryable Fehler. Commit: vorherige Session.
- **Dateien:** `client/src/api/workouts.js`, `client/src/utils/syncManager.js`

---

### Bug F3: Stats-Cache nicht invalidiert in Branch B1 (Draft mit realId) ✅

- **Symptom:** Nach dem Speichern eines Draft-Workouts mit gemappter realId wurden die Stats-Werte nicht aktualisiert.
- **Fix:** `store.invalidateStatsCache()` in Branch B1 von `performSaveWorkout` hinzugefügt. Commit: vorherige Session.
- **Dateien:** `client/src/views/WorkoutDetailView.vue` (`performSaveWorkout` Branch B1)

---

### Bug F4: Catch-Block in `performSaveWorkout` stellte `workout.value` nicht korrekt wieder her ✅

- **Symptom:** Bei einem Fehler im Save-Flow blieb `workout.value.completed = true` – das Workout erschien als abgeschlossen, obwohl der Save fehlschlug. Kein Draft-Banner mehr sichtbar.
- **Fix:** Im `catch`-Block: `workout.value = { ...workout.value, completed: false, _isDraft: true, isDraft: true }`. Commit: vorherige Session.
- **Dateien:** `client/src/views/WorkoutDetailView.vue` (`performSaveWorkout` catch-Block)

---

### Bug F5: `_isDraft` wurde beim Dashboard-Reload überschrieben (clobber) ✅

- **Symptom:** Dashboard-Fokus (Tab-Wechsel, App-Resume) rief `loadWorkouts(force: true)` auf. `fetchWorkouts → cacheWorkouts(res.data)` überschrieb IndexedDB-Draft-Einträge mit Server-Daten (ohne `_isDraft`). Nachfolgender `loadWorkouts`-Merge las von IndexedDB – Draft war weg. Banner und BottomNav-Indikator verschwanden.
- **Fix (Commit `117d1cb`):**
  1. `loadWorkouts`: `localPreFetch` wird **vor** `fetchWorkouts` aus IndexedDB gelesen.
  2. `cacheWorkouts`: `bulkGet` liest existierende Einträge; Draft-Flags werden bei `completed !== true` beibehalten.
  3. `updateWorkout`: `_isDraft` aus `updates` wird nach Server-Antwort re-appliziert (beide Pfade: direkt + lateUpdate).
- **Dateien:** `client/src/stores/userStore.js` (`loadWorkouts`, `updateWorkout`), `client/src/utils/offlineStorage.js` (`cacheWorkouts`)

---

## Priorität & Empfehlung

| # | Bug | Priorität | Aufwand |
|---|-----|-----------|---------|
| 1 | `createWorkout()` überschreibt `completed: true` | ✅ Behoben (Schritt 3) | Klein |
| 2 | `runAutoSaveNow` Draft-Branch ohne `_isDraft` | ✅ Behoben (Schritt 1) | Trivial |
| 3 | `updateWorkout` Branch 2 – kein `_isDraft`-Handling | ✅ Behoben (Schritt 2) | Klein |
| 5 | `hasDraft`-Getter enger als `isDraftLike()` | ✅ Behoben (Schritt 5) | Klein |
| 6 | `sessionStorage`-Key ohne UID-Suffix | ✅ Behoben (Schritt 6) | Mittel |
| 7 | Stats-Cache nach Reconciliation nicht invalidiert | ✅ Behoben (Schritt 4) | Klein |
| 4 | `postSaveCleanup` + lateUpdate-Race | 🟢 Nicht geplant (Guard existiert) | Minimal |
| 8 | `_isDraft: false` in IndexedDB bei Offline-Save | 🟢 Akzeptiertes Design | N/A |
