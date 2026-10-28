import { useFirebaseAuth } from './firebaseAuth'
import { fetchTrainingPlansRemote, pushTrainingPlanRemote, deleteTrainingPlanRemote } from '@/api/trainingPlans'
import { logger } from './logger'
import {
  PLAN_LIMITS,
  canCreatePlan,
  createPlan,
  ensureSingleActive,
  getActivePlan,
  mergePlans,
  normalizePlan,
  setActivePlan
} from './trainingPlan'

// Speicher für Trainingspläne (Absprache Paul 28.10.): localStorage pro Nutzer ist die primäre, sofort verfügbare Quelle;
// jede Änderung wird best-effort und nicht blockierend an den Server gespiegelt (gleiches Muster wie die Favoriten in
// utils/workoutFavorites.js, bewusst NICHT über die robuste Workout-Sync-Warteschlange). Die Logik selbst (Rotation,
// Tage, Limits) steckt in utils/trainingPlan.js.
const PLANS_KEY = 'fbe_training_plans_v1'

function readStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PLANS_KEY))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(PLANS_KEY, JSON.stringify(store || {}))
    return true
  } catch {
    return false
  }
}

async function getTokenSafe() {
  try {
    const { getIdToken } = useFirebaseAuth()
    return await getIdToken()
  } catch (err) {
    logger.debug('[trainingPlanStorage] Kein Token für Server-Sync verfügbar', err?.message)
    return null
  }
}

function syncPlanInBackground(plan) {
  getTokenSafe().then((token) => (token ? pushTrainingPlanRemote(plan, token) : null)).catch((err) => {
    logger.debug('[trainingPlanStorage] Server-Sync (Speichern) fehlgeschlagen, bleibt vorerst lokal', err?.message)
  })
}

// Spiegelt alle Pläne, die neu oder gegenüber `before` in irgendeinem Feld geändert sind.
function syncChanged(before, after) {
  const old = new Map(before.map((plan) => [plan.id, plan]))
  after.forEach((plan) => {
    const prev = old.get(plan.id)
    if (!prev || JSON.stringify(prev) !== JSON.stringify(plan)) syncPlanInBackground(plan)
  })
}

function syncDeleteInBackground(planId) {
  getTokenSafe().then((token) => (token ? deleteTrainingPlanRemote(planId, token) : null)).catch((err) => {
    logger.debug('[trainingPlanStorage] Server-Sync (Löschen) fehlgeschlagen', err?.message)
  })
}

/** Alle Pläne des Nutzers (bereinigt, genau einer aktiv). */
export function getTrainingPlans(userId = 'guest') {
  const raw = readStore()[String(userId || 'guest')]
  const plans = (Array.isArray(raw) ? raw : []).map((entry) => normalizePlan(entry)).filter(Boolean)
  return ensureSingleActive(plans.slice(0, PLAN_LIMITS.maxPlans))
}

export function getActiveTrainingPlan(userId = 'guest') {
  return getActivePlan(getTrainingPlans(userId))
}

function saveAll(userId, plans) {
  const store = readStore()
  store[String(userId || 'guest')] = plans
  return writeStore(store)
}

/**
 * Neuen Plan anlegen (der erste Plan wird automatisch aktiv, sonst nur mit `makeActive`).
 * @returns {{ ok: boolean, plan?: object, error?: 'limit'|'invalid'|'storage' }}
 */
export function createTrainingPlan({ userId = 'guest', name, days, makeActive = false } = {}) {
  const plans = getTrainingPlans(userId)
  if (!canCreatePlan(plans)) return { ok: false, error: 'limit' }
  const plan = createPlan({ name, days, active: makeActive || plans.length === 0 })
  if (!plan) return { ok: false, error: 'invalid' }
  let next = [...plans, plan]
  if (plan.active) next = setActivePlan(next.map((entry) => (entry.id === plan.id ? entry : { ...entry, active: false })), plan.id)
  if (!saveAll(userId, next)) return { ok: false, error: 'storage' }
  syncChanged(plans, next)
  return { ok: true, plan: next.find((entry) => entry.id === plan.id) }
}

/**
 * Einen Plan ändern: `updater(plan)` liefert den neuen Plan, `null` löscht ihn (z. B. wenn kein Tag übrig bleibt).
 * @returns {{ ok: boolean, plan?: object|null, error?: 'notFound'|'storage' }}
 */
export function updateTrainingPlan({ userId = 'guest', planId, updater } = {}) {
  const plans = getTrainingPlans(userId)
  const current = plans.find((plan) => plan.id === planId)
  if (!current) return { ok: false, error: 'notFound' }
  const updated = updater(current)
  if (updated === null) return deleteTrainingPlan({ userId, planId })
  const normalized = normalizePlan(updated)
  if (!normalized) return { ok: false, error: 'storage' }
  const next = ensureSingleActive(plans.map((plan) => (plan.id === planId ? normalized : plan)))
  if (!saveAll(userId, next)) return { ok: false, error: 'storage' }
  syncChanged(plans, next)
  return { ok: true, plan: next.find((plan) => plan.id === planId) }
}

export function deleteTrainingPlan({ userId = 'guest', planId } = {}) {
  const plans = getTrainingPlans(userId)
  if (!plans.some((plan) => plan.id === planId)) return { ok: false, error: 'notFound' }
  const wasActive = plans.find((plan) => plan.id === planId)?.active
  const rest = ensureSingleActive(plans.filter((plan) => plan.id !== planId))
  if (!saveAll(userId, rest)) return { ok: false, error: 'storage' }
  syncDeleteInBackground(planId)
  // Wurde der aktive Plan gelöscht, übernimmt ein anderer: dessen Änderung ebenfalls spiegeln.
  if (wasActive) syncChanged(plans, rest)
  return { ok: true, plan: null }
}

export function activateTrainingPlan({ userId = 'guest', planId, now } = {}) {
  const plans = getTrainingPlans(userId)
  const next = setActivePlan(plans, planId, now)
  if (next === plans) return { ok: false, error: 'notFound' }
  if (!saveAll(userId, next)) return { ok: false, error: 'storage' }
  syncChanged(plans, next)
  return { ok: true, plan: getActivePlan(next) }
}

/**
 * Gleicht lokale Pläne mit dem Server ab (Restore nach Neuinstallation/Gerätewechsel, nachliefern bei Offline-Anlage).
 * Je Plan gewinnt der zuletzt geänderte Stand; höchstens 3 Pläne bleiben. Gedacht für den Login (nicht blockierend).
 */
export async function reconcileTrainingPlansWithServer(userId, token) {
  if (!userId || !token) return { pulled: 0, pushed: 0 }
  const remote = await fetchTrainingPlansRemote(token)
  const local = getTrainingPlans(userId)
  const remoteById = new Map(remote.map((entry) => [String(entry?.clientId || ''), entry]))
  const merged = mergePlans(local, remote.map((entry) => ({ ...entry, id: entry.clientId })))
  const localById = new Map(local.map((plan) => [plan.id, plan]))
  const pulled = merged.filter((plan) => !localById.has(plan.id) || localById.get(plan.id).updatedAt !== plan.updatedAt).length
  saveAll(userId, merged)

  let pushed = 0
  for (const plan of merged) {
    const known = remoteById.get(plan.id)
    if (known && new Date(known.updatedAt || 0).getTime() >= new Date(plan.updatedAt).getTime()) continue
    if (await pushTrainingPlanRemote(plan, token)) pushed += 1
  }
  return { pulled, pushed }
}
