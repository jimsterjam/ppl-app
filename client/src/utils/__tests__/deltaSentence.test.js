import { describe, it, expect } from 'vitest'
import { buildDeltaSentence } from '../deltaSentence.js'

// Minimaler i18n-Ersatz mit den deutschen Texten aus i18n/index.js (feedbackHistory.*).
const DE = {
  deltaNoChange: 'Keine Veränderung zur letzten Session.',
  deltaWeightMore: '{kg} kg mehr gestemmt',
  deltaWeightLess: '{kg} kg weniger gestemmt',
  deltaWeightMoreInSet: '{kg} kg mehr gestemmt (Satz {sets})',
  deltaWeightLessInSet: '{kg} kg weniger gestemmt (Satz {sets})',
  deltaWeightMixed: 'unterschiedliche Gewichtsänderungen je Satz',
  deltaWeightUpRange: 'Gewicht erhöht: +{min} bis +{max} kg je Satz',
  deltaWeightDownRange: 'Gewicht reduziert: −{min} bis −{max} kg je Satz',
  deltaTopSame: 'schwerster Satz gleich ({kg} kg)',
  deltaTopUp: 'schwerster Satz {change} kg schwerer ({kg} kg)',
  deltaTopDown: 'schwerster Satz {change} kg leichter ({kg} kg)',
  deltaVolumeUp: 'insgesamt {pct} % mehr Gewicht bewegt',
  deltaVolumeDown: 'insgesamt {pct} % weniger Gewicht bewegt',
  deltaRepsMore: '{n} Wiederholungen mehr geschafft',
  deltaRepsLess: '{n} Wiederholungen weniger geschafft',
  deltaSetsMore: '{n} Sätze mehr gemacht',
  deltaSetsLess: '{n} Sätze weniger gemacht',
  deltaSuffixWeightChanged: 'bei gleicher Satz- und Wiederholungszahl',
  deltaSuffixRepsChanged: 'bei gleicher Satzzahl und gleichem Gewicht',
  deltaSuffixSetsChanged: 'bei gleichem Gewicht und gleicher Wiederholungszahl',
  deltaSuffixOnlyWeightUnchanged: 'bei gleichem Gewicht',
  deltaSuffixOnlyRepsUnchanged: 'bei gleicher Wiederholungszahl',
  deltaSuffixOnlySetsUnchanged: 'bei gleicher Satzzahl',
  deltaImprovement: 'eine klare Steigerung',
  deltaAnd: 'und'
}
const t = (key, params = {}) => DE[key.replace('feedbackHistory.', '')].replace(/\{(\w+)\}/g, (_, k) => params[k])
const fmt = (v) => String(Math.round(Math.abs(v) * 10) / 10).replace('.', ',')

describe('buildDeltaSentence', () => {
  it('Pyramide mit anderem Einstieg (User-Report Hack Calf Raise): schwerster Satz + Gesamtbilanz', () => {
    const item = { weight_change_scope: 'mixed', top_weight_kg: 198, top_weight_change_kg: 0, volume_change_percent: 4.5 }
    expect(buildDeltaSentence(item, t, fmt)).toBe(
      'schwerster Satz gleich (198 kg), insgesamt 4,5 % mehr Gewicht bewegt, bei gleicher Satz- und Wiederholungszahl – eine klare Steigerung.'
    )
  })

  it('alle Sätze schwerer, unterschiedlich viel -> Spanne und Steigerung', () => {
    const item = { weight_change_scope: 'increased', weight_change_kg: 5, weight_change_min_kg: 2.5, weight_change_max_kg: 5 }
    expect(buildDeltaSentence(item, t, fmt)).toBe(
      'Gewicht erhöht: +2,5 bis +5 kg je Satz, bei gleicher Satz- und Wiederholungszahl – eine klare Steigerung.'
    )
  })

  it('alle Sätze leichter -> Spanne, keine Steigerung', () => {
    const item = { weight_change_scope: 'decreased', weight_change_kg: -5, weight_change_min_kg: -2.5, weight_change_max_kg: -5 }
    expect(buildDeltaSentence(item, t, fmt)).toBe('Gewicht reduziert: −2,5 bis −5 kg je Satz, bei gleicher Satz- und Wiederholungszahl.')
  })

  it('gegenläufig, schwerster Satz leichter, aber mehr bewegt -> keine Steigerung', () => {
    const item = { weight_change_scope: 'mixed', top_weight_kg: 190, top_weight_change_kg: -8, volume_change_percent: 3 }
    expect(buildDeltaSentence(item, t, fmt)).not.toContain('Steigerung')
  })

  it('alter Eintrag ohne schwersten Satz: neutraler Hinweis + Gesamtbilanz', () => {
    const item = { weight_change_scope: 'mixed', volume_change_percent: -2 }
    expect(buildDeltaSentence(item, t, fmt)).toBe(
      'unterschiedliche Gewichtsänderungen je Satz, insgesamt 2 % weniger Gewicht bewegt, bei gleicher Satz- und Wiederholungszahl.'
    )
  })

  it('Gesamtbilanz unter 1 % wird nicht erwähnt', () => {
    const item = { weight_change_scope: 'mixed', top_weight_kg: 100, top_weight_change_kg: 0, volume_change_percent: 0.4 }
    expect(buildDeltaSentence(item, t, fmt)).toBe('schwerster Satz gleich (100 kg), bei gleicher Satz- und Wiederholungszahl.')
  })

  it('bisherige Fälle bleiben: einzelner Satz, Sätze + Wdh., keine Änderung', () => {
    expect(buildDeltaSentence({ weight_change_scope: 'partial', weight_change_kg: 4, weight_change_set_numbers: [1] }, t, fmt))
      .toBe('4 kg mehr gestemmt (Satz 1), bei gleicher Satz- und Wiederholungszahl – eine klare Steigerung.')
    expect(buildDeltaSentence({ weight_change_scope: 'mixed', top_weight_kg: 60, top_weight_change_kg: 0, volume_change_percent: 12, reps_change: 3, sets_change: 1 }, t, fmt))
      .toBe('schwerster Satz gleich (60 kg), insgesamt 12 % mehr Gewicht bewegt und 3 Wiederholungen mehr geschafft und 1 Sätze mehr gemacht – eine klare Steigerung.')
    expect(buildDeltaSentence({}, t, fmt)).toBe('Keine Veränderung zur letzten Session.')
  })
})
