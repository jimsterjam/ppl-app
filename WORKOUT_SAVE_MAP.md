# Workout Save Flow — Vollständige Übersicht

Analysiert am: 2026-06-02 | Zuletzt aktualisiert: 2026-06-03 (Schritte 1–6 aus WORKOUT_FIX_PLAN.md eingepflegt)  
Ziel: Vollständige Dokumentation aller Pfade, Dateien, Funktionen, State-Variablen und Datenpersistenz beim Speichern eines Workouts.

---

## 1. Beteiligte Dateien und ihre Rollen

| Datei | Rolle |
|---|---|
| `client/src/views/WorkoutDetailView.vue` | Einstiegspunkt; UI-Guard, Payload-Aufbau, Branch-Routing, Cleanup |
| `client/src/stores/userStore.js` | Pinia-Store; optimistisches Update, API-Dispatch, Store-Merge |
| `client/src/api/workouts.js` | HTTP-Schicht; POST/PUT mit Offline-Fallback und Retry-Logik |
| `client/src/utils/offlineStorage.js` | IndexedDB (Dexie); Draft-Persistenz, Sync-Queue, bulkPut/bulkGet |
| `client/src/utils/syncManager.js` | Hintergrund-Sync; verarbeitet die Offline-Queue periodisch |
| `client/src/utils/workoutMerge.js` | Merge-Strategie bei loadWorkouts; bewahrt _isDraft wenn lokal vorhanden |
| `client/src/utils/draftTombstones.js` | isDraftLike(), filterOutDeletedDrafts(), isDraftDeleted() |
| `client/src/utils/workoutBuilderFlow.js` | `DETAIL_DRAFT_KEY`-Konstante (Legacy), `getDetailDraftKey(uid)` (UID-basierter Key), `resolveRealIdFromDraftId()` |
| `server/routes/workouts.js` | Express-Router; POST /api/workouts und PUT /api/workouts/:id |
| `server/middleware/firebaseAuth.js` | Firebase-Token-Validierung; setzt req.auth.userId |
| `server/models/Workout.js` | Mongoose-Schema; definiert was in MongoDB gespeichert wird |

---

## 2. Aufrufkette beim manuellen Speichern (vollständiger Pfad)

```
Benutzer klickt "Workout speichern"
  └─ saveWorkout()                            [WorkoutDetailView.vue ~L2370]
       │  • Prüft ob Timer läuft → zeigt Modal (Pfad: pendingTimerAction)
       └─ performSaveWorkout()                [WorkoutDetailView.vue ~L2091]
            │  Guards: if (saving.value) return
            │  Setzt: saving.value = true
            │          suppressDraftPersistence.value = true
            │          cancelPendingAutoSave('final-save')
            │
            ├─ [Branch A] favoriteAdjust === '1'
            │    └─ updateFavoriteWorkout()   [lokal, kein API-Call]
            │         → clearAllDetailDraftSnapshots()
            │         → router.push('/dashboard')
            │
            ├─ [Branch B] id.startsWith('draft-')
            │    ├─ [B1] realId vorhanden
            │    │    └─ store.updateWorkout(realId, normalized, token)   → [PUT]
            │    │         → syncStartedFavoriteFromWorkout()
            │    │         → store.invalidateStatsCache()
            │    │         → postSaveCleanup()
            │    │         → router.push('/dashboard')
            │    │
            │    └─ [B2] kein realId (Draft ohne Server-ID)
            │         ├─ store.createWorkout(payload, token)              → [POST]
            │         │    └─ Fallback bei transientem Fehler:
            │         │         store.createWorkoutOptimistic()           → [Offline]
            │         └─ store.invalidateStatsCache()
            │              → postSaveCleanup()
            │              → router.push('/dashboard')
            │
            └─ [Branch C] id = normale MongoDB-ObjectId
                 └─ store.updateWorkout(id, normalized, token)            → [PUT]
                      → syncStartedFavoriteFromWorkout()
                      → postSaveCleanup()
                      → router.push('/dashboard')
```

### postSaveCleanup() [WorkoutDetailView.vue]
```
clearAllDetailDraftSnapshots()     // sessionStorage löschen
db.workouts.delete(draftId)        // IndexedDB Draft entfernen
store.workouts.splice(draftIdx, 1) // Store-Eintrag entfernen
sessionStorage removeItem(draftMapKey)
```

