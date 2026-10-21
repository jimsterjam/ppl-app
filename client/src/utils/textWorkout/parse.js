// Freitext-Einstieg, Schritt 1: Schnellpfad-Parser (reiner Code, kein LLM, kein Netz, kein Katalog).
//
//   parseWorkoutText("Push: Bankdrücken 3x8 80 kg, Dips 3x10") -> { split, days_per_week, sessions, unresolved, needs_llm }
//
// Er erkennt Standardmuster auf Deutsch und Englisch (3x8, 3 x 8, 3 Sätze à 8, 80 kg, 82,5kg, 60 Sek., 4x max ...),
// Sitzungsnamen (Push/Pull/Legs/Ganzkörper ...), Splits (PPL ...) und Tage pro Woche. Was er nicht sicher versteht,
// meldet er in `unresolved` und setzt `needs_llm` (Schritt 5 würde dann übernehmen). Er rät nie.
import {
  DEFAULT_SETS,
  LIMITS,
  MAX_INPUT_LENGTH,
  emptyExercise,
  emptyResult,
  inRange
} from './schema.js'

// --- Eingabe säubern ----------------------------------------------------------------------------------------------
// Steuerzeichen (außer Zeilenumbruch und Tab) und Zeilen-/Absatztrenner entfernen, ohne Regex mit Steuerzeichen.
function isControlChar(code) {
  return (code <= 8) || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127 || code === 0x2028 || code === 0x2029
}

function cleanInput(text) {
  const cleaned = String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/<[^>]*>/g, ' ') // HTML-Tags weg (der Text wird nie als HTML angezeigt, aber auch nie weitergereicht)
    .replace(/[<>]/g, ' ')
  const chars = Array.from(cleaned).filter((ch) => !isControlChar(ch.codePointAt(0)))
  return { text: chars.slice(0, MAX_INPUT_LENGTH).join(''), truncated: chars.length > MAX_INPUT_LENGTH }
}

// --- Zahlwörter -------------------------------------------------------------------------------------------------
const NUMBER_WORDS = {
  ein: 1, eine: 1, einen: 1, one: 1, zwei: 2, two: 2, drei: 3, three: 3, vier: 4, four: 4, fünf: 5, fuenf: 5, five: 5,
  sechs: 6, six: 6, sieben: 7, seven: 7, acht: 8, eight: 8, neun: 9, nine: 9, zehn: 10, ten: 10, elf: 11, eleven: 11,
  zwölf: 12, zwoelf: 12, twelve: 12, fünfzehn: 15, fifteen: 15, zwanzig: 20, twenty: 20
}
const NUMBER_WORD_PATTERN = Object.keys(NUMBER_WORDS).sort((a, b) => b.length - a.length).join('|')

// Zahlwörter nur in typischen Zahlenmustern ersetzen ("drei mal acht", "vier Sätze", "fünf Wdh.") - nicht überall,
// sonst würde aus "Ein Arm Rudern" eine 1.
function replaceNumberWords(text) {
  const w = `(${NUMBER_WORD_PATTERN})`
  return text
    .replace(new RegExp(`\\b${w}\\s*(mal|x|times)\\s*${w}\\b`, 'gi'), (_, a, __, b) => `${NUMBER_WORDS[a.toLowerCase()]}x${NUMBER_WORDS[b.toLowerCase()]}`)
    .replace(new RegExp(`\\b${w}\\s*(sätze|saetze|satz|sets?|wdh\\.?|wiederholungen|reps?)\\b`, 'gi'), (_, a, unit) => `${NUMBER_WORDS[a.toLowerCase()]} ${unit}`)
}

// --- Muster ---------------------------------------------------------------------------------------------------
const NUM = '\\d+(?:[.,]\\d+)?'
const END = '(?![\\p{L}\\d])' // Wortende (Unicode)
const START = '(?<![\\p{L}\\d])' // Wortanfang (Unicode)
const toNumber = (s) => Number(String(s).replace(',', '.'))

