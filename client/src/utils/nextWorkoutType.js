// Dashboard ohne aktiven Plan: Was wurde zuletzt trainiert (Hinweis "Zuletzt: Pull") und - nur wenn der
// Nutzer erkennbar im Push → Pull → Legs → Push-Rhythmus trainiert - welche Kachel als Nächstes dran ist.
// Bei willkürlichem Training, nach Full Body oder mit zu wenig Daten wird nichts empfohlen.
const ROTATION = { push: 'pull', pull: 'legs', legs: 'push' }
// So viele aufeinanderfolgende Workouts müssen dem Rhythmus gefolgt sein (= 2 richtige Übergänge).
const RHYTHM_WORKOUTS = 3

export function normalizeTileType(type) {
  const t = String(type || '').trim().toLowerCase()
  if (t === 'leg') return 'legs'
  if (t === 'freestyle') return 'fullbody'
  return ['push', 'pull', 'legs', 'fullbody'].includes(t) ? t : null
}

/** @param {Array} workouts beliebige Reihenfolge; nur abgeschlossene zählen. @returns {{ last: string|null, next: string|null }} */
export function analyzeRecentTypes(workouts) {
  const types = (Array.isArray(workouts) ? workouts : [])
    .filter((w) => w?.completed === true && !w?._isDraft)
    .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
    .slice(0, RHYTHM_WORKOUTS)
    .map((w) => normalizeTileType(w.type))
  const last = types[0] || null
  if (types.length < RHYTHM_WORKOUTS || !last || !ROTATION[last]) return { last, next: null }
  // types ist neueste zuerst: jedes ältere Workout muss das jüngere "vorbereitet" haben.
  for (let i = 1; i < types.length; i += 1) {
    if (!types[i] || ROTATION[types[i]] !== types[i - 1]) return { last, next: null }
  }
  return { last, next: ROTATION[last] }
}
