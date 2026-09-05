import { useFirebaseAuth } from './firebaseAuth'
import { fetchFavoriteWorkoutsRemote, pushFavoriteWorkoutRemote, deleteFavoriteWorkoutRemote } from '@/api/favoriteWorkouts'
import { logger } from './logger'

// Favoriten wurden bisher AUSSCHLIESSLICH in localStorage gehalten - bei Geräteverlust,
// Neuinstallation oder einem Identitätswechsel (z.B. Login über einen anderen Firebase-
// Provider mit neuer UID) gingen sie unwiederbringlich verloren (siehe Apple-Sign-In-Fall).
// localStorage bleibt bewusst die primäre, sofort verfügbare Quelle (kein Verhalten für
// bestehende Aufrufer ändert sich) - zusätzlich wird jede Änderung best-effort und
// nicht-blockierend an den Server gespiegelt (siehe syncFavoriteInBackground/
// syncFavoriteDeleteInBackground unten sowie reconcileFavoritesWithServer() für den
// Restore-Fall beim Login).
const FAVORITES_KEY = 'bro_split_favorite_workouts_v1'
const MAX_FAVORITES_PER_TYPE = 10
const ALL_FAVORITE_TYPES = ['push', 'pull', 'legs', 'fullbody']

async function getTokenSafe() {
  try {
    const { getIdToken } = useFirebaseAuth()
    return await getIdToken()
  } catch (err) {
    logger.debug('[workoutFavorites] Kein Token für Server-Sync verfügbar', err?.message)
    return null
  }
}

// Fire-and-forget: blockiert nie die aufrufende UI-Funktion, wirft nie einen Fehler nach
// oben. Bei Fehlschlag bleibt der Favorit einfach nur lokal bis zum nächsten erfolgreichen
// reconcileFavoritesWithServer()-Lauf (z.B. beim nächsten Login).
function syncFavoriteInBackground(favorite) {
  getTokenSafe().then((token) => {
    if (!token) return
    return pushFavoriteWorkoutRemote({
      clientId: favorite.id,
      type: favorite.type,
      name: favorite.name,
      workout: favorite.workout
    }, token)
  }).catch((err) => {
    logger.debug('[workoutFavorites] Server-Sync (Speichern) fehlgeschlagen, bleibt vorerst nur lokal', err?.message)
  })
}

function syncFavoriteDeleteInBackground(clientId) {
  getTokenSafe().then((token) => {
    if (!token) return
    return deleteFavoriteWorkoutRemote(clientId, token)
  }).catch((err) => {
    logger.debug('[workoutFavorites] Server-Sync (Löschen) fehlgeschlagen', err?.message)
  })
}

function nowIso() {
  return new Date().toISOString()
}

function safeParse(raw) {
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function readStore() {
  try {
    return safeParse(localStorage.getItem(FAVORITES_KEY))
  } catch {
    return {}
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(store || {}))
    return true
  } catch {
    return false
  }
}

export function normalizeWorkoutType(type) {
  const value = String(type || '').toLowerCase().trim()
  if (value === 'push' || value === 'pull' || value === 'legs' || value === 'fullbody') return value
  if (value === 'leg') return 'legs'
  if (value === 'freestyle') return 'fullbody'
  return 'push'
}

