// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PostWorkoutQuestions from '../PostWorkoutQuestions.vue'
import { createI18nInstance } from '@/i18n'
import { setActiveUid, __resetUserScopedStorageForTests } from '@/utils/userScopedStorage'
import { isQuestionsEnabled, hasSeenIntro, skipsInARow, recordSkip } from '@/utils/postWorkoutQuestionPrefs'

const lastSet = { topic: 'last_set', kind: 'fixed', exerciseIndex: 0, facts: { name: 'Lift A', now: { sets: 5, reps: 5, repsList: [5, 5, 5, 5, 5], weight: 100 } } }
const compare = { topic: 'compare', kind: 'less', exerciseIndex: 1, facts: { name: 'Lift B' } }
const intent = { topic: 'intent', kind: 'weight_drop', exerciseIndex: 2, facts: { name: 'Lift C' } }
const skippedIntent = { topic: 'intent', kind: 'skipped', exerciseIndex: 0, facts: { name: 'Lift D' } }

function mountQuestions(props, locale = 'de') {
  const i18n = createI18nInstance()
  i18n.global.locale.value = locale
  return mount(PostWorkoutQuestions, { props, global: { plugins: [createPinia(), i18n], stubs: { teleport: true } } })
}
const buttons = (w) => w.findAll('button').map((b) => b.text())
const click = async (w, label) => {
  const button = w.findAll('button').find((b) => b.text() === label)
  expect(button, `Knopf "${label}" fehlt: ${buttons(w).join(' | ')}`).toBeTruthy()
  await button.trigger('click')
}
const lastDone = (w) => w.emitted('done').at(-1)[0]

