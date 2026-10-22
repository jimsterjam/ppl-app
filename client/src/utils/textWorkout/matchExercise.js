// Freitext-Einstieg, Schritt 2: Übungsname (Freitext) -> Katalogübung. Reiner Code, kein LLM, kein Netz.
//
//   const match = createExerciseMatcher({ catalog, customExercises })
//   match('Latzug')      -> { status: 'matched', exercise_id, name_en: 'lat pulldown wide grip', via: 'synonym', assumed: ['variant'], ... }
//   match('Seitheben')   -> { status: 'ambiguous', candidates: [...] }            (Rückfrage mit Auswahl)
//   match('Face Pulls')  -> { status: 'not_found', suggestions: [...] }            (nie raten, nie still neu anlegen)
//
// Regeln (Absprache Paul): Falsch erkannte Daten sind schlimmer als ein langsamerer Einstieg.
// - "matched" nur bei genau einer sicheren Übung. Eine Standardwahl ohne Nutzerangabe (z. B. "Bankdrücken" -> Langhantel)
//   ist sichtbar als assumed: ["variant"] markiert.
// - Hat der Nutzer ein Merkmal genannt (Kurzhantel, Kabel, sitzend ...), das keine Katalogübung des Begriffs hat, wird NICHT
//   still ein anderes Gerät gewählt, sondern not_found mit Vorschlägen gemeldet.
// - Begriffe, die der Katalog nicht kennt (Face Pull, Hip Thrust), bleiben not_found (höchstens mit Vorschlägen).
import { QUALIFIERS, SYNONYMS } from './synonyms.js'
import { buildCatalogIndex, findCatalogEntryByName } from '../exerciseMatch.js'

const MAX_CANDIDATES = 4
// Füllwörter, die bei der Begriffssuche nicht stören sollen ("Klimmzüge mit Zusatzgewicht").
const STOP_WORDS = new Set(['mit', 'am', 'an', 'der', 'die', 'das', 'und', 'ohne', 'im', 'auf', 'for', 'with', 'on', 'the', 'a', 'of', 'ein', 'eine'])
const EQUIPMENT_TAGS = ['barbell', 'dumbbell', 'cable', 'machine', 'smith', 'ez', 'bodyweight', 'band', 'kettlebell']
const MAX_SUGGESTIONS = 3

// --- Normalisieren ------------------------------------------------------------------------------------------------
/** Kleinschreibung, Umlaute/Akzente weg (ä->a, ß->ss), Satzzeichen -> Leerzeichen. "Bankdrücken" == "bankdruecken". */
export function fold(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u')
    .normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Mehrzahl/Endungen egal: "kniebeugen" == "kniebeuge", "curls" == "curl", "klimmzüge" == "klimmzug". */
export function stem(token) {
  let t = token
  if (t.length > 6 && t.endsWith('en')) t = t.slice(0, -2)
  else if (t.length > 4 && /[esn]$/.test(t)) t = t.slice(0, -1)
  return t
}

const stemPhrase = (text) => fold(text).split(' ').filter(Boolean).map(stem).join(' ')

// --- Merkmale (Kurzhantel, Kabel, sitzend ...) --------------------------------------------------------------------------
const QUALIFIER_WORDS = QUALIFIERS.flatMap(([tag, words]) => words.map((w) => [fold(w), tag]))

function qualifierOf(token) {
  for (const [word, tag] of QUALIFIER_WORDS) {
    if (token === word) return { tag, rest: '' }
  }
  // Zusammengesetzte Wörter: "kurzhantelrudern" -> kurzhantel + rudern (nur lange Merkmal-Wörter, Rest mind. 4 Zeichen)
  for (const [word, tag] of QUALIFIER_WORDS) {
    if (word.length >= 5 && token.length >= word.length + 4 && token.startsWith(word)) return { tag, rest: token.slice(word.length) }
  }
  return null
}

function extractQualifiers(tokens) {
  const tags = []
  const base = []
  for (const token of tokens) {
    const q = qualifierOf(token)
    if (!q) { base.push(token); continue }
    tags.push(q.tag)
    if (q.rest) base.push(q.rest)
  }
  return { tags: [...new Set(tags)], base }
}

// --- Tippfehler ---------------------------------------------------------------------------------------------------
function editDistance(a, b, limit) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}

// --- Matcher ------------------------------------------------------------------------------------------------------
const entryId = (entry) => String(entry?._id ?? entry?.id ?? '')

function describe(entry, tags = []) {
  return { exercise_id: entryId(entry), name_en: entry?.name_en || entry?.name || '', name_de: entry?.name || '', tags }
}

/**
 * @param {{catalog: Array, customExercises?: Array}} sources
 * catalog: Übungen wie aus loadDefaultExercises()/default-exercises.json (name, name_en, aliases, aliasIds ...)
 * customExercises: eigene Übungen des Nutzers ({_id, name})
 */