const RE_SETS_X_REPS = new RegExp(`(\\d{1,3})\\s*(?:x|×|\\*)\\s*(\\d{1,3})(?:\\s*(?:-|–|bis|to)\\s*(\\d{1,3}))?(?!\\d)(?!\\s*(?:kg|kilo|s${END}|sek|sec|min))`, 'iu')
const RE_SETS_X_SECONDS = new RegExp(`(\\d{1,3})\\s*(?:x|×|\\*)\\s*(\\d+)\\s*(?:s|sek\\.?|sec|sekunden)${END}`, 'iu')
const RE_SETS_X_MAX = new RegExp(`(\\d{1,3})\\s*(?:x|×|\\*)\\s*(?:max(?:imal)?|amrap)${END}`, 'iu')
const RE_SETS_AT_REPS = new RegExp(`(\\d{1,3})\\s*(?:sätze|saetze|satz|sets?)${END}\\s*(?:à|je|mit|of|x|×|\\*|,)?\\s*(\\d{1,3})(?!\\d)(?!\\s*(?:kg|kilo))\\s*(?:wdh\\.?|wiederholungen|reps?|mal)?${END}`, 'iu')
const RE_SETS_ONLY = new RegExp(`(\\d{1,3})\\s*(?:sätze|saetze|satz|sets?)${END}`, 'iu')
const RE_REPS_ONLY = new RegExp(`(\\d{1,3})\\s*(?:wdh\\.?|wiederholungen|reps?|mal)${END}`, 'iu')
const RE_WEIGHT_KG = new RegExp(`(${NUM})\\s*(?:kg|kilo(?:gramm)?s?)${END}`, 'iu')
const RE_WEIGHT_LBS = new RegExp(`(${NUM})\\s*(?:lbs?|pounds?)${END}`, 'iu')
const RE_WEIGHT_WITH = new RegExp(`(?:^|\\s)(?:mit|bei|@|at|with)\\s*(${NUM})(?!\\d)(?!\\s*(?:x|×|\\*|sätze|saetze|sets?|wdh|reps?|sek|sec|s${END}|min))`, 'iu')
const RE_DURATION = new RegExp(`(${NUM})\\s*(sekunden|sekunde|sek\\.?|seconds?|secs?|s|minuten|minute|min\\.?|minutes?)${END}`, 'iu')
const RE_DAYS = /(\d)\s*(?:tage?|tagen|x\s*(?:pro|die|in der)\s*woche|mal\s*(?:pro|die|in der)\s*woche|days?(?:\s*(?:a|per|\/)\s*week)?)(?:\s*(?:pro|die|in der)\s*woche)?/i

// Zeitangaben sind nur mit einer sicheren Einheit eindeutig; "s" allein zählt nur direkt an einer Zahl ("60s").
function durationSeconds(match) {
  const value = toNumber(match[1])
  const unit = match[2].toLowerCase()
  return /^m/.test(unit) ? Math.round(value * 60) : Math.round(value)
}

const RE_REST = new RegExp(`(?:(?:pause|pausen|rest)\\s*(?:von|:)?\\s*(\\d+)\\s*(?:sekunden|sek\\.?|s|minuten|min\\.?)|(\\d+)\\s*(?:sekunden|sek\\.?|s|minuten|min\\.?)\\s*(?:pause|pausen|rest))${END}`, 'iu')

const FILLER_WORDS = 'mit|bei|à|je|pro|und|and|dann|danach|then|heute|today|ich|mache|mach|machen|will|möchte|moechte|trainiere|trainieren|do|doing|bitte|plus|noch|auch|sowie|at|with|of|ca|circa|etwa|ungefähr|ungefaehr'
const FILLER = new RegExp(`${START}(?:${FILLER_WORDS})${END}`, 'giu') // für die Plan-Erkennung (ganze Segmente)
const FILLER_EDGE_START = new RegExp(`^(?:${FILLER_WORDS})${END}\\.?\\s*`, 'iu')
const FILLER_EDGE_END = new RegExp(`\\s*${START}(?:${FILLER_WORDS})\\.?$`, 'iu')
const UNITS_LEFT = new RegExp(`${START}(?:kg|kilo|kilogramm|sätze|saetze|satz|sets?|wdh\\.?|wiederholungen|reps?|mal|sek\\.?|sekunden|sekunde|sec|seconds?|min\\.?|minuten|minute)${END}`, 'giu')

// --- Sitzungen und Splits ---------------------------------------------------------------------------------------
const SESSION_WORDS = [
  { re: /^(?:push|push\s*day|push\s*tag|drücken|druecken)$/i, label: 'Push', type: 'push' },
  { re: /^(?:pull|pull\s*day|pull\s*tag|ziehen)$/i, label: 'Pull', type: 'pull' },
  { re: /^(?:legs?|leg\s*day|leg\s*tag|beine|beintag)$/i, label: 'Legs', type: 'legs' },
  { re: /^(?:full\s*-?\s*body|ganzkörper|ganzkoerper|ganzkörpertraining|ganzkoerpertraining)$/i, label: 'Fullbody', type: 'fullbody' },
  { re: /^(?:upper|upper\s*body|oberkörper|oberkoerper)$/i, label: 'Upper', type: null },
  { re: /^(?:lower|lower\s*body|unterkörper|unterkoerper)$/i, label: 'Lower', type: null },
  { re: /^(?:brust|chest|rücken|ruecken|back|schultern?|shoulders?|arme|arms?|bizeps|biceps|trizeps|triceps)$/i, label: null, type: null }
]

