import { describe, it, expect, vi } from 'vitest'
import { pickConfirmedAnswers, noteAnswersLocally, patchOwnedWorkout } from '../athleteAnswersLocal.js'

const confirmed = [{ topic: 'last_set', exercise: 'Squat', exerciseIndex: 0, answer: 'limit_clean', reason: null, variant: null }]

describe('pickConfirmedAnswers', () => {
  it('übernimmt nur die festen Felder des vom Server bestätigten Eintrags', () => {
    const out = pickConfirmedAnswers([{ ...confirmed[0], extra: 'x', userId: 'u1' }])
    expect(out).toEqual(confirmed)
    expect(out[0]).not.toHaveProperty('extra')
  })

  it('Gegenprobe: ungültige Einträge entfallen, höchstens zwei, keine Liste -> null', () => {
    expect(pickConfirmedAnswers([{ topic: 5 }, null, { ...confirmed[0], exerciseIndex: '0' }])).toEqual([])
    expect(pickConfirmedAnswers([confirmed[0], { ...confirmed[0], exerciseIndex: 1 }, { ...confirmed[0], exerciseIndex: 2 }])).toHaveLength(2)
    expect(pickConfirmedAnswers(undefined)).toBeNull()
    expect(pickConfirmedAnswers('x')).toBeNull()
  })

  it('der Server hat nichts übernommen (leere Liste): das ist die Antwort, nicht "keine Angabe"', () => {
    expect(pickConfirmedAnswers([])).toEqual([])
  })
})

describe('noteAnswersLocally', () => {
  it('schreibt nur das Feld athlete_answers an den lokalen Eintrag', async () => {
    const patch = vi.fn().mockResolvedValue(1)
    expect(await noteAnswersLocally(['real1'], confirmed, { patch })).toBe(true)
    expect(patch).toHaveBeenCalledWith('real1', { athlete_answers: confirmed })
  })

  it('liegt der Eintrag noch unter der vorläufigen ID, wird die zweite Kennung probiert', async () => {
    const patch = vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(1)
    expect(await noteAnswersLocally(['real1', 'offline_9'], confirmed, { patch })).toBe(true)
    expect(patch.mock.calls.map((c) => c[0])).toEqual(['real1', 'offline_9'])
  })

  it('Gegenprobe: kein lokaler Eintrag -> false, nichts geworfen', async () => {
    expect(await noteAnswersLocally(['a', 'a', ''], confirmed, { patch: vi.fn().mockResolvedValue(0) })).toBe(false)
  })

  it('Gegenprobe: ein Fehler beim Schreiben wirft nie (Antworten sind beim Server gespeichert)', async () => {
    const patch = vi.fn().mockRejectedValue(new Error('IndexedDB abgebrochen'))
    await expect(noteAnswersLocally(['real1'], confirmed, { patch })).resolves.toBe(false)
  })

  it('Gegenprobe: ohne Antwortliste des Servers wird nichts geschrieben', async () => {
    const patch = vi.fn()
    expect(await noteAnswersLocally(['real1'], undefined, { patch })).toBe(false)
    expect(patch).not.toHaveBeenCalled()
  })
})

// Ein zweites Konto auf demselben Gerät darf nichts vom ersten sehen oder ändern (Absprache Jimmy, CLAUDE.md).
describe('patchOwnedWorkout: nur der Eintrag des angemeldeten Kontos', () => {
  // Minimale Nachbildung der Dexie-Kette where().equals().filter().modify() über Einträge im Arbeitsspeicher
  function fakeTable(records) {
    return {
      where: () => ({
        equals: (key) => ({
          filter: (predicate) => ({
            modify: async (changes) => {
              const hits = records.filter((r) => r._id === key && predicate(r))
              hits.forEach((r) => Object.assign(r, changes))
              return hits.length
            }
          })
        })
      })
    }
  }
  const answers = [{ topic: 'last_set', exercise: 'Squat', exerciseIndex: 0, answer: 'limit_clean', reason: null, variant: null }]

  it('schreibt beim eigenen Eintrag', async () => {
    const records = [{ _id: 'w1', userId: 'A' }]
    expect(await patchOwnedWorkout(fakeTable(records), 'A', 'w1', { athlete_answers: answers })).toBe(1)
    expect(records[0].athlete_answers).toEqual(answers)
  })

  it('Gegenprobe: Eintrag eines anderen Kontos bleibt unverändert', async () => {
    const records = [{ _id: 'w1', userId: 'B' }]
    expect(await patchOwnedWorkout(fakeTable(records), 'A', 'w1', { athlete_answers: answers })).toBe(0)
    expect(records[0]).not.toHaveProperty('athlete_answers')
  })

  it('Gegenprobe: ohne angemeldetes Konto oder ohne Kennung wird nichts geschrieben', async () => {
    const records = [{ _id: 'w1', userId: '' }, { _id: 'w2' }]
    expect(await patchOwnedWorkout(fakeTable(records), '', 'w1', { athlete_answers: answers })).toBe(0)
    expect(await patchOwnedWorkout(fakeTable(records), 'A', '', { athlete_answers: answers })).toBe(0)
    expect(await patchOwnedWorkout(fakeTable(records), undefined, 'w2', { athlete_answers: answers })).toBe(0)
    expect(records.some((r) => 'athlete_answers' in r)).toBe(false)
  })

  it('Gegenprobe: Eintrag ohne userId (alter Stand) wird nicht angefasst', async () => {
    const records = [{ _id: 'w2' }]
    expect(await patchOwnedWorkout(fakeTable(records), 'A', 'w2', { athlete_answers: answers })).toBe(0)
  })
})