describe('PostWorkoutQuestions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    try { localStorage.clear() } catch { /* ohne Speicher */ }
    __resetUserScopedStorageForTests()
    setActiveUid('uid-a')
  })

  it('B: Frage mit Zahlen, vier Antworten, ein Tipp beendet das Thema', async () => {
    const w = mountQuestions({ topics: [lastSet], initialPhase: 'ask' })
    expect(w.text()).toContain('Lift A: Du hast das Ziel heute in allen Sätzen erreicht (5×5 mit 100 kg). Wie war der letzte Satz?')
    expect(buttons(w)).toEqual([
      'Leicht, da wäre mehr gegangen', 'Anstrengend, aber noch Luft', 'Am Limit, aber sauber',
      'Am Limit, die Ausführung wurde wackelig', 'Überspringen und Feedback anzeigen'
    ])
    // keine "Frage x von y"-Zählung
    expect(w.text()).not.toMatch(/\d von \d/)
    await click(w, 'Am Limit, aber sauber')
    expect(lastDone(w)).toEqual({ answers: [{ topic: 'last_set', exerciseIndex: 0, answer: 'limit_clean' }], skipped: false })
  })

  it('C: beide Fragesätze, die Variante wird mitgeschickt', async () => {
    const less = mountQuestions({ topics: [compare], initialPhase: 'ask' })
    expect(less.text()).toContain('Lift B: Heute etwas weniger als beim letzten Mal. Wie lief es?')
    await click(less, 'Ungefähr gleich')
    expect(lastDone(less).answers).toEqual([{ topic: 'compare', exerciseIndex: 1, answer: 'same', variant: 'less' }])
    const same = mountQuestions({ topics: [{ ...compare, kind: 'same' }], initialPhase: 'ask' })
    expect(same.text()).toContain('Lift B: Heute genau wie beim letzten Mal. Wie lief es im Vergleich?')
  })

  it('A: erst "War das Absicht?", dann "Warum?" - Grund passt zur Antwort', async () => {
    const w = mountQuestions({ topics: [intent], initialPhase: 'ask' })
    expect(w.text()).toContain('Lift C: heute mit deutlich weniger Gewicht als beim letzten Mal. War das Absicht?')
    await click(w, 'Nein, ich musste anpassen')
    expect(w.text()).toContain('Warum?')
    expect(buttons(w)).toContain('Mein Körper hat es heute nicht mitgemacht')
    expect(buttons(w)).not.toContain('Erholungswoche')
    await click(w, 'Zu müde')
    expect(lastDone(w).answers).toEqual([{ topic: 'intent', exerciseIndex: 2, answer: 'adjusted', reason: 'too_tired' }])
  })

  it('A: bei "bewusst" nur die Gründe für bewusste Änderungen', async () => {
    const w = mountQuestions({ topics: [intent], initialPhase: 'ask' })
    await click(w, 'Ja, bewusst')
    expect(buttons(w)).toContain('Erholungswoche')
    expect(buttons(w)).not.toContain('Zu müde')
  })

  it('A: "Weiß nicht" fragt nicht weiter nach dem Grund', async () => {
    const w = mountQuestions({ topics: [intent], initialPhase: 'ask' })
    await click(w, 'Weiß nicht')
    expect(lastDone(w).answers).toEqual([{ topic: 'intent', exerciseIndex: 2, answer: 'unsure' }])
  })

  it('A: ausgelassene Übung und Schema-Text', async () => {
    const w = mountQuestions({ topics: [skippedIntent], initialPhase: 'ask' })
    expect(w.text()).toContain('Lift D hast du heute ausgelassen. War das Absicht?')
    const scheme = mountQuestions({ topics: [{ topic: 'intent', kind: 'scheme', exerciseIndex: 0, facts: { name: 'Lift A', now: { sets: 3, repsList: [10, 10, 10] }, last: { sets: 5, repsList: [5, 5, 5, 5, 5] } } }], initialPhase: 'ask' })
    expect(scheme.text()).toContain('Lift A: heute 3×10 statt 5×5. War das Absicht?')
    const uneven = mountQuestions({ topics: [{ topic: 'intent', kind: 'scheme', exerciseIndex: 0, facts: { name: 'Lift A', now: { sets: 3, repsList: [10, 9, 8] }, last: { sets: 5, repsList: [5, 5, 5, 5, 5] } } }], initialPhase: 'ask' })
    expect(uneven.text()).toContain('heute anders aufgebaut als beim letzten Mal')
  })

  it('zwei Themen nacheinander, dann fertig', async () => {
    const w = mountQuestions({ topics: [lastSet, compare], initialPhase: 'ask' })
    await click(w, 'Leicht, da wäre mehr gegangen')
    expect(w.emitted('done')).toBeUndefined()
    expect(w.text()).toContain('Lift B:')
    await click(w, 'Wackeliger')
    expect(lastDone(w).answers.map((a) => a.topic)).toEqual(['last_set', 'compare'])
  })

  it('"Überspringen" beendet alle Fragen, Beantwortetes bleibt', async () => {
    const w = mountQuestions({ topics: [lastSet, compare], initialPhase: 'ask' })
    await click(w, 'Leicht, da wäre mehr gegangen')
    await click(w, 'Überspringen und Feedback anzeigen')
    expect(lastDone(w)).toEqual({ answers: [{ topic: 'last_set', exerciseIndex: 0, answer: 'easy' }], skipped: true })
  })

  it('Überspringen vor dem Grund: die Antwort auf "War das Absicht?" zählt trotzdem', async () => {
    const w = mountQuestions({ topics: [intent], initialPhase: 'ask' })
    await click(w, 'Ja, bewusst')
    await click(w, 'Überspringen und Feedback anzeigen')
    expect(lastDone(w)).toEqual({ answers: [{ topic: 'intent', exerciseIndex: 2, answer: 'intended' }], skipped: true })
  })

  it('Gegenprobe: ohne Antwort gibt es keine leere Antwort', async () => {
    const w = mountQuestions({ topics: [lastSet], initialPhase: 'ask' })
    await click(w, 'Überspringen und Feedback anzeigen')
    expect(lastDone(w)).toEqual({ answers: [], skipped: true })
  })

  it('Erklärung beim ersten Mal: "Fragen beantworten" merkt sich das und zeigt die erste Frage', async () => {
    const w = mountQuestions({ topics: [lastSet], initialPhase: 'intro' })
    expect(w.text()).toContain('Kurz zum Training?')
    expect(w.text()).toContain('Alles freiwillig')
    expect(hasSeenIntro()).toBe(false)
    await click(w, 'Fragen beantworten')
    expect(hasSeenIntro()).toBe(true)
    expect(w.text()).toContain('Lift A:')
    expect(w.emitted('done')).toBeUndefined()
  })

  it('Erklärung: "Ohne Fragen weiter" beendet ohne Antworten, schaltet die Fragen aber nicht aus', async () => {
    const w = mountQuestions({ topics: [lastSet], initialPhase: 'intro' })
    await click(w, 'Ohne Fragen weiter')
    expect(lastDone(w)).toEqual({ answers: [], skipped: true, declinedIntro: true })
    expect(hasSeenIntro()).toBe(true)
    expect(isQuestionsEnabled()).toBe(true)
  })

  it('Angebot nach dreimal Überspringen: "Ausschalten" schaltet pro Konto aus', async () => {
    const w = mountQuestions({ topics: [lastSet], initialPhase: 'offer' })
    expect(w.text()).toContain('Du hast die Fragen dreimal übersprungen. Möchtest du sie ausschalten?')
    await click(w, 'Ausschalten')
    expect(lastDone(w)).toMatchObject({ answers: [], skipped: true, turnedOff: true })
    expect(isQuestionsEnabled()).toBe(false)
    setActiveUid('uid-b')
    expect(isQuestionsEnabled()).toBe(true)
  })

  it('Angebot: "Weiter fragen" setzt den Zähler zurück und zeigt die Frage', async () => {
    recordSkip(); recordSkip(); recordSkip()
    const w = mountQuestions({ topics: [lastSet], initialPhase: 'offer' })
    await click(w, 'Weiter fragen')
    expect(skipsInARow()).toBe(0)
    expect(isQuestionsEnabled()).toBe(true)
    expect(w.text()).toContain('Lift A:')
  })

  it('Englisch: Texte aus der englischen Sprachdatei', async () => {
    const w = mountQuestions({ topics: [lastSet], initialPhase: 'ask' }, 'en')
    expect(w.text()).toContain('How was the last set?')
    expect(buttons(w)).toContain('Hard, but I had some left')
    expect(buttons(w)).toContain('Skip and show feedback')
  })
})