---

## 3. store.updateWorkout() — Detailablauf

```
store.updateWorkout(id, updates, token)              [userStore.js ~L630]
  │
  ├─ [Branch 1] isOfflineId (offline_* | draft-*)
  │    → saveWorkoutOffline(merged)                  [IndexedDB put]
  │    → queueAction('update', 'workout', merged)    [Sync-Queue]
  │    → this.workouts[idx] = merged                 [Store Update]
  │    → Stats-Cache invalidieren wenn completed
  │
  ├─ [Branch 2] keine gültige ObjectId (z.B. 'draft')
  │    → createWorkoutApi(payload, token)             [POST /api/workouts]
  │    → this.workouts.filter(id entfernen)
  │    → this.workouts.push({ ...newWorkout, _isDraft: shouldBeDraft, isDraft: shouldBeDraft })
  │         shouldBeDraft = updates.completed !== true
  │    → Stats-Cache invalidieren wenn completed
  │
  └─ [Branch 3] gültige MongoDB-ObjectId (24-stellige Hex-ID)
       │
       ├─ OPTIMISTISCHES UPDATE (sofort, vor API):
       │    saveWorkoutOffline(optimisticWithTs)      [IndexedDB put]
       │    this.workouts[idx] = optimisticWithTs     [Store Update]
       │    Stats-Cache invalidieren wenn completed
       │
       ├─ API-CALL (mit 2s-Timeout-Race):
       │    updateWorkoutApi(id, updates, token)      [PUT /api/workouts/:id]
       │
       ├─ [Pfad 3a] API antwortet in < 2s:
       │    this.workouts[idx] = { ...local, ...serverResponse }
       │    Explizit re-applizieren: completed aus updates
       │    Explizit re-applizieren: _isDraft/_isDraft aus updates
       │    (Server gibt _isDraft nie zurück — Mongoose-Schema hat es nicht)
       │
       └─ [Pfad 3b] Timeout (> 2s):
            → Gibt optimistischen Stand zurück
            → lateUpdate-Handler (fire-and-forget):
                 wenn API später antwortet:
                   this.workouts[lateIdx] = { ...local, ...lateUpdate }
                   completed re-applizieren
                   _isDraft/_isDraft re-applizieren
```

---

## 4. updateWorkoutApi() — HTTP-Schicht

```
updateWorkoutApi(workoutId, workoutData, token)     [api/workouts.js ~L380]
  │
  ├─ Offline: saveWorkoutOffline() + queueAction('update')   → [Offline-Fallback]
  │
  └─ Online:
       PUT /api/workouts/:workoutId
       Header: Authorization: Bearer <firebase-id-token>
       Timeout: VITE_WORKOUTS_TIMEOUT_MS (Default: 25000ms)
       Body: workoutData (ohne _id im Body)
       │
       ├─ Erfolg: saveWorkoutOffline(res.data) + return res.data
       │
       └─ Fehler:
            shouldUseOfflineUpdateFallback() prüft Status:
              → 5xx / kein Status / ERR_NETWORK → Offline-Fallback
              → 4xx (außer oben) → throw handleAPIError()
            Offline-Fallback: saveWorkoutOffline(merged) + queueAction('update')
```

---

## 5. createWorkoutApi() — HTTP-Schicht

```
createWorkoutApi(workoutData, token)                [api/workouts.js ~L220]
  │
  ├─ Online (isOnline() === true):
  │    POST /api/workouts
  │    Header: Authorization: Bearer <firebase-id-token>
  │    Timeout: VITE_WORKOUTS_CREATE_TIMEOUT_MS (Default: 8000ms)
  │    Body: workoutData
  │    │
  │    ├─ Erfolg: saveWorkoutOffline(syncedWorkout) + return syncedWorkout
  │    │
  │    ├─ shouldRetryCreateRequest() = true (nur 408/425/429/5xx):
  │    │    → sleep(CREATE_RETRY_DELAY_MS = 1200ms)
  │    │    → Retry-POST (einmal)
  │    │    → ERR_NETWORK / ECONNABORTED → KEIN Retry (Duplikat-Risiko!)
  │    │
  │    └─ Fehler + shouldUseOfflineCreateFallback():
  │         → Offline-Fallback
  │
  └─ Offline-Fallback:
       tempId = `offline_${Date.now()}_${random}`
       offlineWorkout = { ...workoutData, _id: tempId, _offlineCreated: true }
       saveWorkoutOffline(offlineWorkout)
       queueAction('create', 'workout', offlineWorkout)
       return offlineWorkout
```

