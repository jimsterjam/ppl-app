// Neue Workouts heißen z.B. "Leg Day - 23.9.2026" bzw. "Leg Day - 9/23/2026" (siehe
// WorkoutBuilder.vue). Wo das Datum ohnehin separat angezeigt wird, schneiden wir es nur für die
// Anzeige ab - der gespeicherte Name bleibt unverändert. Eigene Namen ohne Datum am Ende
// (z.B. "Oberkörper 2 - Variante") bleiben wie sie sind.
const TRAILING_DATE = /\s*[-–]\s*\d{1,2}[./]\d{1,2}[./]\d{2,4}$/

export function stripWorkoutNameDate(name) {
  const raw = String(name || '').trim()
  const stripped = raw.replace(TRAILING_DATE, '').trim()
  return stripped || raw
}
