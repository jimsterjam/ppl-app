/**
 * Gemeinsamer Diagnose-Log für den Workout-Save/Draft/AI-Feedback-Bereich.
 *
 * Extrahiert aus WorkoutDetailView.vue, damit auch andere Komponenten (z.B.
 * PostWorkoutSummary.vue) in denselben Ring-Buffer schreiben können - vorher gab es dort
 * nur normale logger.debug()-Aufrufe, die nicht im (über Einstellungen kopierbaren)
 * Diagnose-Log landeten. Ohne das war z.B. der komplette "Speichern"/AI-Feedback-Ablauf im
 * Log unsichtbar, obwohl Draft-Autosave/Lifecycle-Events dort schon lange protokolliert werden.
 *
 * Rein additiv, kein Verhaltenswechsel: gleicher localStorage-Key, gleiches Ring-Buffer-Limit,
 * gleiches Format wie zuvor.
 */

const DIAGNOSTICS_KEY = 'bro_split_load_diagnostics_v1'
const MAX_ENTRIES = 100

export function logDiagnostic(event, data = {}) {
  try {
    const existing = JSON.parse(localStorage.getItem(DIAGNOSTICS_KEY) || '[]')
    existing.push({
      event,
      ...data,
      timestamp: new Date().toISOString()
    })
    const trimmed = existing.slice(-MAX_ENTRIES)
    localStorage.setItem(DIAGNOSTICS_KEY, JSON.stringify(trimmed))
  } catch {}
}

export default logDiagnostic
