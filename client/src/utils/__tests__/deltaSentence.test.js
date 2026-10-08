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
  deltaRepsMoreInSet: '{n} Wdh. mehr (Satz {sets})',
  deltaRepsLessInSet: '{n} Wdh. weniger (Satz {sets})',
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

// Fakten zu Sätzen kommen ausschließlich aus dem Code (siehe server/utils/feedbackFactGuard.js).
// Report 08.10. (Weighted Pull-Ups): die KI behauptete "Wiederholungen in Satz 7 von 6 auf 5
// gesunken", tatsächlich war nichts verändert; die Übersicht muss das richtig und satzgenau zeigen.
describe('buildDeltaSentence: Wiederholungen je Satz', () => {
  it('Report 08.10.: Gewicht nur in Satz 6 und 7 (+2,5), Wiederholungen in keinem Satz verändert', () => {
    const item = {
      weight_change_scope: 'partial', weight_change_kg: 2.5, weight_change_set_numbers: [6, 7],
      reps_change: 0, sets_change: 0, reps_set_changes: []
    }
    expect(buildDeltaSentence(item, t, fmt)).toBe(
      '2,5 kg mehr gestemmt (Satz 6 und 7), bei gleicher Satz- und Wiederholungszahl – eine klare Steigerung.'
    )
  })

  it('eine Wiederholung weniger nur in Satz 3 -> Satz wird genannt', () => {
    const item = { weight_change_scope: 'none', reps_change: -1, reps_set_changes: [{ set_number: 3, change: -1 }] }
    expect(buildDeltaSentence(item, t, fmt)).toBe('1 Wdh. weniger (Satz 3), bei gleicher Satzzahl und gleichem Gewicht.')
  })

  it('gegenläufig: Satz 1 und 2 mehr, Satz 7 weniger -> gleiche Änderungen zusammengefasst, Summe 0 verschleiert nichts', () => {
    const item = {
      weight_change_scope: 'none', reps_change: 1,
      reps_set_changes: [{ set_number: 1, change: 1 }, { set_number: 2, change: 1 }, { set_number: 7, change: -1 }]
    }
    const sentence = buildDeltaSentence(item, t, fmt)
    expect(sentence).toContain('1 Wdh. mehr (Satz 1 und 2), 1 Wdh. weniger (Satz 7)')
    expect(sentence).not.toContain('Steigerung')
  })

  it('Summe 0 bei gegenläufigen Sätzen wird NICHT als "gleiche Wiederholungszahl" gemeldet', () => {
    const item = {
      weight_change_scope: 'none', reps_change: 0,
      reps_set_changes: [{ set_number: 1, change: 1 }, { set_number: 7, change: -1 }]
    }
    expect(buildDeltaSentence(item, t, fmt)).not.toContain('gleicher Wiederholungszahl')
    expect(buildDeltaSentence(item, t, fmt)).not.toBe('Keine Veränderung zur letzten Session.')
  })

  it('älterer Eintrag ohne reps_set_changes: Gesamt-Differenz wie bisher', () => {
    expect(buildDeltaSentence({ weight_change_scope: 'none', reps_change: 3 }, t, fmt))
      .toBe('3 Wiederholungen mehr geschafft, bei gleicher Satzzahl und gleichem Gewicht – eine klare Steigerung.')
  })

  it('zusätzlicher Satz verändert nur die Summe -> Gesamt-Differenz und Satzzahl bleiben sichtbar', () => {
    const item = { weight_change_scope: 'none', reps_change: 5, sets_change: 1, reps_set_changes: [] }
    expect(buildDeltaSentence(item, t, fmt)).toBe('5 Wiederholungen mehr geschafft und 1 Sätze mehr gemacht, bei gleichem Gewicht – eine klare Steigerung.')
  })
})
