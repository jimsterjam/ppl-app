// Freitext-Einstieg, Schritt 3: Anzeige-Modell für die Vorschau ("Dein Workout") und die Rückfragen. Reiner Code, kein Vue.
//
//   const model = buildTextWorkoutModel('Bankdrücken 3x8 80, Seitheben', { match, goal })
//   pendingQuestion(model)            -> nächste Rückfrage (Ziel / Variante / nicht gefunden) oder null
//   answerItem(model, key, choice)    -> neues Modell ({ exercise_id, name_en, tags } oder 'skip')
//   canStart(model)                   -> true, wenn nichts mehr offen ist und mindestens eine Übung steht
//
// Prinzipien (Absprache Paul): nichts erfinden (fehlende Zahlen bleiben leer/grau), nichts still raten (Rückfrage zum
// Antippen statt Tippen), nichts still neu anlegen. Die Modelle sind unveränderlich: jede Antwort liefert eine Kopie.
import { parseWorkoutText } from './parse.js'
import { resolveParsedWorkout } from './matchExercise.js'

const HINT_REASONS = ['ignored_rest', 'unit_unsupported', 'ambiguous_numbers', 'merged_numbers', 'out_of_range', 'input_truncated']

const defaultFormatName = (name) => String(name || '')

function toItem(exercise, index, formatName) {
  const resolution = exercise.resolution || {}
  const matched = resolution.status === 'matched'
  return {
    key: `ex-${index}`,
    rawText: exercise.raw_text,
    status: resolution.status || 'not_found', // matched | ambiguous | not_found | skipped
    answered: false,
    exerciseId: matched ? resolution.exercise_id : null,
    nameEn: matched ? resolution.name_en : '',
    display: matched ? formatName(resolution.name_en) : exercise.raw_text,
    tags: matched ? resolution.tags || [] : [],
    assumedVariant: matched && (resolution.assumed || []).includes('variant'),
    alternatives: matched ? resolution.alternatives || [] : [],
    candidates: resolution.candidates || [],
    suggestions: resolution.suggestions || [],
    sets: exercise.sets,
    setsAssumed: (exercise.assumed || []).includes('sets'),
    reps: exercise.reps,
    repsRange: exercise.reps_range,
    weightKg: exercise.weight_kg,
    durationSeconds: exercise.duration_seconds
  }
}

/**
 * @param {string} text - Freitext des Nutzers
 * @param {{match: Function, goal?: string|null, formatName?: Function}} options
 */
export function buildTextWorkoutModel(text, { match, goal = null, formatName = defaultFormatName } = {}) {
  const parsed = parseWorkoutText(text)
  const resolved = resolveParsedWorkout(parsed, match)
  const session = resolved.sessions[0] || null
  const items = (session?.exercises || []).map((exercise, index) => toItem(exercise, index, formatName))

  const hints = []
  for (const entry of parsed.unresolved) {
    if (HINT_REASONS.includes(entry.reason)) hints.push({ code: entry.reason, text: entry.raw_text })
  }
  if (parsed.split || parsed.days_per_week) hints.push({ code: 'plan', text: '' })
  if (resolved.sessions.length > 1) hints.push({ code: 'extra_sessions', text: session?.label || '' })

  return {
    state: items.length ? 'ready' : 'empty',
    goal: goal || null,
    sessionLabel: session?.label || null,
    type: session?.type || null,
    typeAssumed: !session?.type,
    items,
    hints,
    notUnderstood: parsed.unresolved.filter((u) => u.reason === 'unparsed' || u.reason === 'no_name').map((u) => u.raw_text).filter(Boolean)
  }
}

/** Nächste offene Rückfrage: zuerst das Ziel (nur wenn noch nie gewählt), dann Übungen von oben nach unten. */
export function pendingQuestion(model) {
  if (!model || !model.items.length) return null
  if (!model.goal) return { kind: 'goal' }
  const item = model.items.find((it) => (it.status === 'ambiguous' || it.status === 'not_found') && !it.answered)
  return item ? { kind: item.status === 'ambiguous' ? 'variant' : 'not_found', key: item.key } : null
}

export function canStart(model) {
  return !!model && !pendingQuestion(model) && model.items.some((item) => item.status === 'matched')
}

export function setGoal(model, goal) {
  return { ...model, goal: goal || null }
}

/**
 * @param {object} choice - { exercise_id, name_en, tags } (gewählte Übung) oder 'skip' (weglassen)
 */
export function answerItem(model, key, choice, { formatName = defaultFormatName } = {}) {
  return {
    ...model,
    items: model.items.map((item) => {
      if (item.key !== key) return item
      if (choice === 'skip') return { ...item, status: 'skipped', answered: true }
      if (!choice?.exercise_id) return item
      return {
        ...item,
        status: 'matched',
        answered: true,
        exerciseId: choice.exercise_id,
        nameEn: choice.name_en,
        display: formatName(choice.name_en),
        tags: choice.tags || [],
        assumedVariant: false, // vom Nutzer gewählt
        alternatives: [],
        candidates: [],
        suggestions: []
      }
    })
  }
}

/** Zeile "Wdh./Gewicht/Zeit" für die Anzeige: Werte mit given=true hat der Nutzer genannt, die übrigen sind leer/angenommen. */
export function describeValues(item) {
  const cells = []
  cells.push({ field: 'sets', value: item.sets, given: !item.setsAssumed })
  if (item.durationSeconds != null) {
    cells.push({ field: 'duration', value: item.durationSeconds, given: true })
    return cells
  }
  if (item.reps != null) cells.push({ field: 'reps', value: item.reps, given: true })
  else if (item.repsRange) cells.push({ field: 'repsRange', value: item.repsRange, given: true })
  else cells.push({ field: 'reps', value: null, given: false })
  cells.push({ field: 'weight', value: item.weightKg, given: item.weightKg != null })
  return cells
}
