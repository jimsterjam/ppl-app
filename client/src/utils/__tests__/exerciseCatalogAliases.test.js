import { describe, it, expect } from 'vitest'
import catalog from '@/data/default-exercises.json'
import { buildCatalogIndex, findCatalogEntry } from '@/utils/exerciseMatch'

// Duplikate (nur anderer Name bzw. Kamerawinkel/Geschlecht) wurden aus dem Katalog entfernt;
// alte IDs und Namen müssen weiter auf den behaltenen Eintrag zeigen (Workouts, Favoriten, Verlauf).
const MERGED = [
  { oldId: '3195', oldName: 'leg curl lying', keepId: '0586' },
  { oldId: '2315', oldName: 'calf press lever', keepId: '2289' },
  { oldId: '1464', oldName: 'sled 45° leg press (back pov)', keepId: '0739' },
  { oldId: '1463', oldName: 'sled 45° leg press (side pov)', keepId: '0739' },
  { oldId: '1765', oldName: 'dumbbell upright row (back pov)', keepId: '0437' },
  { oldId: '2800', oldName: 'barbell sitted alternate leg raise (female)', keepId: '2799' },
  { oldId: '2801', oldName: 'twisted leg raise (female)', keepId: '2802' }
]

describe('Katalog: zusammengeführte Duplikate', () => {
  const index = buildCatalogIndex(catalog)

  it('entfernte Einträge stehen nicht mehr im Katalog', () => {
    const ids = new Set(catalog.map((e) => e.id))
    for (const m of MERGED) expect(ids.has(m.oldId)).toBe(false)
  })

  it.each(MERGED)('$oldId / "$oldName" -> $keepId', ({ oldId, oldName, keepId }) => {
    expect(findCatalogEntry(index, { exerciseId: oldId })?.id).toBe(keepId)
    expect(findCatalogEntry(index, { name: oldName })?.id).toBe(keepId)
  })
})
