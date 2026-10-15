function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // Bindestrich wie Leerzeichen: "push-up" (Katalog) == "push up" (Suche)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const VARIANT_MARKERS = [
  'incline', 'decline', 'close grip', 'wide grip', 'neutral grip', 'underhand', 'overhand',
  'machine', 'cable', 'smith', 'assisted', 'band', 'single arm', 'one arm', 'seated', 'sumo',
  'romanian', 'unilateral', 'narrow', 'wide',
  'schrag', 'schraeg', 'eng', 'weit', 'maschine', 'kabelzug', 'assistiert', 'einarmig',
  'sitzend', 'neutral', 'sumo', 'rumanisch', 'rumanisches', 'variante'
]

// Hauptübungen: Suche nach genau diesem Begriff zeigt zuerst die Basisübungen (Absprache Paul 15.10.), danach die
// Varianten. `basics` = englische Katalognamen (normalisiert, Bindestrich = Leerzeichen) in fester Reihenfolge.
const CANONICAL_GROUPS = [
  {
    id: 'pullup',
    aliases: ['pull up', 'pullup', 'pull ups', 'pullups', 'chin up', 'chinup', 'klimmzug', 'klimmzuge', 'klimmzuege'],
    basics: ['pull up', 'chin up']
  },
  {
    id: 'benchpress',
    aliases: ['bench press', 'benchpress', 'bankdrucken', 'bankdruecken', 'bankdruck', 'flat bench press'],
    basics: ['bench press barbell', 'dumbbell bench press']
  },
  {
    id: 'squat',
    aliases: ['squat', 'squats', 'kniebeuge', 'kniebeugen'],
    basics: ['full squat', 'barbell high bar squat', 'bodyweight squat', 'dumbbell goblet squat']
  },
  {
    id: 'deadlift',
    aliases: ['deadlift', 'deadlifts', 'kreuzheben'],
    basics: ['barbell deadlift']
  },
  {
    id: 'dip',
    aliases: ['dip', 'dips'],
    basics: []
  },
  {
    id: 'pushup',
    aliases: ['push up', 'pushup', 'push ups', 'pushups', 'liegestutz', 'liegestuetz', 'liegestutze', 'liegestuetze'],
    basics: ['push up']
  },
  {
    id: 'lunge',
    aliases: ['lunge', 'lunges', 'ausfallschritt', 'ausfallschritte'],
    basics: ['walking lunge', 'dumbbell lunge', 'barbell lunge']
  },
  {
    id: 'curl',
    aliases: ['curl', 'curls', 'bizepscurl', 'biceps curl', 'bicep curl', 'bizeps curl'],
    basics: ['barbell curl', 'dumbbell biceps curl']
  },
  {
    id: 'row',
    aliases: ['row', 'rows', 'rudern'],
    basics: ['barbell bent over row']
  }
]

function hasVariantMarker(text) {
  return VARIANT_MARKERS.some((marker) => text.includes(marker))
}

function getCanonicalGroup(queryNormalized) {
  // Ganze Wörter/Wortfolgen (nicht Teilstrings): "arrow" ist keine Rudern-Suche.
  return CANONICAL_GROUPS.find((group) => group.aliases.some((alias) => {
    const normalizedAlias = normalizeText(alias)
    return normalizedAlias && hasWord(queryNormalized, normalizedAlias)
  })) || null
}

function scoreTokenMatch(primary, secondary, token) {
  if (!token) return 0
  let score = 0

  if (primary === token) score += 260
  if (primary.startsWith(token)) score += 160
  if (primary.includes(` ${token} `) || primary.endsWith(` ${token}`) || primary.startsWith(`${token} `)) score += 120
  else if (primary.includes(token)) score += 80

  if (secondary.some((text) => text.includes(token))) score += 35
  return score
}

function startsWithWholeWord(text, query) {
  if (!text || !query) return false
  if (text === query) return true
  return text.startsWith(`${query} `)
}

function hasWord(text, token) {
  if (!text || !token) return false
  return text === token
    || text.startsWith(`${token} `)
    || text.includes(` ${token} `)
    || text.endsWith(` ${token}`)
}

