import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { FEEDBACK_LIST_SORT_STAGES } from '../feedbackListSort.js'

// Absprache Jimmy 23.11.: ausstehende Feedbacks werden im Verlauf ganz normal eingereiht, nicht oben angepinnt.
// Kleine Nachbildung der zwei Mongo-Stufen ($ifNull + $sort) über Beispieleinträge (nicht gegen eine echte Datenbank).
function applySort(docs) {
  const [addFields, sort] = FEEDBACK_LIST_SORT_STAGES
  const expr = addFields.$addFields._sortAt.$ifNull
  const keyOf = (doc) => expr.map((ref) => doc[ref.slice(1)]).find((v) => v !== undefined && v !== null)
  const withKey = docs.map((d) => ({ ...d, _sortAt: keyOf(d) }))
  const fields = Object.keys(sort.$sort)
  // Wie Mongo: absteigend je Feld; Datumsfelder als Zeitpunkt, _id (ObjectId, hier Text) als Zeichenfolge
  const compare = (field, x, y) => (field === '_id' ? String(y).localeCompare(String(x)) : new Date(y).getTime() - new Date(x).getTime())
  return withKey.sort((a, b) => {
    for (const f of fields) {
      if (sort.$sort[f] >= 0) throw new Error('nur absteigende Schlüssel nachgebildet')
      const diff = compare(f, a[f], b[f])
      if (diff !== 0) return diff
    }
    return 0
  })
}

const d = (s) => new Date(`2026-11-${s}T10:00:00Z`)

describe('Feedback-Liste: Reihenfolge', () => {
  it('ausstehende Einträge werden nach dem Datum des Workouts eingereiht, nicht oben angepinnt', () => {
    const list = applySort([
      { id: 'fertig-neu', ai_generated_at: d('20'), date: d('20') },
      { id: 'zurueckgestellt-alt', ai_feedback_status: 'deferred', date: d('10') },
      { id: 'fertig-mittel', ai_generated_at: d('15'), date: d('15') },
      { id: 'pending-neuer', ai_feedback_status: 'pending', date: d('18') }
    ])
    assert.deepEqual(list.map((x) => x.id), ['fertig-neu', 'pending-neuer', 'fertig-mittel', 'zurueckgestellt-alt'])
  })

  it('Gegenprobe: ein ausstehender Eintrag, der älter ist als fertige, steht NICHT ganz oben', () => {
    const list = applySort([
      { id: 'zurueckgestellt', ai_feedback_status: 'deferred', date: d('01') },
      { id: 'fertig', ai_generated_at: d('22'), date: d('22') }
    ])
    assert.equal(list[0].id, 'fertig')
  })

  it('fertiges Feedback zählt nach dem Zeitpunkt der Erzeugung (neu erzeugtes steigt auf)', () => {
    const list = applySort([
      { id: 'a', ai_generated_at: d('12'), date: d('12') },
      { id: 'b-neu-erzeugt', ai_generated_at: d('21'), date: d('05') }
    ])
    assert.equal(list[0].id, 'b-neu-erzeugt')
  })

  it('Gleichstand bei Zeit und Workout-Datum: die ID entscheidet, in beiden Eingabereihenfolgen gleich (stabiles "Mehr laden")', () => {
    const a = { _id: '65a000000000000000000001', ai_feedback_status: 'deferred', date: d('10') }
    const b = { _id: '65a000000000000000000002', ai_feedback_status: 'deferred', date: d('10') }
    const first = applySort([a, b]).map((x) => x._id)
    const second = applySort([b, a]).map((x) => x._id)
    assert.deepEqual(first, [b._id, a._id])
    assert.deepEqual(second, first)
  })

  it('die Stufen: kein Anpinnen mehr, Zeit zuerst (ai_generated_at, sonst Workout-Datum), Workout-Datum und ID als Gleichstand', () => {
    const text = JSON.stringify(FEEDBACK_LIST_SORT_STAGES)
    assert.ok(!text.includes('_pendingFirst'))
    assert.deepEqual(FEEDBACK_LIST_SORT_STAGES[0].$addFields._sortAt, { $ifNull: ['$ai_generated_at', '$date'] })
    assert.deepEqual(Object.keys(FEEDBACK_LIST_SORT_STAGES[1].$sort), ['_sortAt', 'date', '_id'])
    assert.ok(Object.values(FEEDBACK_LIST_SORT_STAGES[1].$sort).every((dir) => dir === -1))
  })
})
