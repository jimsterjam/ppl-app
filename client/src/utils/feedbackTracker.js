/**
 * Lädt KI-Feedback automatisch nach, wenn es beim Speichern nicht sofort fertig wurde.
 *
 * Hintergrund (Render-Logs 29.09.): Server und KI-Relay laufen im Render-Free-Plan und schlafen
 * nach ~15 Min. ein. Zwei Kaltstarts hintereinander dauerten teils mehrere Minuten - die App
 * gab nach 60 s auf und zeigte eine rohe Timeout-Meldung. Jetzt:
 *   - PostWorkoutSummary / Feedback-Verlauf übergeben unfertige Analysen hierher,
 *   - dieser Tracker fragt im Hintergrund mit wachsendem Abstand erneut an (solange die App
 *     offen ist, beim Zurückkehren in die App und beim Start),
 *   - sobald das Feedback da ist, kommt eine Meldung (FEEDBACK_READY_EVENT -> Toast in main.js)
 *     und offene Ansichten laden neu (AI_FEEDBACK_UPDATED_EVENT).
 * Nach GIVE_UP_AFTER_MS hört die App auf; der Feedback-Verlauf zeigt dann "Erneut versuchen"
 * (Server liefert den Status 'failed', siehe server/utils/feedbackStatus.js).
 */
import axios from 'axios'
import { apiUrl } from '@/api/http'
import { useFirebaseAuth } from './firebaseAuth'
import { logger } from './logger'
import { getAppLanguage } from '@/i18n'
import { isValidObjectId } from './workoutHelpers'
import { AI_FEEDBACK_UPDATED_EVENT } from './offlineStorage'

const STORAGE_KEY = 'ppl_feedback_tracker_v1'
export const FEEDBACK_READY_EVENT = 'ai-feedback-ready'
import {
  RETRY_DELAYS_MS,
  GIVE_UP_AFTER_MS,
  REQUEST_TIMEOUT_MS,
  nextDelayMs,
  classifyFeedbackResponse,
  isFinalHttpError
} from './feedbackRetryRules'

export { RETRY_DELAYS_MS, GIVE_UP_AFTER_MS }
const TICK_MS = 15_000

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function save(list) {
  try {
    if (list.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

/** Analyse für dieses Workout beobachten und nachladen (idempotent). */
export function trackPendingFeedback(workoutId, { name = '', firstDelayMs = RETRY_DELAYS_MS[0] } = {}) {
  const id = String(workoutId || '').trim()
  if (!isValidObjectId(id)) return
  const list = load()
  const existing = list.find((entry) => entry.id === id)
  if (existing) {
    if (name && !existing.name) existing.name = name
  } else {
    list.push({ id, name, queuedAt: Date.now(), attempts: 0, nextAt: Date.now() + firstDelayMs })
  }
  save(list)
}

export function untrackFeedback(workoutId) {
  const id = String(workoutId || '').trim()
  const list = load()
  const next = list.filter((entry) => entry.id !== id)
  if (next.length !== list.length) save(next)
}

export function isFeedbackTracked(workoutId) {
  const id = String(workoutId || '').trim()
  return load().some((entry) => entry.id === id)
}

function emit(name, detail) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(name, { detail }))
}

let running = false

/** Einmal alle fälligen Einträge abarbeiten. */
export async function runFeedbackTracker() {
  if (running) return
  running = true
  try {
    const now = Date.now()
    const due = load().filter((entry) => (entry.nextAt || 0) <= now)
    if (!due.length) return

    const { getIdToken } = useFirebaseAuth()
    const token = await getIdToken().catch(() => null)
    if (!token) return

    for (const entry of due) {
      // Aufgeben: der Feedback-Verlauf zeigt dann "Erneut versuchen" (Server-Status 'failed').
      if (Date.now() - (entry.queuedAt || 0) > GIVE_UP_AFTER_MS) {
        untrackFeedback(entry.id)
        emit(AI_FEEDBACK_UPDATED_EVENT, { workoutId: entry.id })
        continue
      }
      let outcome = 'retry'
      let data = null
      try {
        const response = await axios.post(
          `${apiUrl('workouts')}/${entry.id}/ai-analysis`,
          { language: getAppLanguage() },
          { headers: { Authorization: `Bearer ${token}` }, timeout: REQUEST_TIMEOUT_MS }
        )
        data = response.data
        outcome = classifyFeedbackResponse(data)
      } catch (err) {
        outcome = isFinalHttpError(err?.response?.status) ? 'final' : 'retry'
        logger.debug('[feedbackTracker] Versuch fehlgeschlagen', { id: entry.id, status: err?.response?.status, message: err?.message })
      }

      if (outcome === 'retry') {
        const list = load()
        const current = list.find((item) => item.id === entry.id)
        if (current) {
          current.attempts = (current.attempts || 0) + 1
          current.nextAt = Date.now() + nextDelayMs(current.attempts)
          save(list)
        }
        continue
      }

      untrackFeedback(entry.id)
      emit(AI_FEEDBACK_UPDATED_EVENT, { workoutId: entry.id })
      if (outcome === 'ready') emit(FEEDBACK_READY_EVENT, { workoutId: entry.id, name: entry.name || '' })
    }
  } finally {
    running = false
  }
}

let started = false

/** App-weit einmal starten (main.js): läuft, solange die App im Vordergrund ist. */
export function startFeedbackTracker() {
  if (started || typeof window === 'undefined') return
  started = true
  const tick = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    runFeedbackTracker().catch((error) => logger.warn('[feedbackTracker] Lauf fehlgeschlagen', error?.message))
  }
  setInterval(tick, TICK_MS)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // Beim Zurückkehren in die App sofort nachsehen statt auf den nächsten Takt zu warten.
      const list = load()
      if (list.length) {
        list.forEach((entry) => { entry.nextAt = Math.min(entry.nextAt || 0, Date.now()) })
        save(list)
      }
      tick()
    }
  })
  tick()
}
