// Vorgaben des Workout-Generators je Trainingsziel und Übungsrolle (Schritt A, Absprache Paul):
//   Muskelaufbau: alle Übungen 8-12 Wdh., 2-4 Sätze (Standard 3).
//   Kraft:        Grundübungen 3-6 Wdh. (7 = Übergang, ab da zu leicht), 3-5 Sätze (Standard 4);
//                 Zubehör/Isolation 8-12 Wdh., 2-4 Sätze (Standard 3).
// Pausen = Standard des Pausentimers (client/src/utils/restTimerRules.js).
// Die Wiederholungen liegen jeweils im Bereich der Fortschrittslogik im Workout
// (client/src/utils/weightSuggestion.js PROGRESSION_RANGES) - per Test abgeglichen
// (utils/__tests__/repTargets.test.js).
export const GENERATOR_RULES = Object.freeze({
  hypertrophy: Object.freeze({
    compound: Object.freeze({ reps: [8, 12], defaultReps: 10, sets: [2, 4], defaultSets: 3, rest: 120 }),
    isolation: Object.freeze({ reps: [8, 12], defaultReps: 10, sets: [2, 4], defaultSets: 3, rest: 90 })
  }),
  strength: Object.freeze({
    compound: Object.freeze({ reps: [3, 6], defaultReps: 5, sets: [3, 5], defaultSets: 4, rest: 180 }),
    isolation: Object.freeze({ reps: [8, 12], defaultReps: 10, sets: [2, 4], defaultSets: 3, rest: 120 })
  })
});

function goalKey(goal) {
  return String(goal || '').toLowerCase().includes('strength') ? 'strength' : 'hypertrophy';
}

/** Regel für eine Übung. isAccessory = Isolation bzw. im Kraft-Workout leichte Ergänzungsübung. */
export function getGeneratorRule(goal, isAccessory) {
  return GENERATOR_RULES[goalKey(goal)][isAccessory ? 'isolation' : 'compound'];
}

/** [min, max] Wiederholungen (Kompatibilität). */
export function getRepRange(goal, isAccessory) {
  return [...getGeneratorRule(goal, isAccessory).reps];
}

function clamp(value, [min, max], fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Übung an die Vorgaben anpassen: Wdh. und Sätze in den Bereich, Pause = Standard. */
export function applyGeneratorRule(exercise = {}, goal, isAccessory) {
  const rule = getGeneratorRule(goal, isAccessory);
  return {
    ...exercise,
    reps: clamp(exercise.reps, rule.reps, rule.defaultReps),
    sets: clamp(exercise.sets, rule.sets, rule.defaultSets),
    rest: rule.rest
  };
}
