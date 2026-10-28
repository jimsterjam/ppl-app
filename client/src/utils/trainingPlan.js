// Trainingsplan (Absprache Paul 28.10.): geordnete Reihe von Trainingstagen. Ein Tag enthält seine Übungen selbst
// (Pläne aus Vorlagen, getrennt von den Favoriten); ältere Pläne und Tage, die Paul selbst aus Favoriten hinzufügt,
// verweisen stattdessen auf einen Favoriten (utils/workoutFavorites.js). Der Plan richtet sich nach den Trainings, nicht nach dem Kalender ("Rotation"):
// Nach dem Speichern eines Plan-Trainings rückt er zum Tag NACH dem trainierten vor, nach dem letzten Tag wieder zum
// ersten. Reine Funktionen ohne Speicher/Netz - Speicherung und Server-Abgleich: utils/trainingPlanStorage.js.
//
// Plan: { id, name, level, templateId, days: [{ id, label, type, goal, exercises: [{ exerciseId, name, muscleGroup, sets }],
//         favoriteId, lastDoneAt }], activeDayIndex, active, createdAt, updatedAt }

export const PLAN_LIMITS = Object.freeze({
  maxPlans: 3, maxDays: 7, maxName: 40, maxLabel: 24, maxExercises: 12, maxSets: 10, maxExerciseName: 80, maxMuscleGroup: 40
})
export const PLAN_LEVELS = Object.freeze(['beginner', 'advanced'])
const DAY_TYPES = ['push', 'pull', 'legs', 'fullbody']
const GOALS = ['hypertrophy', 'strength']

// eslint-disable-next-line no-control-regex -- Steuerzeichen werden hier bewusst entfernt.
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001f\\u007f\\u2028\\u2029]+', 'g')

function nowIso() {
  return new Date().toISOString()
}

/** Einzeiliger Freitext: Steuerzeichen und < > raus, Leerraum zusammenfassen, auf `max` Zeichen kürzen. */
export function cleanPlanText(value, max) {
  const text = String(value ?? '').replace(CONTROL_CHARS, ' ').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim()
  const chars = Array.from(text)
  return chars.length > max ? chars.slice(0, max).join('').trim() : text
}

function randomPart() {
  return Math.random().toString(36).slice(2, 8)
}

/** Plan-/Tag-ID aus Route oder Workout: nur eine gültige ID (gleiche Regel wie am Server), sonst null. */
export function sanitizePlanRef(value) {
  const id = String(value ?? '').trim()
  return id && id.length <= 64 && /^[A-Za-z0-9_.:-]+$/.test(id) ? id : null
}

export function makePlanId() {
  return `plan_${Date.now()}_${randomPart()}`
}

export function makeDayId() {
  return `day_${Date.now()}_${randomPart()}`
}

function cleanDate(value) {
  if (!value) return null
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? new Date(time).toISOString() : null
}

export function normalizePlanLevel(value) {
  return PLAN_LEVELS.includes(value) ? value : 'beginner'
}

/** Übungen eines Plan-Tages: nur bekannte Felder, Sätze 1-10, höchstens 12 Übungen. */
export function normalizePlanExercises(value) {
  const out = []
  for (const raw of (Array.isArray(value) ? value : []).slice(0, PLAN_LIMITS.maxExercises)) {
    if (!raw || typeof raw !== 'object') continue
    const name = cleanPlanText(raw.name, PLAN_LIMITS.maxExerciseName)
    const exerciseId = sanitizePlanRef(raw.exerciseId)
    if (!name || !exerciseId) continue
    const sets = Number.parseInt(raw.sets, 10)
    out.push({
      exerciseId,
      name,
      muscleGroup: cleanPlanText(raw.muscleGroup, PLAN_LIMITS.maxMuscleGroup),
      sets: Number.isInteger(sets) ? Math.min(PLAN_LIMITS.maxSets, Math.max(1, sets)) : 3
    })
  }
  return out
}

function normalizeDay(raw) {
  if (!raw || typeof raw !== 'object') return null
  const favoriteId = String(raw.favoriteId ?? '').trim()
  const exercises = normalizePlanExercises(raw.exercises)
  // Ein Tag braucht Übungen im Plan oder (ältere Pläne) einen Favoriten.
  if (!favoriteId && !exercises.length) return null
  return {
    id: String(raw.id || '').trim() || makeDayId(),
    label: cleanPlanText(raw.label, PLAN_LIMITS.maxLabel),
    favoriteId,
    type: DAY_TYPES.includes(raw.type) ? raw.type : 'fullbody',
    goal: GOALS.includes(raw.goal) ? raw.goal : 'hypertrophy',
    exercises,
    lastDoneAt: cleanDate(raw.lastDoneAt)
  }
}