---

## 6. Server-Route PUT /api/workouts/:id

```
[server/routes/workouts.js ~L810]

Middleware-Stack:
  firebaseAuthMiddleware → req.auth.userId (Firebase-Token-Validierung)

Handler:
  const { _id: _bodyId, ...updateBody } = req.body    // _id aus Body entfernen
  Workout.findOneAndUpdate(
    { _id: req.params.id, userId },                   // Scope-Check: nur eigene Workouts
    updateBody,
    { new: true, runValidators: true }                // Gibt neues Dokument zurück
  )
  → 200 res.json(workout)
  → 400 wenn keine gültige ObjectId
  → 404 wenn Workout nicht gefunden oder nicht eigenes Workout
  → 400 bei Validierungsfehler (err.message)
```

---

## 7. Server-Route POST /api/workouts

```
[server/routes/workouts.js ~L776]

Middleware-Stack:
  firebaseAuthMiddleware → req.auth.userId

Handler:
  Workout.create({
    ...req.body,
    userId    // userId aus Firebase-Token, nicht aus Body!
  })
  → 201 res.json(workout)
  → 400 bei Fehler (z.B. Validierungsfehler)
```

---

## 8. Mongoose-Modell Workout.js — Felder

```javascript
{
  userId:    String (required),
  name:      String (required, default: 'Neues Workout'),
  type:      enum ['push','pull','legs','fullbody'] mit set()-Normalisierung,
  exercises: [{
    exerciseId: String,
    name:       String,
    sets:       Number,
    reps:       Number,
    weight:     Number,
    category:   String,
    note:       String,
    setDetails: [{ reps, weight, restTime, notes, isWarmup }]
  }],
  date:         Date (default: now),
  duration:     Number (Minuten),
  completed:    Boolean (default: false),
  notes:        String,
  imageUrl:     String,
  thumbnailUrl: String,
  timestamps:   true  // createdAt, updatedAt
}
```

**KRITISCH: `_isDraft` ist NICHT im Schema.**  
Mongoose strict-Mode (default `true`) strippt `_isDraft` beim Speichern.  
Server gibt `_isDraft` nie zurück. Das ist ein **Client-Only-Feld.**

---

## 9. IndexedDB-Schicht (Dexie)

### saveWorkoutOffline()
```
[offlineStorage.js ~L177]
db.workouts.put(sanitizedWorkout)   // Einzelnes Workout upserten
Mit Retry-Logic (2 Versuche) bei transienten iOS/Safari-Fehlern
DRAFT-REGEL: wenn _isDraft === true → NIEMALS queueAction() aufrufen
```

### cacheWorkouts()
```
[offlineStorage.js ~L295]
Schritte:
  1. pendingDeleteIds aus SyncQueue ermitteln (keine Re-Inserts)
  2. filterDeletedWorkouts() → Tombstoned entfernen
  3. sanitizeForIndexedDB() für jeden Eintrag
  4. bulkGet() bestehende Einträge → _isDraft preservieren!
     (wenn existing._isDraft === true && incoming.completed !== true
      → _isDraft: true, isDraft: true, completed: false behalten)
  5. db.workouts.bulkPut(workoutsToStore)
  6. enforceWorkoutHistoryLimit()
```

### queueAction()
```
[offlineStorage.js ~L430]
GUARD: if (entityType === 'workout' && cleanData._isDraft) return null
        → Draft-Workouts gehen NIE in die Sync-Queue!
db.syncQueue.add({
  action: 'create' | 'update' | 'delete',
  entityType: 'workout',
  data: cleanData,
  timestamp, synced: false, retryCount: 0
})
```

---

## 10. Sync-Queue-Verarbeitung (syncManager.js)

