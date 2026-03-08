function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
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

const CANONICAL_GROUPS = [
  {
    id: 'pullup',
    aliases: ['pull up', 'pullup', 'pull ups', 'pullups', 'chin up', 'chinup', 'klimmzug', 'klimmzuge', 'klimmzuege']
  },
  {
    id: 'benchpress',
    aliases: ['bench press', 'benchpress', 'bankdrucken', 'bankdruecken', 'bankdruck', 'flat bench press']
  },
  {
    id: 'squat',
    aliases: ['squat', 'squats', 'kniebeuge', 'kniebeugen']
  },
  {
    id: 'deadlift',
    aliases: ['deadlift', 'deadlifts', 'kreuzheben']
  },
  {
    id: 'dip',
    aliases: ['dip', 'dips']
  },
  {
    id: 'pushup',
    aliases: ['push up', 'pushup', 'push ups', 'pushups', 'liegestutz', 'liegestuetz', 'liegestutze', 'liegestuetze']
  }
]

function hasVariantMarker(text) {
  return VARIANT_MARKERS.some((marker) => text.includes(marker))
}

function getCanonicalGroup(queryNormalized, queryTokens) {
  return CANONICAL_GROUPS.find((group) => {
    return group.aliases.some((alias) => {
      const normalizedAlias = normalizeText(alias)
      if (!normalizedAlias) return false
      if (queryNormalized.includes(normalizedAlias)) return true
      return queryTokens.includes(normalizedAlias)
    })
  }) || null
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
  const canonicalGroup = getCanonicalGroup(queryNormalized, baseTokens)
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

      expandedTokens.forEach((token) => {
        score += scoreTokenMatch(primary, secondary, token)
      })

      const variant = hasVariantMarker(primary)
      if (variant) score -= 140

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

  return ranked.map((entry) => entry.item)
}
