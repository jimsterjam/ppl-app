// Warm-up eines Workouts (Karte oben im Workout, Absprache Paul 11.10.): drei Schritte, jeweils abgehakt
// oder nicht. Gespeichert wird nur das - keine Zeiten, kein Text. Für die spätere Auswertung im
// Monatsbericht ("Warm-up in X von Y Einheiten").
//   null      = unbekannt (Workouts von vor dieser Funktion)
//   { cardio, joints, specific } = Karte wurde gezeigt; false = nicht abgehakt
// Gespiegelt im Client: client/src/utils/warmupPlan.js (sanitizeWarmup).

export const WARMUP_STEPS = Object.freeze(['cardio', 'joints', 'specific']);

/** Gültiges Warm-up-Objekt oder null. Nur echte Booleans zählen als abgehakt, alles andere als nicht abgehakt. */
export function sanitizeWarmup(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result = {};
  for (const step of WARMUP_STEPS) result[step] = value[step] === true;
  return result;
}