/** Prüft und bereinigt einen Plan (z. B. aus dem Speicher oder vom Server). Ungültig (kein Name/keine Tage) -> null. */
export function normalizePlan(raw, now = nowIso()) {
  if (!raw || typeof raw !== 'object') return null
  const name = cleanPlanText(raw.name, PLAN_LIMITS.maxName)
  if (!name) return null
  const seen = new Set()
  const days = (Array.isArray(raw.days) ? raw.days : [])
    .map(normalizeDay)
    .filter((day) => {
      if (!day || seen.has(day.id)) return false
      seen.add(day.id)
      return true
    })
    .slice(0, PLAN_LIMITS.maxDays)
  if (!days.length) return null
  const index = Number.parseInt(raw.activeDayIndex, 10)
  return {
    id: String(raw.id || '').trim() || makePlanId(),
    name,
    level: normalizePlanLevel(raw.level),
    templateId: sanitizePlanRef(raw.templateId)?.slice(0, 24) || '',
    days,
    activeDayIndex: Number.isInteger(index) && index >= 0 && index < days.length ? index : 0,
    active: raw.active === true,
    createdAt: cleanDate(raw.createdAt) || now,
    updatedAt: cleanDate(raw.updatedAt) || cleanDate(raw.createdAt) || now
  }
}

/** Neuer Plan; `days` = [{ exercises, type, goal, label? }] oder [{ favoriteId, label? }]. */
export function createPlan({ name, days, active = false, level, templateId } = {}, now = nowIso()) {
  return normalizePlan({ name, days, active, level, templateId, createdAt: now, updatedAt: now }, now)
}

/** Übung in einem Plan-Tag ersetzen (Übung wechseln, „auch im Plan-Tag ändern“). Die Satzanzahl bleibt. */
export function replaceDayExercise(plan, dayId, oldExercise, newExercise, now = nowIso()) {
  const index = getDayIndex(plan, dayId)
  if (index < 0) return plan
  const day = plan.days[index]
  const position = day.exercises.findIndex((ex) => (oldExercise?.exerciseId && ex.exerciseId === String(oldExercise.exerciseId))
    || ex.name.toLowerCase() === String(oldExercise?.name || '').trim().toLowerCase())
  if (position < 0) return plan
  const next = normalizePlanExercises([{ ...newExercise, sets: day.exercises[position].sets }])
  if (!next.length) return plan
  const exercises = day.exercises.map((ex, i) => (i === position ? next[0] : ex))
  return touch(plan, { days: plan.days.map((d, i) => (i === index ? { ...d, exercises } : d)) }, now)
}

function touch(plan, changes, now) {
  return { ...plan, ...changes, updatedAt: now }
}

export function getActiveDay(plan) {
  return plan?.days?.[plan.activeDayIndex] || null
}

export function getDayIndex(plan, dayId) {
  return (plan?.days || []).findIndex((day) => day.id === dayId)
}

/** Von Hand einen anderen Tag wählen ("Anderen Tag wählen"). */
export function selectDay(plan, dayId, now = nowIso()) {
  const index = getDayIndex(plan, dayId)
  return index < 0 ? plan : touch(plan, { activeDayIndex: index }, now)
}

/** Aktuellen Tag überspringen: weiter zum nächsten, ohne ihn als trainiert zu merken. */
export function skipActiveDay(plan, now = nowIso()) {
  return touch(plan, { activeDayIndex: (plan.activeDayIndex + 1) % plan.days.length }, now)
}

/**
 * Ein Plan-Training wurde gespeichert: Tag als trainiert merken, der Plan rückt zum Tag danach vor.
 * Unbekannter Tag (z. B. inzwischen gelöscht) -> Plan bleibt unverändert.
 */
export function completeDay(plan, dayId, doneAt = nowIso(), now = nowIso()) {
  const index = getDayIndex(plan, dayId)
  if (index < 0) return plan
  const days = plan.days.map((day, i) => (i === index ? { ...day, lastDoneAt: cleanDate(doneAt) || now } : day))
  return touch(plan, { days, activeDayIndex: (index + 1) % days.length }, now)
}

/** Tag anhängen; `null`, wenn das Tageslimit erreicht oder der Favorit fehlt. */
export function addDay(plan, { favoriteId, label = '', ...rest } = {}, now = nowIso()) {
  if (plan.days.length >= PLAN_LIMITS.maxDays) return null
  const day = normalizeDay({ ...rest, favoriteId, label })
  if (!day) return null
  return touch(plan, { days: [...plan.days, day] }, now)
}

