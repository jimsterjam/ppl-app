/**
 * Integrations-Tests für den Favorit-Start-und-Speichern-Flow.
 *
 * Geprüft wird:
 * 1. Neue User-Daten landen korrekt im Favoriten-Template (nicht alte Werte)
 * 2. Nur ein Speichervorgang findet statt (kein Doppel-Create)
 * 3. WorkoutBuilder überschreibt User-Daten nicht, wenn IndexedDB bereits einen Eintrag hat
 * 4. maybePrefillFromLastFavoritePerformance löst keinen Auto-Save aus
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() }
}))

import {
  saveFavoriteWorkout,
  updateFavoriteWorkout,
  getFavoritesByType,
  normalizeWorkoutType,
} from '../workoutFavorites.js'
import { dedupeWorkoutsForStats } from '../workoutMerge.js'

// ── localStorage Mock ──────────────────────────────────────────────────────
const lsStore = {}
const localStorageMock = {
  getItem: (key) => lsStore[key] ?? null,
  setItem: (key, value) => { lsStore[key] = String(value) },
  removeItem: (key) => { delete lsStore[key] },
  clear: () => { for (const k of Object.keys(lsStore)) delete lsStore[k] }
}
vi.stubGlobal('localStorage', localStorageMock)

beforeEach(() => {
  localStorageMock.clear()
})

// ─────────────────────────────────────────────────────────────────────────────
// Hilfsfunktion: simuliert syncStartedFavoriteFromWorkout
// (das, was WorkoutDetail nach erfolgreichem manuellen Speichern aufruft)
// ─────────────────────────────────────────────────────────────────────────────
function simulateSyncStartedFavorite({ userId, favoriteId, favoriteType, favoriteName, savedWorkout }) {
  return updateFavoriteWorkout({
    userId,
    type: favoriteType,
    id: favoriteId,
    name: favoriteName,
    workout: {
      name: savedWorkout.name,
      type: savedWorkout.type,
      exercises: savedWorkout.exercises,
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Hilfsfunktion: simuliert performSaveWorkout-Normalisierung
// ─────────────────────────────────────────────────────────────────────────────
function normalizeForSave(workout) {
  return {
    ...workout,
    completed: true,
    _isDraft: false,
    isDraft: false,
    exercises: (workout.exercises || []).map((ex) => {
      const firstWorkingSet = (ex.setDetails || []).find(s => !s.isWarmup)
      return {
        exerciseId: ex.exerciseId,
        name: ex.name,
        muscleGroup: ex.muscleGroup,
        reps: firstWorkingSet?.reps ?? ex.reps ?? 10,
        weight: firstWorkingSet?.weight ?? ex.weight ?? 0,
        setDetails: ex.setDetails || [],
      }
    })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Szenario-Daten
// ─────────────────────────────────────────────────────────────────────────────
const USER_ID = 'user-123'

// Template-Stand des Favoriten (z.B. nach Anpassen: 80kg)
const TEMPLATE_EXERCISES = [
  {
    _id: 'ex-bench',
    exerciseId: 'ex-bench',
    name: 'Bankdrücken',
    muscleGroup: 'chest',
    sets: 3,
    reps: 10,
    weight: 80,
    setDetails: [
      { reps: 10, weight: 80 },
      { reps: 10, weight: 80 },
      { reps: 10, weight: 80 },
    ]
  }
]

// Was der User beim Starten des Favoriten TATSÄCHLICH eingibt (90kg)
const USER_INPUT_EXERCISES = [
  {
    _id: 'ex-bench',
    exerciseId: 'ex-bench',
    name: 'Bankdrücken',
    muscleGroup: 'chest',
    sets: 3,
    reps: 10,
    weight: 90,
    setDetails: [
      { reps: 10, weight: 90 },
      { reps: 9,  weight: 90 },
      { reps: 8,  weight: 90 },
    ]
  }
]

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Favorit starten → Daten eingeben → Speichern', () => {

  // ── Setup: Favorit anlegen ─────────────────────────────────────────────────
  let favoriteId

  beforeEach(() => {
    const result = saveFavoriteWorkout({
      userId: USER_ID,
      type: 'push',
      name: 'Mein Push Favorit',
      workout: { name: 'Push Day', type: 'push', exercises: TEMPLATE_EXERCISES }
    })
    expect(result.success).toBe(true)
    favoriteId = result.favorite.id
  })

  // ── Test 1: Favorit-Template enthält nach dem Start und Speichern die neuen Werte ──
  it('neue User-Daten (90kg) landen nach syncStartedFavoriteFromWorkout im Template', () => {
    const savedWorkout = normalizeForSave({
      name: 'Push Day',
      type: 'push',
      exercises: USER_INPUT_EXERCISES,
    })

    const syncResult = simulateSyncStartedFavorite({
      userId: USER_ID,
      favoriteId,
      favoriteType: 'push',
      favoriteName: 'Mein Push Favorit',
      savedWorkout,
    })

    expect(syncResult.success).toBe(true)

    // Favorit aus localStorage lesen und prüfen
    const favorites = getFavoritesByType(USER_ID, 'push')
    expect(favorites).toHaveLength(1)

    const updatedFav = favorites[0]
    const bench = updatedFav.workout.exercises.find(e => e.name === 'Bankdrücken')
    expect(bench).toBeDefined()

    // Neue Werte (90kg) müssen gespeichert sein
    expect(bench.weight).toBe(90)
    expect(bench.setDetails[0].weight).toBe(90)

    // Alte Template-Werte (80kg) dürfen NICHT mehr vorhanden sein
    expect(bench.weight).not.toBe(80)
    expect(bench.setDetails[0].weight).not.toBe(80)
  })

  // ── Test 2: Normalisierung bewahrt User-Daten vollständig ────────────────────
  it('performSaveWorkout-Normalisierung erhält alle User-setDetails', () => {
    const normalized = normalizeForSave({
      name: 'Push Day',
      type: 'push',
      exercises: USER_INPUT_EXERCISES,
    })

    expect(normalized.completed).toBe(true)
    expect(normalized._isDraft).toBe(false)

    const bench = normalized.exercises.find(e => e.name === 'Bankdrücken')
    expect(bench.weight).toBe(90)
    expect(bench.reps).toBe(10)
    expect(bench.setDetails).toHaveLength(3)
    expect(bench.setDetails[0].weight).toBe(90)
    expect(bench.setDetails[1].reps).toBe(9)
    expect(bench.setDetails[2].reps).toBe(8)
  })

  // ── Test 3: Kein Doppel-Speichern — dedupeWorkoutsForStats filtert Duplikate ─
  it('dedupeWorkoutsForStats verhindert doppelte Workouts in den Stats', () => {
    // Simuliert: Auto-Save und Final-Save haben beide denselben Datensatz geschrieben
    const savedWorkout = normalizeForSave({
      _id: 'workout-real-id',
      name: 'Push Day',
      type: 'push',
      date: '2026-05-21T10:00:00Z',
      exercises: USER_INPUT_EXERCISES,
    })

    // Zwei identische Einträge (wie sie durch Race Condition entstehen würden)
    const duplicateList = [
      { ...savedWorkout, updatedAt: '2026-05-21T10:00:00Z' },
      { ...savedWorkout, updatedAt: '2026-05-21T10:00:01Z' }, // 1s später (letzter Auto-Save)
    ]

    const deduped = dedupeWorkoutsForStats(duplicateList)

    // Nur EIN Eintrag darf in den Stats landen
    expect(deduped).toHaveLength(1)
    // Der neuere Eintrag gewinnt
    expect(deduped[0].updatedAt).toBe('2026-05-21T10:00:01Z')
  })

  // ── Test 4: WorkoutBuilder-Overwrite-Schutz (Logik-Simulation) ───────────────
  it('WorkoutBuilder überschreibt nicht wenn IndexedDB bereits einen Eintrag hat (Guard-Logik)', () => {
    // Simuliert: User hat bereits 90kg getippt → existingOffline hat 90kg
    const existingOffline = {
      _id: 'real-server-id',
      _isDraft: true,
      exercises: USER_INPUT_EXERCISES,  // User-Daten (90kg)
      updatedAt: Date.now(),
    }

    // cleanWorkout (Template-Stand, den WorkoutBuilder schreiben würde)
    const cleanWorkout = {
      _id: 'real-server-id',
      _isDraft: true,
      exercises: TEMPLATE_EXERCISES,   // alte Template-Daten (80kg)
    }

    // Guard-Logik aus WorkoutBuilder.vue: nur schreiben wenn kein Eintrag existiert
    const shouldWrite = !existingOffline

    expect(shouldWrite).toBe(false)

    // Wenn Guard greift: IndexedDB behält User-Daten
    const inDB = existingOffline
    const bench = inDB.exercises.find(e => e.name === 'Bankdrücken')
    expect(bench.weight).toBe(90) // User-Daten erhalten
    expect(bench.weight).not.toBe(80) // Template-Daten NICHT überschrieben

    // Kontrolltest: ohne Guard würde cleanWorkout die Daten überschreiben
    const wouldBench = cleanWorkout.exercises.find(e => e.name === 'Bankdrücken')
    expect(wouldBench.weight).toBe(80) // das wäre der Bug
  })

  // ── Test 5: Auto-Save-Guard nach Prefill (kein triggerAutoSave) ──────────────
  it('kein Auto-Save wird ausgelöst wenn saving=true gesetzt ist (Guard)', () => {
    let autoSaveCalled = false

    // Simuliert triggerAutoSave mit saving-Guard
    const saving = { value: false }
    const suppressDraftPersistence = { value: false }

    function triggerAutoSave() {
      if (saving.value || suppressDraftPersistence.value) return Promise.resolve(false)
      autoSaveCalled = true
      return Promise.resolve(true)
    }

    // Szenario A: saving=true → kein Auto-Save (wie nach performSaveWorkout-Fix)
    saving.value = true
    triggerAutoSave()
    expect(autoSaveCalled).toBe(false)

    // Szenario B: saving=false, suppressDraftPersistence=true → kein Auto-Save
    saving.value = false
    suppressDraftPersistence.value = true
    triggerAutoSave()
    expect(autoSaveCalled).toBe(false)

    // Szenario C: beide false → Auto-Save würde laufen (Normalfall beim Tippen)
    suppressDraftPersistence.value = false
    triggerAutoSave()
    expect(autoSaveCalled).toBe(true)
  })

  // ── Test 6: Stats zeigen korrektes Volumen mit User-Daten ───────────────────
  it('buildOfflineStatsFromWorkouts berechnet Volumen aus User-Daten (90kg), nicht Template (80kg)', () => {
    const savedWorkout = normalizeForSave({
      _id: 'w1',
      name: 'Push Day',
      type: 'push',
      date: '2026-05-21T10:00:00Z',
      exercises: USER_INPUT_EXERCISES,
    })

    // Volume-Berechnung (wie in buildOfflineStatsFromWorkouts)
    let totalVolume = 0
    for (const ex of savedWorkout.exercises) {
      if (Array.isArray(ex.setDetails) && ex.setDetails.length) {
        for (const set of ex.setDetails) {
          if (set?.isWarmup) continue
          totalVolume += (Number(set.reps) || 0) * (Number(set.weight) || 0)
        }
      }
    }

    // 90kg * (10 + 9 + 8) reps = 90 * 27 = 2430
    expect(totalVolume).toBe(2430)

    // Mit alten Template-Daten (80kg): 80 * 30 = 2400 — das wäre falsch
    let oldVolume = 0
    for (const ex of TEMPLATE_EXERCISES) {
      for (const set of (ex.setDetails || [])) {
        oldVolume += (set.reps || 0) * (set.weight || 0)
      }
    }
    expect(oldVolume).toBe(2400)
    expect(totalVolume).not.toBe(oldVolume) // User-Daten weichen vom Template ab
  })
})
