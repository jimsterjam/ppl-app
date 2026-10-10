// Beispielbericht (erfundene Daten): zeigt Nutzern - auch ohne Pro -, wie der Monatsbericht aussieht.
// Wird nur angezeigt, solange noch kein echter Bericht existiert (stores/monthlyReportStore.js).
// Struktur wie facts aus server/utils/monthlyReport.js (version 1). Datumsangaben sind relativ zu
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
      version: 1,
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
        { key: 'name:barbell bench press', name: 'Barbell Bench Press', metric: 'weight', points: benchPoints(now) },
        { key: 'name:barbell squat', name: 'Barbell Squat', metric: 'weight', points: squatPoints(now) },
        { key: 'name:pull-up', name: 'Pull-Up', metric: 'reps', points: pullUpPoints(now) }
      ],
      stagnation: {
        items: [
          { key: 'name:overhead press', name: 'Overhead Press', goal: 'hypertrophy', cause: 'repeating', weeks: 5, sessions: 4, weight: 40, sets: 3, reps: 8, nextReps: 9, nextWeight: null }
        ],
        analyzedExercises: 9
      }
    }
  }
}
