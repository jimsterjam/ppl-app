// Reihenfolge der Übungslisten: alphabetisch nach dem angezeigten Namen (erst die ersten drei Buchstaben, dann der ganze Name).
// Gemeinsam genutzt von getMergedSortedExercises (Builder, "Übung hinzufügen") und der Übungsliste selbst, damit auch der
// Übungen-Tab (Katalog in ID-Reihenfolge) und neue Übungen mit hoher ID (9xxx) einsortiert werden und nicht am Ende stehen.
export function sortKey(name) {
  return String(name || '').trim().toLowerCase()
}

// Ein Collator für alle Vergleiche (schneller als String.localeCompare bei rund 1200 Einträgen, gleiche Reihenfolge)
const collator = typeof Intl !== 'undefined' && Intl.Collator ? new Intl.Collator() : { compare: (x, y) => x.localeCompare(y) }

export function compareExerciseNames(a, b) {
  const an = sortKey(a)
  const bn = sortKey(b)
  const prefix = collator.compare(an.slice(0, 3), bn.slice(0, 3))
  return prefix !== 0 ? prefix : collator.compare(an, bn)
}