```
processSyncQueue()
  1. isOnline() + gültiger Token erforderlich
  2. Alle pending (synced: false, failed: false) Einträge laden
  3. Für jeden Eintrag:
     → userId backfill falls fehlend (aus aktuellem Token)
     → Scope-Check: nur eigene Workouts
     → syncAction(action, entityType, data, token)
         'create' → createWorkoutApi(data, token, { skipOfflineQueue: true })
                    → bei Erfolg: dispatcht CustomEvent 'workout-reconciled' { tempId, workout }
                    → main.js-Handler: ersetzt Store-Eintrag + ruft userStore.invalidateStatsCache() auf
         'update' → updateWorkoutApi(data._id, data, token)
         'delete' → deleteWorkoutApi(data._id, token)
     → nach Erfolg: markActionSynced(item.id)
  4. Auto-Retry mit Backoff (max 5 Versuche, exponentielles Backoff)
  5. Bei permanentem Fehler: item.failed = true (nicht mehr retried)
```

---

## 11. State-Variablen in WorkoutDetailView.vue

| Variable | Typ | Gelesen | Geschrieben | Bedeutung |
|---|---|---|---|---|
| `saving` | `ref(false)` | Guards in runAutoSaveNow, triggerAutoSave | performSaveWorkout (true→false) | Verhindert Doppel-Aufrufe |
| `suppressDraftPersistence` | `ref(false)` | writeDraftSessionSnapshot, persistInProgressDraft, runAutoSaveNow | performSaveWorkout (true→false in finally) | Blockiert Auto-Save während finalem Save |
| `workout` | `ref({})` | überall | loadWorkout, Auto-Save, performSaveWorkout | Das Workout-Objekt selbst |
| `isDirty` | `ref(false)` | persistInProgressDraft, onBeforeRouteLeave | Deep-Watcher auf workout | Ob Änderungen vorhanden |
| `saveMsg` | `ref('')` | Template | performSaveWorkout | Erfolgs-/Fehlermeldung |
| `saveError` | `ref(false)` | Template | performSaveWorkout | Fehler-State |
| `bypassTimerLeaveGuard` | `ref(false)` | onBeforeRouteLeave | performSaveWorkout (true nach Erfolg) | Erlaubt Navigation trotz laufendem Timer |
| `initialSnapshot` | `string` | isDirty-Berechnung | nach Save gesetzt | Core-Snapshot für dirty-Check |

---

## 12. State-Variablen im userStore.js

| Getter/State | Typ | Bedeutung |
|---|---|---|
| `workouts` | `Array` | Alle geladenen Workouts (Pinia-State) |
| `hasDraft` | getter | `workouts.some(w => isDraftLike(w) && w.completed !== true)` — nutzt `isDraftLike()` aus draftTombstones.js (erfasst `_isDraft:true`, `isDraft:true`, `_id==='draft'`, `_id.startsWith('draft-')`) |
| `draftType` | getter | Typ des ersten Draft-Workouts |
| `draftTimestamp` | getter | updatedAt/date des ersten Drafts |
| `loadingWorkouts` | `Boolean` | Ladeindikator |
| `workoutsLoaded` | `Boolean` | Initialer Ladevorgang abgeschlossen |
| `stats` | `Object\|null` | Gecachte Statistiken; wird auf null gesetzt nach Save |

---

## 13. Client-Only-Felder (nicht im Mongoose-Schema)

| Feld | Bedeutung | Wer setzt es | Wer liest es |
|---|---|---|---|
| `_isDraft` | Workout ist noch in Bearbeitung | performSaveWorkout (false), persistInProgressDraft (true), runAutoSaveNow (true) | hasDraft-Getter, BottomNav, Dashboard, mergeWorkoutLists |
| `isDraft` | Alias für `_isDraft` | überall zusammen mit `_isDraft` | BottomNav (checked beide), isDraftLike() |
| `_offlineCreated` | Wurde offline ohne Server-ID erstellt | createWorkout() Offline-Fallback | syncManager (bestimmt POST statt PUT) |
| `_offlineUpdated` | Wurde offline aktualisiert | updateWorkout() Offline-Fallback | syncManager |
| `_syncPendingAuth` | Sync wartet auf Re-Authentifizierung | createWorkout bei 401/403 | syncManager (überspringt ohne Token) |
| `_syncedAt` | Letzter Sync-Zeitstempel | cacheWorkouts | nur interne Nutzung |
| `_failedOnline` | Online-Versuch ist fehlgeschlagen | updateWorkout Offline-Fallback | nur interne Nutzung |

