// Wiederholungsbereiche pro Trainingsziel und Übungsart - Quelle für den Quick Generator.
// MUSS mit REP_TARGETS in client/src/utils/weightSuggestion.js übereinstimmen (Gewichtsvorschlag
// im Workout), sonst erzeugt der Generator z.B. 12 Wdh. und der Hinweis sagt "Ziel 10".
// Der Test utils/__tests__/repTargets.test.js vergleicht beide Tabellen.
export const REP_TARGETS = Object.freeze({
  strength: Object.freeze({
    compound: Object.freeze({ min: 3, max: 5 }),
    isolation: Object.freeze({ min: 8, max: 10 })
  }),
  hypertrophy: Object.freeze({
    compound: Object.freeze({ min: 6, max: 10 }),
    isolation: Object.freeze({ min: 10, max: 12 })
  })
});

export function getRepRange(goal, isIsolation) {
  const goalKey = String(goal || '').toLowerCase().includes('strength') ? 'strength' : 'hypertrophy';
  const range = REP_TARGETS[goalKey][isIsolation ? 'isolation' : 'compound'];
  return [range.min, range.max];
}