/** Tag entfernen; `null`, wenn dadurch kein Tag mehr übrig bliebe (Aufrufer löscht dann den ganzen Plan). */
export function removeDay(plan, dayId, now = nowIso()) {
  const index = getDayIndex(plan, dayId)
  if (index < 0) return plan
  if (plan.days.length <= 1) return null
  const days = plan.days.filter((day) => day.id !== dayId)
  let active = plan.activeDayIndex
  if (index < active) active -= 1
  return touch(plan, { days, activeDayIndex: active % days.length }, now)
}

/** Tag um eine Stelle verschieben (direction -1 = hoch, +1 = runter); der aktuelle Tag bleibt derselbe Tag. */
export function moveDay(plan, dayId, direction, now = nowIso()) {
  const from = getDayIndex(plan, dayId)
  const to = from + (direction < 0 ? -1 : 1)
  if (from < 0 || to < 0 || to >= plan.days.length) return plan
  const activeId = getActiveDay(plan)?.id
  const days = [...plan.days]
  ;[days[from], days[to]] = [days[to], days[from]]
  return touch(plan, { days, activeDayIndex: Math.max(0, days.findIndex((day) => day.id === activeId)) }, now)
}

export function renamePlan(plan, name, now = nowIso()) {
  const cleaned = cleanPlanText(name, PLAN_LIMITS.maxName)
  return cleaned ? touch(plan, { name: cleaned }, now) : plan
}

export function renameDay(plan, dayId, label, now = nowIso()) {
  if (getDayIndex(plan, dayId) < 0) return plan
  const days = plan.days.map((day) => (day.id === dayId ? { ...day, label: cleanPlanText(label, PLAN_LIMITS.maxLabel) } : day))
  return touch(plan, { days }, now)
}

/** Alle Pläne mit Tagen, die auf diesen Favoriten verweisen (für die Rückfrage vor dem Löschen eines Favoriten). */
export function findPlansUsingFavorite(plans, favoriteId) {
  return (plans || []).filter((plan) => plan.days.some((day) => day.favoriteId === favoriteId))
}

/** Favorit gelöscht: seine Tage aus dem Plan nehmen. `null`, wenn der Plan dadurch leer wäre. */
export function removeFavoriteFromPlan(plan, favoriteId, now = nowIso()) {
  const rest = plan.days.filter((day) => day.favoriteId !== favoriteId)
  if (rest.length === plan.days.length) return plan
  if (!rest.length) return null
  const activeId = getActiveDay(plan)?.id
  const found = rest.findIndex((day) => day.id === activeId)
  // War der aktuelle Tag betroffen, übernimmt der Tag, der an seiner Stelle nachrückt.
  const oldIndex = plan.activeDayIndex
  const removedBefore = plan.days.slice(0, oldIndex).filter((day) => day.favoriteId === favoriteId).length
  const index = found >= 0 ? found : Math.min(oldIndex - removedBefore, rest.length - 1)
  return touch(plan, { days: rest, activeDayIndex: Math.max(0, index) }, now)
}

/** Genau ein Plan ist aktiv (der zuletzt geänderte, falls mehrere), bei keinem der zuletzt geänderte Plan. */
export function ensureSingleActive(plans) {
  const list = Array.isArray(plans) ? plans : []
  if (!list.length) return []
  const byRecent = [...list].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
  const activeId = (byRecent.find((plan) => plan.active) || byRecent[0]).id
  return list.map((plan) => (plan.active === (plan.id === activeId) ? plan : { ...plan, active: plan.id === activeId }))
}

export function setActivePlan(plans, planId, now = nowIso()) {
  if (!(plans || []).some((plan) => plan.id === planId)) return plans
  return plans.map((plan) => {
    const active = plan.id === planId
    return plan.active === active ? plan : touch(plan, { active }, now)
  })
}

export function getActivePlan(plans) {
  return (plans || []).find((plan) => plan.active) || null
}

export function canCreatePlan(plans) {
  return (plans || []).length < PLAN_LIMITS.maxPlans
}

/** Lokale und Server-Pläne zusammenführen: je Plan gewinnt der zuletzt geänderte Stand, höchstens 3 Pläne bleiben. */
export function mergePlans(local, remote) {
  const byId = new Map()
  for (const raw of [...(local || []), ...(remote || [])]) {
    const plan = normalizePlan(raw)
    if (!plan) continue
    const existing = byId.get(plan.id)
    if (!existing || new Date(plan.updatedAt) > new Date(existing.updatedAt)) byId.set(plan.id, plan)
  }
  const newestFirst = [...byId.values()].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
  return ensureSingleActive(newestFirst.slice(0, PLAN_LIMITS.maxPlans))
}
