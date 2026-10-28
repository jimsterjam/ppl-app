import { createResourceApi } from './http'
import { logger } from '@/utils/logger'
import { isOnline } from '@/utils/offlineStorage'

const api = createResourceApi('training-plans')

// Best-effort Server-Sicherung der Trainingspläne (siehe utils/trainingPlanStorage.js) - wie bei den Favoriten:
// localStorage ist die primäre Quelle, diese Aufrufe sind "fire and forget" und werfen nie in die UI.

export async function fetchTrainingPlansRemote(token) {
  if (!token || !isOnline()) return []
  try {
    const res = await api.get('', { headers: { Authorization: `Bearer ${token}` } })
    return Array.isArray(res.data) ? res.data : []
  } catch (error) {
    logger.warn('[trainingPlans API] Laden fehlgeschlagen', error?.message)
    return []
  }
}

// Legt einen Plan serverseitig an oder aktualisiert ihn (Upsert nach clientId).
export async function pushTrainingPlanRemote(plan, token) {
  if (!token || !isOnline()) return null
  try {
    const res = await api.post('', {
      clientId: plan.id,
      name: plan.name,
      level: plan.level,
      templateId: plan.templateId,
      days: plan.days,
      activeDayIndex: plan.activeDayIndex,
      active: plan.active
    }, { headers: { Authorization: `Bearer ${token}` } })
    return res.data || null
  } catch (error) {
    logger.warn('[trainingPlans API] Speichern fehlgeschlagen', error?.message)
    return null
  }
}

export async function deleteTrainingPlanRemote(clientId, token) {
  if (!token || !isOnline()) return false
  try {
    await api.delete(`/${clientId}`, { headers: { Authorization: `Bearer ${token}` } })
    return true
  } catch (error) {
    logger.warn('[trainingPlans API] Löschen fehlgeschlagen', error?.message)
    return false
  }
}
