// Zuordnung einer Übung (aus Workout, Favorit, Generator) zum Übungskatalog - robust gegen
// Wortreihenfolge und Satzzeichen ("Barbell Bench Press" == "bench press barbell") und gegen
// umbenannte bzw. zusammengeführte Katalogeinträge (Felder aliases/aliasIds, Bereinigung 30.09.).
// Ohne Imports, damit Client und Server (nextSessionFocus/feedbackLocalization) sie nutzen können.

/** Vergleichsschlüssel: Wörter sortiert, ohne Groß-/Kleinschreibung und Satzzeichen. */
export function exerciseTokenKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ')
}

function lower(value) {
  return String(value || '').trim().toLowerCase()
}

/** Alle Namen eines Katalogeintrags: deutsch, englisch, frühere Namen. */
export function catalogNames(entry = {}) {
  return [entry.name, entry.name_en, ...(Array.isArray(entry.aliases) ? entry.aliases : [])].filter(Boolean)
}

/**
 * Index für schnelle Suche. Exakte Namen: erster Eintrag gewinnt (bisheriges Verhalten).
 * Wortreihenfolge-Schlüssel: nur eindeutige (mehrdeutige werden nicht automatisch zugeordnet).
 */
export function buildCatalogIndex(list = []) {
  const byName = new Map()
  const byToken = new Map()
  const ambiguousTokens = new Set()
  const byId = new Map()
  for (const entry of Array.isArray(list) ? list : []) {
    if (!entry) continue
    const ids = [entry.id, entry._id, ...(Array.isArray(entry.aliasIds) ? entry.aliasIds : [])]
    for (const id of ids) {
      const key = String(id || '').trim()
      if (!key) continue
      if (!byId.has(key)) byId.set(key, entry)
      if (/^\d+$/.test(key) && !byId.has(`ex_${key}`)) byId.set(`ex_${key}`, entry)
    }
    for (const name of catalogNames(entry)) {
      const exact = lower(name)
      if (exact && !byName.has(exact)) byName.set(exact, entry)
      const token = exerciseTokenKey(name)
      if (!token) continue
      const existing = byToken.get(token)
      if (existing && existing !== entry) ambiguousTokens.add(token)
      else byToken.set(token, entry)
    }
  }
  for (const token of ambiguousTokens) byToken.delete(token)
  return { byName, byToken, byId }
}

/** Katalogeintrag zu einem Namen (exakt, dann unabhängig von der Wortreihenfolge) oder null. */
export function findCatalogEntryByName(index, name) {
  if (!index || !name) return null
  return index.byName.get(lower(name)) || index.byToken.get(exerciseTokenKey(name)) || null
}

/** Katalogeintrag zu einer Übung: erst über die ID, dann über den Namen. */
export function findCatalogEntry(index, exercise = {}) {
  if (!index) return null
  for (const id of [exercise.exerciseId, exercise._id, exercise.id]) {
    const key = String(id || '').trim()
    if (key && index.byId.has(key)) return index.byId.get(key)
  }
  return findCatalogEntryByName(index, exercise.name)
}