function matchSessionWord(text) {
  const t = text.trim().replace(/[:.!\-–]+$/g, '').trim()
  for (const entry of SESSION_WORDS) {
    if (entry.re.test(t)) return { label: entry.label ?? capitalize(t), type: entry.type }
  }
  return null
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

function detectSplit(text) {
  const t = text.toLowerCase()
  if (/\bppl\b|push\s*[,/\-– ]?\s*pull\s*[,/\-– ]?\s*(?:legs?|beine)/.test(t)) return 'ppl'
  if (/upper\s*[/\-–,]?\s*lower|ober\s*-?\s*körper\s*[/\-–,]?\s*unter|oberkörper\s*[/\-–,]?\s*unterkörper/.test(t)) return 'upper_lower'
  if (/\bbro\s*split\b/.test(t)) return 'bro'
  if (/\bfull\s*-?\s*body\b|\bganzkörper/.test(t)) return 'fullbody'
  return null
}

// --- Ein Segment -> Übung ----------------------------------------------------------------------------------------
function parseSegment(rawSegment) {
  const raw = rawSegment.trim()
  const issues = []
  let rest = replaceNumberWords(raw)
  const exercise = emptyExercise(raw)
  let hasNumber = false

  // Zeit zuerst herausnehmen, damit "60s" nicht als Gewicht/Wdh. gelesen wird. "3x60s" = Sätze x Sekunden.
  const setsSeconds = RE_SETS_X_SECONDS.exec(rest)
  const dur = setsSeconds ? null : RE_DURATION.exec(rest)
  if (setsSeconds) {
    const seconds = inRange(Number(setsSeconds[2]), LIMITS.durationSeconds)
    if (seconds != null) exercise.duration_seconds = seconds
    else issues.push('out_of_range')
    const sets = inRange(setsSeconds[1], LIMITS.sets)
    if (sets != null) { exercise.sets = sets; exercise.assumed = [] } else issues.push('out_of_range')
    rest = rest.replace(setsSeconds[0], ' ')
    hasNumber = true
  } else if (dur && !RE_SETS_X_REPS.test(rest.replace(dur[0], ' '))) {
    const seconds = inRange(durationSeconds(dur), LIMITS.durationSeconds)
    if (seconds != null) exercise.duration_seconds = seconds
    else issues.push('out_of_range')
    rest = rest.replace(dur[0], ' ')
    hasNumber = true
  }

  // Pausen-Angaben ("90 Sek Pause") sind kein Teil des Namens; sie werden bewusst nicht übernommen (Nicht-Ziel), aber gemeldet.
  const restMatch = RE_REST.exec(rest)
  if (restMatch) {
    issues.push('ignored_rest')
    rest = rest.replace(restMatch[0], ' ')
  }

  // Gewicht (kg). lbs werden bewusst nicht umgerechnet: lieber melden als falsch rechnen.
  const lbs = RE_WEIGHT_LBS.exec(rest)
  if (lbs) {
    issues.push('unit_unsupported')
    rest = rest.replace(lbs[0], ' ')
  }
  const kg = RE_WEIGHT_KG.exec(rest)
  if (kg) {
    const w = inRange(toNumber(kg[1]), LIMITS.weightKg)
    if (w != null) exercise.weight_kg = Math.round(w * 100) / 100
    else issues.push('out_of_range')
    rest = rest.replace(kg[0], ' ')
    hasNumber = true
  }

  // Sätze/Wiederholungen
  const setsMax = RE_SETS_X_MAX.exec(rest)
  const setsXReps = RE_SETS_X_REPS.exec(rest)
  const setsAtReps = RE_SETS_AT_REPS.exec(rest)
  const applySets = (value) => {
    const sets = inRange(value, LIMITS.sets)
    if (sets != null) { exercise.sets = sets; exercise.assumed = exercise.assumed.filter((a) => a !== 'sets') } else issues.push('out_of_range')
  }
  const applyReps = (value) => {
    const reps = inRange(value, LIMITS.reps)
    if (reps != null) exercise.reps = reps
    else issues.push('out_of_range')
  }
  if (setsMax) {
    applySets(setsMax[1])
    rest = rest.replace(setsMax[0], ' ')
    hasNumber = true
  } else if (setsXReps) {
    applySets(setsXReps[1])
    if (setsXReps[3]) {
      const low = inRange(setsXReps[2], LIMITS.reps)
      const high = inRange(setsXReps[3], LIMITS.reps)
      if (low != null && high != null && low < high) exercise.reps_range = [low, high]
      else issues.push('out_of_range')
    } else {
      applyReps(setsXReps[2])
    }
    rest = rest.replace(setsXReps[0], ' ')
    hasNumber = true
  } else if (setsAtReps) {
    applySets(setsAtReps[1])
    applyReps(setsAtReps[2])
    rest = rest.replace(setsAtReps[0], ' ')
    hasNumber = true
  } else {
    const onlySets = RE_SETS_ONLY.exec(rest)
    if (onlySets) { applySets(onlySets[1]); rest = rest.replace(onlySets[0], ' '); hasNumber = true }
    const onlyReps = RE_REPS_ONLY.exec(rest)
    if (onlyReps) { applyReps(onlyReps[1]); rest = rest.replace(onlyReps[0], ' '); hasNumber = true }
  }

  // Gewicht ohne Einheit: "mit 80" / "@80" - oder eine einzelne freie Zahl am Ende nach einer Sätze-x-Wdh.-Angabe
  // ("Bankdrücken 3x8 80"). Nur diese zwei eindeutigen Fälle, alles andere bleibt unaufgelöst.
  if (exercise.weight_kg == null) {
    const withMatch = RE_WEIGHT_WITH.exec(rest)
    if (withMatch) {
      const w = inRange(toNumber(withMatch[1]), LIMITS.weightKg)
      if (w != null) exercise.weight_kg = Math.round(w * 100) / 100
      else issues.push('out_of_range')
      rest = rest.replace(withMatch[0], ' ')
      hasNumber = true
    } else if ((setsXReps || setsAtReps) && exercise.duration_seconds == null) {
      const tail = new RegExp(`(?:^|\\s)(${NUM})\\s*$`).exec(rest.trim())
      if (tail) {
        const w = inRange(toNumber(tail[1]), LIMITS.weightKg)
        if (w != null) { exercise.weight_kg = Math.round(w * 100) / 100; rest = rest.trim().slice(0, rest.trim().length - tail[0].length); hasNumber = true }
      }
    }
  }

  // "80 kg x 8": Wiederholungen hinter dem Gewicht. Alles andere mit übrigem "x Zahl" ist uneindeutig ("8 x 80 kg": 8 Sätze
  // oder 8 Wdh.? "3x8x80"?) und wird nicht geraten, sondern gemeldet.
  if (kg && exercise.reps == null && exercise.reps_range == null) {
    const after = /^\s*(?:x|×|\*)\s*(\d{1,3})(?!\d)/i
    const idx = rest.search(/(?:x|×|\*)\s*\d/i)
    const tailPart = idx >= 0 ? rest.slice(idx) : ''
    const m = after.exec(tailPart)
    if (m && kg.index < raw.length && /^\D*$/.test(rest.slice(0, idx).replace(/[\p{L}\s.\-–()]/gu, ''))) {
      const reps = inRange(m[1], LIMITS.reps)
      if (reps != null) exercise.reps = reps
      rest = rest.slice(0, idx) + ' ' + tailPart.slice(m[0].length)
    }
  }
  if (/(?:^|\s)(?:x|×|\*)\s*\d|\d\s*(?:x|×|\*)(?:\s|$)/i.test(rest)) {
    issues.push('ambiguous_numbers')
    rest = rest.replace(/(?:x|×|\*)\s*\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s*(?:x|×|\*)(?=\s|$)/gi, ' ')
  }

  // Übungsname = Rest ohne Einheiten und Randwörter (Füllwörter nur AM RAND, nie mitten im Namen: "Kabelzug mit Seil").
  let name = rest
    .replace(UNITS_LEFT, ' ')
    .replace(/\(\s*\)|\[\s*\]/g, ' ')
    .replace(/[@×*]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,;:.\-–•*]+|[\s,;:.\-–•*]+$/g, '')
    .trim()
  for (let i = 0; i < 4; i += 1) {
    const stripped = name.replace(FILLER_EDGE_START, '').replace(FILLER_EDGE_END, '').replace(/^[\s,;:.\-–•*]+|[\s,;:.\-–•*]+$/g, '').trim()
    if (stripped === name) break
    name = stripped
  }

  if (!name || !/\p{L}/u.test(name)) {
    return { exercise: null, issues: [hasNumber ? 'no_name' : 'unparsed'], raw }
  }
  if (/\d/.test(name)) {
    // Zahl im Namen (z. B. "21 Curls", "3x8 80s 12"): nicht eindeutig lesbar -> nicht raten, melden.
    return { exercise: null, issues: ['unparsed'], raw }
  }
  exercise.raw_text = name
  return { exercise, issues, raw }
}