export function createExerciseMatcher({ catalog = [], customExercises = [] } = {}) {
  const list = Array.isArray(catalog) ? catalog : []
  const index = buildCatalogIndex(list)
  const byNameEn = new Map()
  for (const entry of list) {
    const key = String(entry?.name_en || '').trim().toLowerCase()
    if (key && !byNameEn.has(key)) byNameEn.set(key, entry)
  }

  const custom = new Map()
  for (const entry of Array.isArray(customExercises) ? customExercises : []) {
    const key = fold(entry?.name)
    if (key && !custom.has(key)) custom.set(key, entry)
  }

  // Konzepte mit aufgelösten Zielen; Ziele, die der übergebene Katalog nicht hat, entfallen.
  const concepts = SYNONYMS.map((concept) => ({
    ...concept,
    resolved: concept.targets
      .map((target) => ({ ...target, entry: byNameEn.get(target.name.toLowerCase()) }))
      .filter((target) => target.entry)
  }))
  const keyIndex = new Map()
  for (const concept of concepts) {
    for (const raw of concept.keys) {
      const key = stemPhrase(typeof raw === 'string' ? raw : raw.key)
      if (key && !keyIndex.has(key)) keyIndex.set(key, { concept, implies: typeof raw === 'string' ? [] : raw.implies || [] })
    }
  }
  const keyList = [...keyIndex.keys()]

  const suggestionsOf = (concept) => concept.resolved.slice(0, MAX_SUGGESTIONS).map((target) => describe(target.entry, target.tags))
  const suggestFromSuggest = (concept) => (concept.suggest || []).map((n) => byNameEn.get(n.toLowerCase())).filter(Boolean).map((entry) => describe(entry))

  function fromConcept(hit, userTags, via, query) {
    const { concept, implies } = hit
    const tags = [...new Set([...userTags, ...implies])]
    if (!concept.resolved.length) {
      return { status: 'not_found', via, query, suggestions: suggestFromSuggest(concept), candidates: [], assumed: [] }
    }
    // Optionale Ziele (Zusatzgewicht, assistiert, eng ...) nur, wenn der Nutzer ein passendes Merkmal genannt hat.
    let remaining = concept.resolved.filter((target) => !target.optional || target.tags.some((tag) => tags.includes(tag)))
    for (const tag of tags) {
      const next = remaining.filter((target) => target.tags.includes(tag))
      // Ein genanntes Merkmal, das keine Übung dieses Begriffs hat: nicht still etwas anderes wählen.
      if (!next.length) return { status: 'not_found', via, query, suggestions: suggestionsOf(concept), candidates: [], assumed: [] }
      remaining = next
    }
    if (remaining.length === 1) {
      return { status: 'matched', via, query, ...describe(remaining[0].entry, remaining[0].tags), assumed: [], candidates: [] }
    }
    // Nachfragen nur, wenn sich die Übungen im GERÄT unterscheiden (Kurzhantel/Kabel/Maschine ...), nicht bei sitzend/stehend.
    const equipments = new Set(remaining.map((target) => target.tags.find((tag) => EQUIPMENT_TAGS.includes(tag)) || 'none'))
    if (concept.ask && equipments.size > 1) {
      return {
        status: 'ambiguous', via, query, reason: 'variant', assumed: [],
        candidates: remaining.slice(0, MAX_CANDIDATES).map((target) => describe(target.entry, target.tags))
      }
    }
    const [chosen] = remaining
    // alternatives: die übrigen Varianten, damit die Oberfläche "Variante angenommen" per Tap ändern lassen kann.
    const alternatives = remaining.slice(1, MAX_CANDIDATES + 1).map((target) => describe(target.entry, target.tags))
    return { status: 'matched', via, query, ...describe(chosen.entry, chosen.tags), assumed: ['variant'], candidates: [], alternatives }
  }

  function conceptByFuzzy(phrase) {
    if (phrase.length < 6) return null
    const limit = phrase.length >= 11 ? 2 : 1
    let best = null
    let bestDistance = limit + 1
    let tie = false
    for (const key of keyList) {
      const distance = editDistance(phrase, key, limit)
      if (distance > limit) continue
      if (distance < bestDistance) { best = key; bestDistance = distance; tie = false } else if (distance === bestDistance && keyIndex.get(key) !== keyIndex.get(best)) tie = true
    }
    return best && !tie ? keyIndex.get(best) : null
  }

  function fromCatalogTokens(baseTokens, userTags, query) {
    // Wörter der Eingabe + genannte Merkmale (als englische Wörter) müssen alle im englischen Katalognamen vorkommen.
    const words = [...new Set([...baseTokens.map(stem), ...userTags])].filter((w) => w.length >= 3)
    if (!words.length) return { status: 'not_found', via: 'tokens', query, suggestions: [], candidates: [], assumed: [] }
    const found = []
    for (const entry of list) {
      const name = String(entry?.name_en || '').toLowerCase()
      const nameWords = name.split(/[^a-z0-9]+/).filter(Boolean).map(stem)
      if (words.every((w) => nameWords.includes(w))) found.push(entry)
    }
    const basic = found.filter((entry) => !/ v\. \d$|\((?:male|female)\)|\bpov\b/i.test(String(entry.name_en))).sort((a, b) => String(a.name_en).length - String(b.name_en).length)
    // Nur bei mindestens zwei aussagekräftigen Wörtern automatisch zuordnen; einzelne Wörter wie "plank" oder "curl" sind zu unscharf.
    if (words.length >= 2 && basic.length === 1) return { status: 'matched', via: 'tokens', query, ...describe(basic[0]), assumed: [], candidates: [] }
    if (words.length >= 2 && basic.length >= 2 && basic.length <= MAX_CANDIDATES) {
      return { status: 'ambiguous', via: 'tokens', query, reason: 'tokens', assumed: [], candidates: basic.map((entry) => describe(entry)) }
    }
    return { status: 'not_found', via: 'tokens', query, suggestions: basic.slice(0, MAX_SUGGESTIONS).map((entry) => describe(entry)), candidates: [], assumed: [] }
  }

  return function match(name) {
    const query = String(name ?? '').trim()
    const folded = fold(query)
    if (!folded) return { status: 'not_found', via: null, query, suggestions: [], candidates: [], assumed: [] }

    // 1. Eigene Übungen des Nutzers (exakter Name) haben Vorrang.
    const own = custom.get(folded)
    if (own) return { status: 'matched', via: 'custom', query, exercise_id: entryId(own), name_en: own.name, name_de: own.name, tags: [], assumed: [], candidates: [] }

    // 2. Synonymtabelle, ganze Eingabe. Vor dem Katalog, weil die deutschen Katalognamen maschinell übersetzt sind
    //    ("Trizepsdrücken" wäre dort ein anderes Gerät als im Gym gemeint).
    const tokens = folded.split(' ').filter((token) => !STOP_WORDS.has(token))
    if (!tokens.length) return { status: 'not_found', via: null, query, suggestions: [], candidates: [], assumed: [] }
    const whole = keyIndex.get(tokens.map(stem).join(' '))
    if (whole) return fromConcept(whole, [], 'synonym', query)

    // 3. Exakter Katalogname (englisch/deutsch/frühere Namen, Wortreihenfolge egal).
    const exact = findCatalogEntryByName(index, query)
    if (exact) return { status: 'matched', via: 'catalog', query, ...describe(exact), assumed: [], candidates: [] }

    // 4. Synonymtabelle ohne Merkmal-Wörter (Kurzhantel, Kabel, sitzend ...).
    const { tags, base } = extractQualifiers(tokens)
    const basePhrase = base.map(stem).join(' ')
    const viaBase = basePhrase ? keyIndex.get(basePhrase) : null
    if (viaBase) return fromConcept(viaBase, tags, 'synonym', query)

    // 5. Tippfehler (nur eindeutig, nur bei längeren Begriffen).
    const fuzzy = basePhrase ? conceptByFuzzy(basePhrase) : null
    if (fuzzy) return fromConcept(fuzzy, tags, 'fuzzy', query)

    // 6. Katalog-Wortsuche (alle Wörter müssen vorkommen).
    return fromCatalogTokens(base, tags, query)
  }
}

