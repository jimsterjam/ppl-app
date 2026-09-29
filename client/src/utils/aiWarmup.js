// Hält Server und KI-Relay während eines laufenden Workouts wach (Render Free-Plan: beide
// schlafen nach ~15 Min. ohne Anfragen ein, ein doppelter Kaltstart beim Speichern dauerte teils
// Minuten). Ping beim Start und dann alle WARMUP_INTERVAL_MS - der Server antwortet sofort und
// weckt den Relay im Hintergrund (POST /workouts/ai-warmup, kein KI-Aufruf, keine Kosten).
// Verbraucht Free-Stunden nur, solange wirklich jemand trainiert.
import { apiUrl } from '@/api/http'
import { useFirebaseAuth } from './firebaseAuth'
import { logger } from './logger'

export const WARMUP_INTERVAL_MS = 10 * 60 * 1000

async function pingWarmup() {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
  try {
    const { getIdToken } = useFirebaseAuth()
    const token = await getIdToken().catch(() => null)
    if (!token) return
    await fetch(`${apiUrl('workouts')}/ai-warmup`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
  } catch (error) {
    // Reines Aufwärmen - ein Fehlschlag ist egal, das Speichern funktioniert trotzdem.
    logger.debug('[aiWarmup] Ping fehlgeschlagen', error?.message)
  }
}

/** Startet das Aufwärmen; gibt eine Stopp-Funktion zurück. */
export function startAiWarmup() {
  pingWarmup()
  const timer = setInterval(pingWarmup, WARMUP_INTERVAL_MS)
  return () => clearInterval(timer)
}