// --- Gesamttext ---------------------------------------------------------------------------------------------------
function splitSegments(text) {
  return text
    .split(/\n|;|,(?!\d)|\s+(?:und|and|&|\+|dann|danach|then)\s+|\s+\/\s+/i)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * @param {string} input - Freitext des Nutzers
 * @returns {{split: string|null, days_per_week: number|null, sessions: Array, unresolved: Array, needs_llm: boolean}}
 */
export function parseWorkoutText(input) {
  const result = emptyResult()
  const { text, truncated } = cleanInput(input)
  if (truncated) result.unresolved.push({ raw_text: '', reason: 'input_truncated' })
  if (!text.trim()) return result

  result.split = detectSplit(text)
  const days = RE_DAYS.exec(text)
  if (days) result.days_per_week = inRange(days[1], LIMITS.daysPerWeek)

  let current = null
  const startSession = (label, type) => {
    current = { label, type, exercises: [] }
    result.sessions.push(current)
  }

  let lastSegment = ''
  for (let segment of splitSegments(text)) {
    segment = segment.replace(/^\s*(?:[-•*]|\d{1,2}[.)])\s+/, '')
    // "Push: Bankdrücken 3x8" -> Sitzungsname + Rest
    const colon = /^([^:]{2,24}):\s*(.*)$/.exec(segment)
    if (colon) {
      const session = matchSessionWord(colon[1])
      if (session) {
        startSession(session.label, session.type)
        segment = colon[2].trim()
        if (!segment) continue
      }
    }
    const onlySession = matchSessionWord(segment)
    if (onlySession) {
      startSession(onlySession.label, onlySession.type)
      continue
    }
    // Angaben zum Plan ("PPL", "5 Tage") sind keine Übungen.
    const planOnly = segment.replace(RE_DAYS, ' ').replace(/\b(?:ppl|push\s*pull\s*legs?|upper\s*lower|bro\s*split|split|training|plan|pro woche|a week|per week)\b/gi, ' ').replace(FILLER, ' ').replace(/[\s,;:.\-–]+/g, ' ').trim()
    if (!planOnly && (RE_DAYS.test(segment) || detectSplit(segment) || /\bppl\b|\bsplit\b/i.test(segment))) continue

    let parsed = parseSegment(segment)
    // "Bankdrücken, 3x8, 80kg": ein Segment nur aus Zahlen gehört zur Übung davor - aber nur, wenn es dort nichts überschreibt.
    if (!parsed.exercise && parsed.issues[0] === 'no_name' && current && current.exercises.length && lastSegment) {
      const merged = parseSegment(`${lastSegment} ${segment}`)
      const prev = current.exercises[current.exercises.length - 1]
      const sameName = merged.exercise && merged.exercise.raw_text === prev.raw_text
      const noConflict = sameName && [['reps', 'reps'], ['weight_kg', 'weight_kg'], ['duration_seconds', 'duration_seconds']]
        .every(([key]) => prev[key] == null || prev[key] === merged.exercise[key])
      if (noConflict) {
        current.exercises[current.exercises.length - 1] = merged.exercise
        lastSegment = `${lastSegment} ${segment}`
        // Zuordnung nur über die Reihenfolge ("Bankdrücken, 3x8, 80kg") - sichtbar melden, damit die Oberfläche sie markieren kann.
        result.unresolved.push({ raw_text: lastSegment, reason: 'merged_numbers' })
        for (const reason of new Set(merged.issues)) {
          if (!result.unresolved.some((u) => u.reason === reason && u.raw_text === lastSegment)) result.unresolved.push({ raw_text: lastSegment, reason })
        }
        continue
      }
    }
    if (!parsed.exercise) {
      result.unresolved.push({ raw_text: parsed.raw, reason: parsed.issues[0] })
      continue
    }
    if (!current) startSession(null, null)
    current.exercises.push(parsed.exercise)
    lastSegment = segment
    for (const reason of new Set(parsed.issues)) result.unresolved.push({ raw_text: parsed.raw, reason })
  }

  // Nur Zeilen, die der Schnellpfad nicht lesen konnte, brauchen den LLM-Fallback (Schritt 5); gemeldete Hinweise (lbs, Pause ...) nicht.
  result.needs_llm = result.unresolved.some((u) => u.reason === 'unparsed' || u.reason === 'no_name')
  return result
}

export { DEFAULT_SETS }