---

## 14. Persistenzschicht — Übersicht

### IndexedDB (Dexie — primärer Offline-Speicher)
- **Tabellen**: `workouts`, `syncQueue`
- **Workout-Zugriff**: `saveWorkoutOffline()`, `getAllWorkoutsOffline()`, `getWorkoutOffline()`, `deleteWorkoutOffline()`, `cacheWorkouts()`
- **Sync-Queue-Zugriff**: `queueAction()`, `processSyncQueue()`, `markActionSynced()`

### sessionStorage (temporär, verloren bei App-Neustart)

| Key | Format | Schreiber | Leser | Zweck |
|---|---|---|---|---|
| `workout_detail_draft_${uid}` | `{ ...workout, _isDraft: true, timestamp }` | WorkoutDetailView, WorkoutBuilder, RecentWorkouts via `getDetailDraftKey(uid)` | BottomNav, DashboardView, WorkoutDetailView | In-Progress-Draft, user-scoped (verhindert Cross-User-Leakage) |
| `workout_detail_draft` | Legacy-Key (kein UID-Suffix) | — (wird nicht mehr geschrieben) | `readDetailDraftRaw()` als Fallback | Rückwärtskompatibilität; wird beim Logout via `clearDraft()` entfernt |
| `workout_map_${draftId}` | MongoDB-ID-String | WorkoutDetailView (nach erstem Server-Create) | `resolveRealIdFromDraftId()` | Mappt draft-* ID auf echte MongoDB-ID |
| `quick_workout_prefill` | Prefill-Objekt | WorkoutBuilder, Dashboard | WorkoutDetailView (onMounted) | Schnellstart-Vorlage |

### localStorage (persistent über App-Neustart)

| Key | Format | Zweck |
|---|---|---|
| `deleted_draft_ids_v1` | `{ [draftId]: timestamp }` | Tombstones für gelöschte Drafts (verhindert Re-Insert) |
| `workout_detail_view_state_v1` | UI-State-Objekt | Scroll-Position, aufgeklappte Sektionen |
| `bro_split_stats:${uid}` | Stats-JSON-Objekt | Gecachte Workout-Statistiken |
| `fav_prefill_applied_v1_${id}` | `'1'` (Flag) | Verhindert doppeltes Favorit-Prefill |
| `fav_template_freshly_adjusted_${id}` | `'1'` (Flag) | Signalisiert frisch angepasstes Template |

### MongoDB (über Express-API — Remote-Persistenz)
- **Zugriff**: `server/routes/workouts.js`
- **Model**: `server/models/Workout.js`
- **Scope-Schutz**: Alle Queries filtern auf `userId` aus Firebase-Token

---

## 15. Auto-Save-Flow (Hintergrund, kein manueller Klick)

```
Deep-Watcher auf workout.value
  → triggerAutoSave()
      Guards: if (saving.value || suppressDraftPersistence.value) return
      → debounced → runAutoSaveNow()
           Guards: if (saving.value || suppressDraftPersistence.value) return
           │
           ├─ id === 'draft':
           │    saveWorkoutOffline({ ...workout, _isDraft: true, completed: false })
           │    store.workouts[idx] = { ..., _isDraft: true }
           │
           ├─ id.startsWith('draft-'):
           │    resolveRealIdFromDraftId() → realId?
           │    wenn realId: store.updateWorkout(realId, { ..., _isDraft: true })
           │    sonst: saveWorkoutOffline als Draft
           │
           └─ Normal-ID:
                keepDraft = workout.completed !== true
                store.updateWorkout(id, { ...workout, _isDraft: keepDraft }, token)
```

**INVARIANTE**: Auto-Save setzt `_isDraft: true` solange `completed !== true`.  
`completed = true` wird **ausschließlich** von `performSaveWorkout()` gesetzt.

