// Beispielbericht (erfundene Daten): zeigt Nutzern - auch ohne Pro -, wie der Monatsbericht aussieht.
// Wird nur angezeigt, solange noch kein echter Bericht existiert (stores/monthlyReportStore.js).
// Struktur wie facts aus server/utils/monthlyReport.js (version 2). Datumsangaben sind relativ zu
// "jetzt", damit der Zeitraum immer aktuell wirkt. Übungsnamen sind (wie in der ganzen App) englisch.

const DAY = 24 * 60 * 60 * 1000

function benchPoints(now) {
  const offsets = [26, 22, 19, 15, 12, 8, 5, 1]
  const weights = [70, 70, 72.5, 72.5, 75, 75, 77.5, 80]
  return offsets.map((ago, i) => ({ date: new Date(now.getTime() - ago * DAY).toISOString(), value: weights[i], reps: 8 }))
}

function squatPoints(now) {
  const offsets = [25, 18, 11, 4]
  const weights = [95, 100, 100, 105]
  return offsets.map((ago, i) => ({ date: new Date(now.getTime() - ago * DAY).toISOString(), value: weights[i], reps: 6 }))
}

function pullUpPoints(now) {
  const offsets = [24, 17, 10, 3]
  const reps = [6, 7, 8, 8]
  return offsets.map((ago, i) => ({ date: new Date(now.getTime() - ago * DAY).toISOString(), value: reps[i], reps: reps[i] }))
}

/**
 * @param {Date} [now]
 * @returns {{ id: 'example', isExample: true, periodStart: string, periodEnd: string, seenAt: null, facts: object }}
 */
export function buildSampleReport(now = new Date()) {
  const periodEnd = now
  const periodStart = new Date(now.getTime() - 28 * DAY)
  return {
    id: 'example',
    isExample: true,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    seenAt: null,
    facts: {
      version: 2,
      days: 28,
      totals: { sessions: 14, sets: 168, volumeKg: 21450, personalBests: 3 },
      previous: { sessions: 12, sets: 150, volumeKg: 19200 },
      conclusion: 'more',
      weeks: [3, 4, 3, 4].map((sessions, i) => ({
        start: new Date(periodStart.getTime() + i * 7 * DAY).toISOString(),
        sessions,
        sets: sessions * 12
      })),
      exercises: [
        { key: 'name:bench press barbell', name: 'Bench Press Barbell', metric: 'weight', points: benchPoints(now) },
        { key: 'name:barbell high bar squat', name: 'Barbell High Bar Squat', metric: 'weight', points: squatPoints(now) },
        { key: 'name:pull-up', name: 'Pull-Up', metric: 'reps', points: pullUpPoints(now) }
      ],
      stagnation: {
        items: [
          { key: 'name:barbell seated overhead press', name: 'Barbell Seated Overhead Press', goal: 'hypertrophy', cause: 'repeating', weeks: 5, sessions: 4, weight: 40, sets: 3, reps: 8, nextReps: 9, nextWeight: null }
        ],
        analyzedExercises: 9
      },
      findings: {
        progress: {
          items: [
            { type: 'improved', key: 'name:bench press barbell', exercise: 'Bench Press Barbell', goal: 'hypertrophy', sessions: 8, weeks: 4, from: { weight: 70, reps: 8 }, to: { weight: 80, reps: 8 }, confidence: 'high' },
            { type: 'unchanged', key: 'name:barbell seated overhead press', exercise: 'Barbell Seated Overhead Press', goal: 'hypertrophy', sessions: 4, weeks: 3, from: { weight: 40, reps: 8 }, to: { weight: 40, reps: 8 }, confidence: 'medium' }
          ],
          insufficientCount: 2
        },
        repRange: {
          items: [{ key: 'name:pull-up', exercise: 'Pull-Up', goal: 'hypertrophy', sessions: 4, percentInRange: 50, min: 8, max: 12, hint: false }]
        },
        swaps: { items: [{ type: 'permanent', from: 'Lat Pulldown', to: 'Pull-Up' }] },
        muscles: { items: [{ muscle: 'Brust', setsPerWeek: 9 }, { muscle: 'Rücken', setsPerWeek: 8.5 }] },
        recommendations: [{ section: 'progress', index: 1 }],
        nothingToChange: false
      }
    }
  }
}
