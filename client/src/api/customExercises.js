import { createResourceApi } from './http'
import { logger } from '@/utils/logger'
import {
  saveCustomExerciseOffline,
  getAllCustomExercisesOffline,
  deleteCustomExerciseOffline,
  cacheCustomExercises,
  generateCustomExerciseId,
  isOnline
} from '@/utils/offlineStorage'

const api = createResourceApi('custom-exercises')

export async function fetchCustomExercises(token = null, userId = null) {
  if (!isOnline()) {
    return userId ? await getAllCustomExercisesOffline({ userId }) : []
  }
  try {
    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {}
    const res = await api.get('', config)
    const list = Array.isArray(res.data) ? res.data : []
    if (list.length) await cacheCustomExercises(list)
    return list
  } catch (error) {
    logger.warn('⚠️ CustomExercises API - fetch fehlgeschlagen, nutze Cache', error?.message)
    return userId ? await getAllCustomExercisesOffline({ userId }) : []
  }
}

export async function createCustomExercise(exerciseData, token = null) {
  const payload = { ...exerciseData }

  if (isOnline()) {
    try {
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {}
      const res = await api.post('', payload, config)
      if (res.data && res.data._id) {
        await saveCustomExerciseOffline({ ...res.data, _pendingSync: false })
        logger.debug('✅ CustomExercises API - online erstellt:', res.data._id)
        return res.data
      }
    } catch (error) {
      logger.warn('⚠️ CustomExercises API - createCustomExercise online fehlgeschlagen, speichere lokal', error?.message)
    }
  }

  const localExercise = {
    ...payload,
    _id: payload._id || generateCustomExerciseId(),
    _pendingSync: true
  }
  await saveCustomExerciseOffline(localExercise)
  logger.debug('💾 CustomExercises API - offline gespeichert:', localExercise._id)
  return localExercise
}

/**
 * Aktualisiert Name/Muskelgruppe/Notiz einer eigenen Übung.
 * @param {string} id
 * @param {Object} updates - { name?, muscleGroup?, notes? }
 * @param {string|null} token
 * @returns {Promise<Object>}
 */
export async function updateCustomExercise(id, updates, token = null) {
  const isLocalOnly = String(id || '').startsWith('custom_')

  if (isOnline() && !isLocalOnly) {
    try {
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {}
      const res = await api.put(`/${id}`, updates, config)
      if (res.data) {
        await saveCustomExerciseOffline({ ...res.data, _pendingSync: false })
        logger.debug('✅ CustomExercises API - online aktualisiert:', id)
        return res.data
      }
    } catch (error) {
      logger.warn('⚠️ CustomExercises API - updateCustomExercise online fehlgeschlagen, speichere lokal', error?.message)
    }
  }

  // Offline-Fallback / lokal-only: bestehenden lokalen Stand mergen
  const existing = (await getAllCustomExercisesOffline({})).find(ex => String(ex._id) === String(id)) || {}
  const merged = { ...existing, ...updates, _id: id, _pendingSync: true }
  await saveCustomExerciseOffline(merged)
  return merged
}

/**
 * Lädt ein Bild für eine eigene Übung hoch. Erfordert eine bereits synchronisierte
 * (Server-)ID — funktioniert nicht für rein lokale custom_-IDs, da der Server
 * die Übung kennen muss, bevor ein Bild zugeordnet werden kann.
 * @param {string} id - Server-ID der Übung
 * @param {File} file - komprimierte Bilddatei (siehe utils/imageCompression.js)
 * @param {string|null} token
 * @returns {Promise<Object>} aktualisierte Übung mit imageUrl
 */
export async function uploadCustomExerciseImage(id, file, token = null) {
  if (String(id || '').startsWith('custom_')) {
    throw new Error('Bild kann erst nach erfolgreicher Synchronisierung hochgeladen werden')
  }
  if (!isOnline()) {
    throw new Error('Bild-Upload benötigt eine Internetverbindung')
  }

  const form = new FormData()
  form.append('image', file)
  const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {}
  const res = await api.post(`/${id}/image`, form, config)
  if (res.data) {
    await saveCustomExerciseOffline({ ...res.data, _pendingSync: false })
  }
  return res.data
}

export async function deleteCustomExercise(id, token = null) {
  const localId = String(id || '')
  const isLocalOnly = localId.startsWith('custom_')

  if (isOnline() && !isLocalOnly) {
    try {
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {}
      await api.delete(`/${id}`, config)
    } catch (error) {
      logger.warn('⚠️ CustomExercises API - delete online fehlgeschlagen, lösche trotzdem lokal', error?.message)
    }
  }

  await deleteCustomExerciseOffline(id)
  return { success: true, _id: id }
}