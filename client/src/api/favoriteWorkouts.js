import { createResourceApi } from './http'
import { logger } from '@/utils/logger'
import { isOnline } from '@/utils/offlineStorage'

const api = createResourceApi('favorite-workouts')

// Best-effort Server-Sicherung für Favoriten-Workouts (siehe utils/workoutFavorites.js).
// localStorage bleibt die primäre, sofort verfügbare Quelle - diese Aufrufe sind bewusst
// "fire and forget": schlagen sie fehl (offline, Netzwerkfehler), wird nur geloggt, nichts
// blockiert und nichts wirft einen Fehler nach oben in die UI.

export async function fetchFavoriteWorkoutsRemote(token) {
  if (!token || !isOnline()) return []
  try {
    const res = await api.get('', { headers: { Authorization: `Bearer ${token}` } })
    return Array.isArray(res.data) ? res.data : []
  } catch (error) {
    logger.warn('[favoriteWorkouts API] Laden fehlgeschlagen', error?.message)
    return []
  }
}

// Legt einen Favoriten serverseitig an oder aktualisiert ihn (Upsert nach clientId).
export async function pushFavoriteWorkoutRemote({ clientId, type, name, workout }, token) {
  if (!token || !isOnline()) return null
  try {
    const res = await api.post('', { clientId, type, name, workout }, {
      headers: { Authorization: `Bearer ${token}` }
    })
    return res.data || null
  } catch (error) {
    logger.warn('[favoriteWorkouts API] Speichern fehlgeschlagen', error?.message)
    return null
  }
}

export async function deleteFavoriteWorkoutRemote(clientId, token) {
  if (!token || !isOnline()) return false
  try {
    await api.delete(`/${clientId}`, { headers: { Authorization: `Bearer ${token}` } })
    return true
  } catch (error) {
    logger.warn('[favoriteWorkouts API] Löschen fehlgeschlagen', error?.message)
    return false
  }
}