---

## 16. Draft-Persistenz bei Navigations-Ereignissen

| Ereignis | Handler | Aktion |
|---|---|---|
| `visibilitychange` (tab hidden) | `onVisibilityChange()` | `persistInProgressDraft('visibility-hidden')` |
| `pagehide` | `onPageHide()` | `persistInProgressDraft('pagehide')` |
| `beforeunload` | `beforeUnloadHandler()` | `writeDraftSessionSnapshot()` (sync) |
| Capacitor `appStateChange (isActive=false)` | `_capAppStateListener` | `persistInProgressDraft('app-background')` |
| Route-Leave (Vue Router) | `onBeforeRouteLeave()` | `persistInProgressDraft('route-leave')` |
| `onBeforeUnmount` | Vue lifecycle | `persistInProgressDraft('before-unmount')` wenn `!suppressDraftPersistence` |

**INVARIANTE**: Kein dieser Handler setzt je `completed: true`.  
`_isDraft: true, completed: false` wird immer geschrieben.

---

## 17. applyWorkoutLimit() — Sortierung und Draft-Handling

```javascript
// userStore.js ~L226
applyWorkoutLimit(list) {
  const drafts   = items.filter(w => isDraftLike(w) && w.completed !== true && !isDraftDeleted(w._id))
  const regular  = items.filter(w => !(isDraftLike(w) && w.completed !== true))
  const sorted   = [...regular].sort(by updatedAt DESC)
  return [...drafts, ...sorted.slice(0, VITE_WORKOUTS_IN_MEMORY_LIMIT)]
}
```

- Drafts werden **vor** den regulären Workouts eingereiht
- Drafts zählen **nicht** gegen das LIMIT
- Das Limit gilt nur für abgeschlossene/reguläre Workouts

---

## 18. Schlüssel-Helper-Funktionen

### isDraftLike() [draftTombstones.js]
```javascript
export function isDraftLike(workout) {
  const id = String(workout?._id || '')
  return workout?._isDraft === true 
    || workout?.isDraft === true 
    || id === 'draft' 
    || id.startsWith('draft-')
}
```

### isOpenDraftWorkout() [DashboardView.vue ~L286]
```javascript
function isOpenDraftWorkout(workout) {
  return (workout?._isDraft === true || workout?.isDraft === true)
    && workout?.completed !== true
    && workout?._adjustDraft !== true
}
```

### filterOutDeletedDrafts() [draftTombstones.js]
```javascript
export function filterOutDeletedDrafts(list, source) {
  return list.filter(w => !(isDraftLike(w) && isDraftDeleted(w?._id)))
}
```

### DETAIL_DRAFT_KEY [workoutBuilderFlow.js]
```javascript
export const DETAIL_DRAFT_KEY = 'workout_detail_draft'
// Verwendet via: sessionStorage.setItem(getDetailDraftKey(), JSON.stringify(snapshot))
```

---

## 19. Wichtige Invarianten (keine Änderungen ohne Risikoanalyse)

1. **`_isDraft` ist Client-Only**: Muss nach jedem API-Response explizit re-appliziert werden, da Mongoose es strippt
2. **Draft-Workouts nie in Sync-Queue**: `queueAction()` hat Guard `if (_isDraft) return null`
3. **`performSaveWorkout()` ist der einzige Weg zu `completed: true`**: Kein Auto-Save, kein Lifecycle-Hook, kein API-Fehler-Pfad setzt `completed: true`
4. **`suppressDraftPersistence` blockiert das vollständige Auto-Save-System**: Muss im `finally`-Block zurückgesetzt werden
5. **2s-Timeout-Race in updateWorkout**: Der lateUpdate-Handler muss ebenfalls `_isDraft` re-applizieren
6. **`cacheWorkouts` preserviert `_isDraft`**: Bei `bulkPut` wird der bestehende `_isDraft`-Status aus IndexedDB bewahrt, wenn `completed !== true`
7. **`loadWorkouts` liest IndexedDB vor `fetchWorkouts`**: `localPreFetch` wird vor dem Server-Fetch gecaptured, da `fetchWorkouts` → `cacheWorkouts` den `_isDraft`-Flag überschreiben würde