export function matchExerciseName(name, sources) {
  return createExerciseMatcher(sources)(name)
}

/**
 * Hängt jeder erkannten Übung das Ergebnis des Abgleichs an (ohne die Eingabe zu verändern) und sammelt Rückfragen.
 * @param {{sessions: Array}} parsed - Ergebnis von parseWorkoutText() (oder gleich geformt)
 * @param {Function} match - createExerciseMatcher(...)
 */
export function resolveParsedWorkout(parsed, match) {
  const summary = { total: 0, matched: 0, ambiguous: 0, not_found: 0 }
  const questions = []
  const sessions = (parsed?.sessions || []).map((session, s) => ({
    ...session,
    exercises: (session.exercises || []).map((exercise, e) => {
      const resolution = match(exercise.raw_text)
      summary.total += 1
      summary[resolution.status] += 1
      if (resolution.status !== 'matched') {
        questions.push({ session: s, index: e, raw_text: exercise.raw_text, status: resolution.status, candidates: resolution.candidates || [], suggestions: resolution.suggestions || [] })
      }
      const matched = resolution.status === 'matched'
      return {
        ...exercise,
        exercise_id: matched ? resolution.exercise_id : null,
        variant: matched && resolution.tags?.length ? resolution.tags.join(',') : null,
        assumed: [...new Set([...(exercise.assumed || []), ...(resolution.assumed || [])])],
        resolution
      }
    })
  }))
  return { ...parsed, sessions, summary, questions }
}