export function normalizeFavoriteName(name) {
  return String(name || '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isFavoriteNameValid(name) {
  const normalized = normalizeFavoriteName(name)
  if (!normalized) return false
  return /^[\p{L}\p{N} ]+$/u.test(normalized)
}

export function getFavoriteNameValidationError(name) {
  const normalized = normalizeFavoriteName(name)
  if (!normalized) return 'Bitte gib einen Namen ein.'
  if (!isFavoriteNameValid(normalized)) {
    return 'Nur Buchstaben, Zahlen und Leerzeichen sind erlaubt.'
  }
  return ''
}

function getUserBucket(store, userId = 'guest') {
  const uid = String(userId || 'guest')
  if (!store[uid] || typeof store[uid] !== 'object') {
    store[uid] = { push: [], pull: [], legs: [], fullbody: [] }
  }
  const bucket = store[uid]
  ;['push', 'pull', 'legs', 'fullbody'].forEach((type) => {
    if (!Array.isArray(bucket[type])) bucket[type] = []
  })
  return bucket
}

function makeFavoriteId(type) {
  return `fav_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function buildFavoriteWorkoutPayload(workout, type) {
  const source = workout && typeof workout === 'object' ? workout : {}
  const exercises = Array.isArray(source.exercises) ? source.exercises : []

  return {
    type: normalizeWorkoutType(source.type || type),
    workoutName: String(source.name || source.workoutName || '').trim(),
    notes: typeof source.notes === 'string' ? source.notes : '',
    exercises: exercises.map((exercise, index) => ({
      _id: exercise?._id || `fav_ex_${index}`,
      exerciseId: exercise?.exerciseId || exercise?._id || null,
      name: String(exercise?.name || '').trim(),
      category: String(exercise?.category || source.type || type || '').toLowerCase(),
      muscleGroup: exercise?.muscleGroup || String(type || source.type || 'push'),
      sets: Number(exercise?.sets) || 3,
      reps: Number(exercise?.reps) || Number(exercise?.setDetails?.[0]?.reps) || 10,
      weight: Number(exercise?.weight) || Number(exercise?.setDetails?.[0]?.weight) || 0,
      rest: Number(exercise?.rest) || 90,
      setDetails: Array.isArray(exercise?.setDetails) && exercise.setDetails.length
        ? exercise.setDetails.map((set) => ({
            reps: Number(set?.reps) || 10,
            weight: Number(set?.weight) || 0,
            ...(set?.isWarmup ? { isWarmup: true } : {})
          }))
        : [{
            reps: Number(exercise?.reps) || 10,
            weight: Number(exercise?.weight) || 0
          }]
    })).filter((exercise) => exercise.name)
  }
}

export function getFavoritesByType(userId = 'guest', type = 'push') {
  const store = readStore()
  const bucket = getUserBucket(store, userId)
  const key = normalizeWorkoutType(type)
  return [...bucket[key]].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
}

export function saveFavoriteWorkout({ userId = 'guest', type = 'push', name, workout }) {
  const normalizedType = normalizeWorkoutType(type)
  const normalizedName = normalizeFavoriteName(name)
  const nameError = getFavoriteNameValidationError(normalizedName)
  if (nameError) {
    return { success: false, code: 'INVALID_NAME', message: nameError }
  }

  const store = readStore()
  const bucket = getUserBucket(store, userId)
  const list = bucket[normalizedType]

  if (list.length >= MAX_FAVORITES_PER_TYPE) {
    return {
      success: false,
      code: 'LIMIT_REACHED',
      message: 'Limit erreicht: Du kannst pro Typ maximal 10 Favoriten speichern. Lösche zuerst einen bestehenden Favoriten.'
    }
  }

  const payload = buildFavoriteWorkoutPayload(workout, normalizedType)
  const timestamp = nowIso()
  const favorite = {
    id: makeFavoriteId(normalizedType),
    type: normalizedType,
    name: normalizedName,
    workout: payload,
    createdAt: timestamp,
    updatedAt: timestamp
  }

  list.push(favorite)
  const saved = writeStore(store)
  if (!saved) return { success: false, code: 'STORAGE_ERROR', message: 'Favorit konnte nicht gespeichert werden (Storage voll?).' }
  syncFavoriteInBackground(favorite)
  return { success: true, favorite }
}

export function updateFavoriteWorkout({ userId = 'guest', type = 'push', id, workout, name }) {
  const favoriteId = String(id || '').trim()
  if (!favoriteId) {
    return { success: false, code: 'INVALID_ID', message: 'Favorit wurde nicht gefunden.' }
  }

  const store = readStore()
  const bucket = getUserBucket(store, userId)
  const normalizedType = normalizeWorkoutType(type)

  const allTypes = ['push', 'pull', 'legs', 'fullbody']
  let foundType = null
  let foundIndex = -1

  for (const key of allTypes) {
    const idx = bucket[key].findIndex((entry) => String(entry?.id || '') === favoriteId)
    if (idx !== -1) {
      foundType = key
      foundIndex = idx
      break
    }
  }

  if (foundIndex === -1 || !foundType) {
    return { success: false, code: 'NOT_FOUND', message: 'Favorit wurde nicht gefunden.' }
  }

  const current = bucket[foundType][foundIndex] || {}
  const sourceWorkout = workout && typeof workout === 'object' ? workout : current.workout
  const payload = buildFavoriteWorkoutPayload(sourceWorkout, normalizedType || foundType)
  const nextName = normalizeFavoriteName(name || current.name || '')
  const nameError = getFavoriteNameValidationError(nextName)
  if (nameError) {
    return { success: false, code: 'INVALID_NAME', message: nameError }
  }

  bucket[foundType][foundIndex] = {
    ...current,
    type: foundType,
    name: nextName,
    workout: payload,
    updatedAt: nowIso()
  }

  const saved = writeStore(store)
  if (!saved) return { success: false, code: 'STORAGE_ERROR', message: 'Favorit konnte nicht aktualisiert werden (Storage voll?).' }
  syncFavoriteInBackground(bucket[foundType][foundIndex])
  return { success: true, favorite: bucket[foundType][foundIndex] }
}

export function renameFavoriteWorkout({ userId = 'guest', type = 'push', id, name }) {
  const normalizedType = normalizeWorkoutType(type)
  const normalizedName = normalizeFavoriteName(name)
  const nameError = getFavoriteNameValidationError(normalizedName)
  if (nameError) {
    return { success: false, code: 'INVALID_NAME', message: nameError }
  }

  const store = readStore()
  const bucket = getUserBucket(store, userId)
  const list = bucket[normalizedType]
  const index = list.findIndex((entry) => String(entry?.id || '') === String(id || ''))
  if (index === -1) {
    return { success: false, code: 'NOT_FOUND', message: 'Favorit wurde nicht gefunden.' }
  }

  list[index] = {
    ...list[index],
    name: normalizedName,
    updatedAt: nowIso()
  }
  writeStore(store)
  syncFavoriteInBackground(list[index])
  return { success: true, favorite: list[index] }
}

export function deleteFavoriteWorkout({ userId = 'guest', type = 'push', id }) {
  const normalizedType = normalizeWorkoutType(type)
  const store = readStore()
  const bucket = getUserBucket(store, userId)
  const list = bucket[normalizedType]
  const next = list.filter((entry) => String(entry?.id || '') !== String(id || ''))
  if (next.length === list.length) {
    return { success: false, code: 'NOT_FOUND', message: 'Favorit wurde nicht gefunden.' }
  }
  bucket[normalizedType] = next
  writeStore(store)
  syncFavoriteDeleteInBackground(String(id || ''))
  return { success: true }
}

export function getFavoriteLimitPerType() {
  return MAX_FAVORITES_PER_TYPE
}

// Gleicht die lokalen Favoriten mit dem Server ab - der eigentliche "Restore"-Baustein:
// - Server-Favoriten, die lokal fehlen (z.B. nach Neuinstallation, Geräteverlust oder einem
//   UID-Wechsel wie im Apple-Sign-In-Fall), werden lokal ergänzt.
// - Lokale Favoriten, die dem Server noch fehlen (z.B. weil sie offline angelegt wurden oder
//   der Fire-and-Forget-Sync fehlgeschlagen ist), werden jetzt nachgeliefert.
// - Bei Konflikt (beide vorhanden) gewinnt schlicht der zuletzt geänderte Stand (updatedAt).
// Gedacht zum Aufruf beim Login (siehe main.js), muss nicht die UI blockieren - kann also
// unawaited im Hintergrund laufen, gibt aber ein Promise zurück, falls der Aufrufer warten will.
export async function reconcileFavoritesWithServer(userId, token) {
  if (!userId || !token) return { pulled: 0, pushed: 0 }

  const remoteList = await fetchFavoriteWorkoutsRemote(token)
  const store = readStore()
  const bucket = getUserBucket(store, userId)
  const remoteIds = new Set(remoteList.map((r) => String(r?.clientId || '')))

  let pulled = 0
  for (const remote of remoteList) {
    const clientId = String(remote?.clientId || '')
    if (!clientId) continue
    const type = normalizeWorkoutType(remote.type)
    const list = bucket[type]
    const idx = list.findIndex((entry) => String(entry?.id || '') === clientId)
    const remoteFavorite = {
      id: clientId,
      type,
      name: remote.name,
      workout: remote.workout,
      createdAt: remote.createdAt || nowIso(),
      updatedAt: remote.updatedAt || remote.createdAt || nowIso()
    }

    if (idx === -1) {
      list.push(remoteFavorite)
      pulled += 1
    } else {
      const localTime = new Date(list[idx]?.updatedAt || 0).getTime()
      const remoteTime = new Date(remoteFavorite.updatedAt || 0).getTime()
      if (remoteTime > localTime) {
        list[idx] = { ...list[idx], ...remoteFavorite }
        pulled += 1
      }
    }
  }

  // Pro-Typ-Limit nach dem Merge absichern (falls Server+Lokal zusammen über 10 liegen) -
  // behalte die zuletzt aktualisierten.
  for (const type of ALL_FAVORITE_TYPES) {
    if (bucket[type].length > MAX_FAVORITES_PER_TYPE) {
      bucket[type] = [...bucket[type]]
        .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
        .slice(0, MAX_FAVORITES_PER_TYPE)
    }
  }

  writeStore(store)

  // Lokale Favoriten, die der Server noch nicht kennt, jetzt nachliefern.
  const toPush = []
  for (const type of ALL_FAVORITE_TYPES) {
    for (const favorite of bucket[type]) {
      if (!remoteIds.has(String(favorite?.id || ''))) {
        toPush.push(favorite)
      }
    }
  }

  let pushed = 0
  for (const favorite of toPush) {
    const result = await pushFavoriteWorkoutRemote({
      clientId: favorite.id,
      type: favorite.type,
      name: favorite.name,
      workout: favorite.workout
    }, token)
    if (result) pushed += 1
  }

  return { pulled, pushed }
}
