/**
 * Reine Entscheidungslogik für das nachträgliche Bearbeitungsfenster abgeschlossener Workouts
 * (siehe PUT /:id in routes/workouts.js). Keine Datenbank- oder externen Abhängigkeiten - bewusst
 * aus der Route herausgezogen, damit dieser sicherheitsrelevante Teil isoliert testbar ist, ohne
 * eine echte/gemockte MongoDB-Verbindung zu brauchen.
 *
 * Hintergrund: ein bereits abgeschlossenes Workout (completed:true) darf für eine gewisse Zeit
 * nach dem ERSTEN Abschluss noch nachträglich bearbeitet werden (z.B. vergessene Notiz/Gewicht
 * nachtragen), danach nicht mehr - sonst könnte ein Deep-Link/eine alte Browser-/App-Historie ein
 * längst abgeschlossenes Training rückwirkend verändern.
 */

const DEFAULT_WINDOW_HOURS = 24;

/**
 * Liest die konfigurierte Fenstergröße aus der Umgebung (WORKOUT_EDIT_WINDOW_HOURS), mit
 * Fallback auf 24h bei fehlendem/ungültigem Wert (0, negativ, nicht-numerisch).
 *
 * @param {string | number | undefined} envValue
 * @returns {number}
 */
export function getWorkoutEditWindowHours(envValue = process.env.WORKOUT_EDIT_WINDOW_HOURS) {
  const parsed = Number(envValue);
  return parsed > 0 ? parsed : DEFAULT_WINDOW_HOURS;
}

/**
 * Entscheidet, ob ein Update auf ein bereits abgeschlossenes Workout wegen abgelaufenem
 * Bearbeitungsfenster abgelehnt werden soll.
 *
 * @param {{completed?: boolean, completedAt?: Date | string | null}} existing - aktueller
 *   Server-Stand des Workouts (nur die beiden Felder werden gelesen).
 * @param {{windowHours?: number, now?: number}} [options]
 * @returns {{expired: boolean, windowHours: number, deadline: number | null}}
 *   `expired: true` heißt: die Bearbeitung sollte mit 409 WORKOUT_EDIT_WINDOW_EXPIRED
 *   abgelehnt werden. `expired: false` deckt sowohl "noch nicht abgeschlossen" als auch
 *   "abgeschlossen, aber noch innerhalb des Fensters" als auch "abgeschlossen, aber kein
 *   bekanntes completedAt" ab (alte Workouts von vor Einführung dieses Felds werden bewusst
 *   NICHT blockiert - unbekannt statt fälschlich "abgelaufen").
 */
export function isWorkoutEditWindowExpired(existing, options = {}) {
  const windowHours = options.windowHours ?? getWorkoutEditWindowHours();
  const now = options.now ?? Date.now();

  if (!existing || existing.completed !== true || !existing.completedAt) {
    return { expired: false, windowHours, deadline: null };
  }

  const deadline = new Date(existing.completedAt).getTime() + windowHours * 60 * 60 * 1000;
  return { expired: now > deadline, windowHours, deadline };
}
