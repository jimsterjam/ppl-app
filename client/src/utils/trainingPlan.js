// Trainingsplan (Absprache Paul 28.10.): geordnete Reihe von Trainingstagen, jeder Tag verweist auf einen Favoriten
// (utils/workoutFavorites.js). Der Plan richtet sich nach den Trainings, nicht nach dem Kalender ("Rotation"):
// Nach dem Speichern eines Plan-Trainings rückt er zum Tag NACH dem trainierten vor, nach dem letzten Tag wieder zum
// ersten. Reine Funktionen ohne Speicher/Netz - Speicherung und Server-Abgleich: utils/trainingPlanStorage.js.
//
// Plan: { id, name, days: [{ id, label, favoriteId, lastDoneAt }], activeDayIndex, active, createdAt, updatedAt }

export const PLAN_LIMITS = Object.freeze({ maxPlans: 3, maxDays: 7, maxName: 40, maxLabel: 24 })

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

function normalizeDay(raw) {
  if (!raw || typeof raw !== 'object') return null
  const favoriteId = String(raw.favoriteId ?? '').trim()
  if (!favoriteId) return null
  return {
    id: String(raw.id || '').trim() || makeDayId(),
    label: cleanPlanText(raw.label, PLAN_LIMITS.maxLabel),
    favoriteId,
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
    days,
    activeDayIndex: Number.isInteger(index) && index >= 0 && index < days.length ? index : 0,
    active: raw.active === true,
    createdAt: cleanDate(raw.createdAt) || now,
    updatedAt: cleanDate(raw.updatedAt) || cleanDate(raw.createdAt) || now
  }
}

/** Neuer Plan; `days` = [{ favoriteId, label? }]. */
export function createPlan({ name, days, active = false } = {}, now = nowIso()) {
  return normalizePlan({ name, days, active, createdAt: now, updatedAt: now }, now)
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
export function addDay(plan, { favoriteId, label = '' } = {}, now = nowIso()) {
  if (plan.days.length >= PLAN_LIMITS.maxDays) return null
  const day = normalizeDay({ favoriteId, label })
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
