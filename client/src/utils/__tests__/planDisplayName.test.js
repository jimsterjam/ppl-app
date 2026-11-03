import { describe, it, expect } from 'vitest'
import { planDisplayName } from '../planDisplayName'

const messages = { de: { 'plans.templates.ppl3.name': 'Push/Pull/Legs · 3 Tage' }, en: { 'plans.templates.ppl3.name': 'Push/Pull/Legs · 3 days' } }
const makeT = (current) => (key, _params, options) => messages[options?.locale || current][key] ?? key

describe('planDisplayName', () => {
  it('zeigt den Vorlagennamen in der aktuellen Sprache, auch wenn er in der anderen gespeichert wurde', () => {
    expect(planDisplayName({ name: 'Push/Pull/Legs · 3 Tage', templateId: 'ppl3' }, makeT('en'))).toBe('Push/Pull/Legs · 3 days')
    expect(planDisplayName({ name: 'Push/Pull/Legs · 3 days', templateId: 'ppl3' }, makeT('de'))).toBe('Push/Pull/Legs · 3 Tage')
  })
  it('lässt einen selbst vergebenen Namen unverändert', () => {
    expect(planDisplayName({ name: 'Mein Plan', templateId: 'ppl3' }, makeT('en'))).toBe('Mein Plan')
  })
  it('lässt Pläne ohne Vorlage und unbekannte Vorlagen unverändert', () => {
    expect(planDisplayName({ name: 'Eigener Plan' }, makeT('en'))).toBe('Eigener Plan')
    expect(planDisplayName({ name: 'X', templateId: 'gibtsnicht' }, makeT('en'))).toBe('X')
    expect(planDisplayName(null, makeT('en'))).toBe('')
  })
})