export function searchAndRankExercises(items, query, options = {}) {
  const list = Array.isArray(items) ? items : []
  const rawQuery = String(query || '').trim()
  if (!rawQuery) return list

  const getPrimaryText = typeof options.getPrimaryText === 'function'
    ? options.getPrimaryText
    : (item) => item?.displayName || item?.name || ''

  const getSecondaryTexts = typeof options.getSecondaryTexts === 'function'
    ? options.getSecondaryTexts
    : () => []

  const queryNormalized = normalizeText(rawQuery)
  if (!queryNormalized) return list

  const baseTokens = queryNormalized.split(' ').filter(Boolean)
  const canonicalGroup = getCanonicalGroup(queryNormalized)
  // Basisübungen nur zuerst, wenn der Suchbegriff genau die Übungsgruppe benennt ("squat"), nicht bei "goblet squat".
  const basicsFirst = canonicalGroup
    && canonicalGroup.aliases.some((alias) => normalizeText(alias) === queryNormalized)
  const expandedTokens = new Set(baseTokens)

  if (canonicalGroup) {
    canonicalGroup.aliases.forEach((alias) => {
      const normalizedAlias = normalizeText(alias)
      if (normalizedAlias) expandedTokens.add(normalizedAlias)
    })
  }

  const ranked = list
    .map((item, index) => {
      const primary = normalizeText(getPrimaryText(item))
      const secondary = (getSecondaryTexts(item) || [])
        .map((value) => normalizeText(value))
        .filter(Boolean)

      if (!primary) return { item, index, score: Number.NEGATIVE_INFINITY }

      let score = 0

      if (primary === queryNormalized) score += 1200
      else if (primary.startsWith(queryNormalized)) score += 850
      else if (primary.includes(queryNormalized)) score += 620

      // Prioritize literal search intent: exact leading word beats fuzzy/alias matches.
      if (startsWithWholeWord(primary, queryNormalized)) {
        score += 500
      }

      // If user explicitly searches "klimmzug", prefer literal "klimmzug" hits over alias-only pull-up hits.
      if (hasWord(queryNormalized, 'klimmzug')) {
        const hasLiteralKlimmzug = hasWord(primary, 'klimmzug') || secondary.some((text) => hasWord(text, 'klimmzug'))
        if (hasLiteralKlimmzug) score += 560
        else score -= 240
      }

      expandedTokens.forEach((token) => {
        score += scoreTokenMatch(primary, secondary, token)
      })

      const variant = hasVariantMarker(primary)
      if (variant) score -= 140

      // Kürzere Namen vor langen Varianten (weniger zusätzliche Wörter als die Suche).
      score -= 15 * Math.max(0, primary.split(' ').length - baseTokens.length)

      if (basicsFirst) {
        const basicIndex = canonicalGroup.basics.indexOf(primary)
        if (basicIndex !== -1) score += 1000000 - basicIndex * 10000
      }

      if (canonicalGroup) {
        const matchesCanonical = canonicalGroup.aliases.some((alias) => {
          const normalizedAlias = normalizeText(alias)
          return normalizedAlias && primary.includes(normalizedAlias)
        })
        if (matchesCanonical) {
          score += variant ? 60 : 260
        }
      }

      const hasAnyQueryHit =
        score > 0 ||
        primary.includes(queryNormalized) ||
        secondary.some((text) => text.includes(queryNormalized))

      return {
        item,
        index,
        score: hasAnyQueryHit ? score : Number.NEGATIVE_INFINITY
      }
    })
    .filter((entry) => Number.isFinite(entry.score))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.index - b.index
    })

  const deduped = []
  const seenPrimary = new Set()
  for (const entry of ranked) {
    const item = entry.item
    const primaryKey = normalizeText(getPrimaryText(item)) || normalizeText(item?.name || '')
    if (!primaryKey) continue
    if (seenPrimary.has(primaryKey)) continue
    seenPrimary.add(primaryKey)
    deduped.push(item)
  }

  return deduped
}
