/**
 * Globale, persistente Warteschlange für "Post-Workout"-KI-Analysen, deren Workout-ID zum
 * Zeitpunkt des Speicherns noch eine temporäre ID war (offline_.../draft-...).
 *
 * Hintergrund (User-Report): "Speichern + Favorit aktualisieren" gefolgt von einer KI-Analyse,
 * die mit 'postworkout.syncPending' endete - anschließend erschien NIE ein Feedback im
 * Feedback-Verlauf, auch nicht viel später. Ursache: PostWorkoutSummary.vue hat den erneuten
 * Versuch bisher nur lokal (Event-Listener auf OFFLINE_WORKOUTS_UPDATED_EVENT) innerhalb der
 * eigenen Komponenten-Lebenszeit verdrahtet. Sobald der Nutzer die Zusammenfassung schließt
 * oder die Ansicht wechselt (was bei "Verstanden"/Navigation der Normalfall ist), wurde der
 * Listener entfernt (onBeforeUnmount) - eine später eintreffende Server-Bestätigung der
 * echten ID (Reconciliation) hatte dann niemanden mehr, der die KI-Analyse nachträglich
 * anstößt. Das Workout selbst wurde korrekt gespeichert, nur die KI-Analyse wurde nie
 * (erneut) angefragt, weshalb 'ai_feedback' auf dem Workout-Dokument dauerhaft leer blieb.
 *
 * Diese Queue überlebt Navigation, Component-Unmounts und App-Neustarts (localStorage) und
 * wird global (main.js) statt komponentengebunden verarbeitet - bei jedem
 * OFFLINE_WORKOUTS_UPDATED_EVENT und einmalig beim App-Start/Login.
 */
import axios from 'axios'
import { apiUrl } from '@/api/http'
import { resolveRealIdFromDraftId, isValidObjectId } from './workoutHelpers'
import { useFirebaseAuth } from './firebaseAuth'
import { logger } from './logger'

const STORAGE_KEY = 'bro_split_pending_ai_feedback_v1'
// Defensive Obergrenze: falls eine temporäre ID nie aufgelöst wird (z.B. Workout wurde nie
// erfolgreich angelegt), soll die Queue nicht unbegrenzt wachsen.
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 3 // 3 Tage
// Bug-Fix (User-Report "429 Too Many Requests" + Server-Logs zeigten denselben ungelösten
// Eintrag über Stunden hinweg bei praktisch jedem App-Start/Reconnect erneut versucht): ohne
// Mindestabstand konnte ein dauerhaft unauflösbarer Eintrag (z.B. wegen des in main.js
// gefixten fehlenden workout_map_-Mappings) bei jedem OFFLINE_WORKOUTS_UPDATED_EVENT erneut
// versucht werden - das verbrauchte unnötig das server-seitige Burst-Rate-Limit-Kontingent
// (6 Anfragen/Minute, siehe aiUtils.js) und blockierte dadurch echte, neue Anfragen.
const RETRY_COOLDOWN_MS = 1000 * 60 * 5 // 5 Minuten zwischen zwei Versuchen für denselben Eintrag
const MAX_ATTEMPTS = 20 // zusätzlich zur 3-Tage-Altersgrenze: harte Obergrenze an Versuchen

function loadQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveQueue(list) {
  try {
    if (!list.length) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    }
  } catch {}
}

export function queuePendingAiFeedback(tempWorkoutId) {
  const id = String(tempWorkoutId || '').trim()
  if (!id) return
  const list = loadQueue()
  if (list.some((entry) => entry.id === id)) return
  list.push({ id, queuedAt: Date.now() })
  saveQueue(list)
  logger.debug('[pendingAiFeedback] Eingereiht', { id })
}

export function clearPendingAiFeedback(tempWorkoutId) {
  const id = String(tempWorkoutId || '').trim()
  if (!id) return
  const list = loadQueue()
  const next = list.filter((entry) => entry.id !== id)
  if (next.length !== list.length) saveQueue(next)
}

// Verhindert parallele Verarbeitungen (z.B. Event + App-Start-Aufruf kurz hintereinander).
let processing = false

export async function processPendingAiFeedback() {
  if (processing) return
  processing = true
  try {
    const list = loadQueue()
    if (!list.length) return

    const now = Date.now()
    const stillPending = []

    for (const entry of list) {
      if (now - (entry.queuedAt || 0) > MAX_AGE_MS) {
        logger.warn('[pendingAiFeedback] Eintrag verworfen (zu alt, > 3 Tage ungelöst)', { id: entry.id })
        continue
      }

      if ((entry.attempts || 0) >= MAX_ATTEMPTS) {
        logger.warn('[pendingAiFeedback] Eintrag verworfen (zu viele erfolglose Versuche)', {
          id: entry.id, attempts: entry.attempts
        })
        continue
      }

      // Mindestabstand zwischen zwei Versuchen für denselben Eintrag (siehe RETRY_COOLDOWN_MS-
      // Kommentar oben) - ohne diesen konnte derselbe dauerhaft ungelöste Eintrag bei jedem
      // App-Start/Reconnect erneut versucht werden und unnötig das Burst-Rate-Limit belegen.
      if (entry.lastAttemptAt && now - entry.lastAttemptAt < RETRY_COOLDOWN_MS) {
        stillPending.push(entry)
        continue
      }

      const realId = await resolveRealIdFromDraftId(entry.id).catch(() => '')
      // Sicherheitsnetz (siehe isValidObjectId-Kommentar in workoutHelpers.js): eine aufgelöste,
      // aber nicht wie eine echte ObjectId aussehende ID wird wie "nicht aufgelöst" behandelt.
      if (!realId || !isValidObjectId(realId)) {
        if (realId) {
          logger.warn('[pendingAiFeedback] Aufgelöste ID hat kein gültiges Format, ignoriere', { tempId: entry.id, realId })
        }
        // Noch keine (gültige) Reconciliation vorhanden - beim nächsten Aufruf erneut versuchen,
        // aber Versuch zählen, damit ein dauerhaft unauflösbarer Eintrag nicht endlos oft pro
        // Tag angefasst wird.
        stillPending.push({ ...entry, attempts: (entry.attempts || 0) + 1, lastAttemptAt: now })
        continue
      }

      try {
        const { getIdToken } = useFirebaseAuth()
        const token = await getIdToken().catch(() => null)
        await axios.post(
          `${apiUrl('workouts')}/${realId}/ai-analysis`,
          {},
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            timeout: 60000
          }
        )
        logger.debug('[pendingAiFeedback] Nachträgliche KI-Analyse ausgelöst', { tempId: entry.id, realId })
        // Angefragt (Ergebnis wird serverseitig auf dem Workout-Dokument gespeichert und
        // erscheint dadurch im Feedback-Verlauf, auch wenn die Zusammenfassung längst
        // geschlossen ist) - aus der Queue entfernen.
      } catch (err) {
        logger.warn('[pendingAiFeedback] Nachträgliche KI-Analyse fehlgeschlagen, später erneut versuchen', {
          tempId: entry.id,
          error: err?.message
        })
        stillPending.push({ ...entry, attempts: (entry.attempts || 0) + 1, lastAttemptAt: now })
      }
    }

    saveQueue(stillPending)
  } finally {
    processing = false
  }
}
