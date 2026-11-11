// Trainings-Erinnerung (Absprache Paul 11.11.2026): plant die nächste lokale iOS-Mitteilung im Voraus, weil bei
// geschlossener App kein Code läuft. Neu gerechnet wird bei jeder Änderung der Workouts oder Einstellungen und beim
// Zurückkehren in die App; ein Training vor dem Zeitpunkt verschiebt die Mitteilung, sie kommt dann nie an.
// Rechenregeln: utils/trainingNudge.js. Kein Server, keine Daten verlassen das Gerät.
import { watch } from 'vue'
import { Capacitor } from '@capacitor/core'
import { logger } from '@/utils/logger'
import { readPref, writePref, removePref, getActiveUid } from '@/utils/userScopedStorage'
import { getNotificationPermission } from '@/utils/notificationPermission'
import { planNextReminder, resolveWeeklyRhythm } from '@/utils/trainingNudge'

/** Eigene ID, getrennt von Pausentimer (940001), Warm-up (940002) und Workout-Timer (930000+). */
export const TRAINING_REMINDER_ID = 940003
const LAST_KEY = 'training-reminder-last'
const ASKED_KEY = 'training-reminder-asked'
const SYNC_DELAY_MS = 800
/** Länge des Plan-Tags im Text (Sperrbildschirm): eigene Bezeichnungen können lang sein. */
const PLAN_DAY_MAX = 30

async function getPlugin() {
  if (!Capacitor.isNativePlatform()) return null
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    return LocalNotifications || null
  } catch {
    return null
  }
}

/** Frage nach dem ersten Training schon beantwortet (oder ausgeblendet)? Pro Konto. */
export function wasReminderAsked() {
  return readPref(ASKED_KEY) === '1'
}

export function markReminderAsked() {
  writePref(ASKED_KEY, '1')
}

function readLast(uid) {
  try {
    const parsed = JSON.parse(readPref(LAST_KEY, uid) || 'null')
    return parsed && typeof parsed.pauseKey === 'string' && Number.isFinite(Number(parsed.at)) ? parsed : null
  } catch {
    return null
  }
}

/**
 * Titel und Text der Mitteilung. Nur Plan-Tag und Tageszahl, keine Gewichte und keine Namen (Sperrbildschirm).
 * @param {{ kind: 'gap'|'goal', daysSince: number, remaining: number }} reminder
 * @param {{ t: Function, planDay?: string }} options
 */
export function buildReminderText(reminder, { t, planDay = '' } = {}) {
  const day = String(planDay || '').trim()
  planDay = day.length > PLAN_DAY_MAX ? `${day.slice(0, PLAN_DAY_MAX - 1).trimEnd()}…` : day
  const next = planDay ? t('trainingReminder.nextPlanDay', { day: planDay }) : t('trainingReminder.nextNoPlan')
  if (reminder.kind === 'goal') {
    return { title: t('trainingReminder.goalTitle', { count: reminder.remaining }, reminder.remaining), body: next }
  }
  return {
    title: t('trainingReminder.gapTitle'),
    body: `${t('trainingReminder.gapBody', { days: reminder.daysSince })} ${next}`
  }
}

/**
 * Noch nicht zugestellte Erinnerung des Kontos vergessen, damit sie nach Abmelden/Ausschalten nicht als „schon
 * zugestellt“ zählt (höchstens eine pro Pause gilt nur für wirklich zugestellte).
 */
function forgetPending(uid, now = Date.now()) {
  const last = readLast(uid)
  if (last && Number(last.at) > now) removePref(LAST_KEY, uid)
}

/**
 * Geplante Erinnerung löschen (Abmelden, Kontowechsel). Wirft nie.
 * @param {{ forgetFor?: string }} [options] Konto, dessen noch offene Erinnerung vergessen wird
 */
export async function cancelTrainingReminder({ forgetFor = '' } = {}) {
  if (forgetFor) forgetPending(forgetFor)
  const plugin = await getPlugin()
  if (!plugin) return
  try {
    await plugin.cancel({ notifications: [{ id: TRAINING_REMINDER_ID }] })
  } catch (error) {
    logger.warn('[trainingReminder] Löschen fehlgeschlagen', { message: error?.message })
  }
}

/**
 * Nächste Erinnerung neu planen. Wirft nie.
 * @param {{ settings: object, workouts: Array, t: Function, now?: Date }} p
 * @returns {Promise<Date|null>} geplanter Zeitpunkt oder null
 */
export async function syncTrainingReminder({ settings, workouts, t, now = new Date() }) {
  const plugin = await getPlugin()
  if (!plugin) return null
  await cancelTrainingReminder()
  const uid = getActiveUid()
  if (!uid) return null
  if (!settings?.trainingReminderEnabled) {
    forgetPending(uid, now.getTime())
    return null
  }
  if ((await getNotificationPermission()) !== 'granted') {
    // Gelöscht, bevor sie kommen konnte: zählt nicht als zugestellt.
    forgetPending(uid, now.getTime())
    return null
  }
  try {
    // Erst hier laden: planProgress zieht die Plan-API nach sich, Abmelden/Kontowechsel brauchen nur cancelTrainingReminder.
    const { getTodayPlanInfo, planDayTitle } = await import('@/utils/planProgress')
    const planInfo = getTodayPlanInfo(uid)
    const rhythm = resolveWeeklyRhythm({
      explicitGoal: settings.hasExplicitWeeklyGoal ? settings.weeklyGoal : null,
      planDays: planInfo?.plan?.days?.length || 0,
      workouts,
      now
    })
    const reminder = planNextReminder({
      workouts,
      now,
      perWeek: rhythm?.perWeek ?? null,
      time: settings.trainingReminderTime,
      previous: readLast(uid)
    })
    if (!reminder) return null
    const { title, body } = buildReminderText(reminder, { t, planDay: planDayTitle(planInfo) })
    // Konto inzwischen gewechselt (Abmelden während der Wartezeiten oben)? Dann nichts mit fremdem Text planen.
    if (getActiveUid() !== uid) return null
    await plugin.schedule({
      notifications: [{ id: TRAINING_REMINDER_ID, title, body, schedule: { at: reminder.at, allowWhileIdle: true } }]
    })
    writePref(LAST_KEY, JSON.stringify({ pauseKey: reminder.pauseKey, at: reminder.at.getTime() }), uid)
    return reminder.at
  } catch (error) {
    logger.warn('[trainingReminder] Planen fehlgeschlagen', { message: error?.message })
    return null
  }
}

/**
 * Kurzer Fingerabdruck der Workouts: Anzahl und Summe aller Zeitpunkte. Ändert sich das Datum irgendeines Trainings
 * (auch eines älteren, z. B. in die laufende Woche verschoben), ändert sich die Summe.
 */
export function workoutsSignature(workouts) {
  let count = 0
  let sum = 0
  for (const w of workouts || []) {
    if (!w || w.isDraft || w._isDraft) continue
    const time = new Date(w.date || w.updatedAt || 0).getTime()
    if (!Number.isFinite(time)) continue
    count += 1
    sum += time
  }
  return `${count}|${sum}`
}

/**
 * Einmal beim App-Start aufrufen (main.js). Plant neu, sobald sich Konto, Workouts oder Einstellungen ändern und wenn
 * die App wieder in den Vordergrund kommt. Ein Tipp auf die Mitteilung öffnet das Dashboard.
 */
export function startTrainingReminderSync({ authStore, userStore, settingsStore, i18n, onTap, capacitorApp }) {
  let timer = null
  // Nacheinander statt parallel: ein langsamer älterer Lauf darf nach einem neueren nicht mehr seinen Stand planen.
  // Jeder Lauf liest Einstellungen und Workouts erst, wenn er dran ist.
  let queue = Promise.resolve()
  const run = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      queue = queue.then(() => {
        // Ohne geladene Workouts nicht rechnen: eine leere Liste hieße „noch nie trainiert“.
        if (!userStore.workoutsLoaded) return null
        return syncTrainingReminder({ settings: settingsStore, workouts: userStore.workouts, t: i18n.global.t })
      }).catch(() => null)
    }, SYNC_DELAY_MS)
  }
  watch(
    () => [
      authStore?.uid || '',
      userStore.workoutsLoaded,
      workoutsSignature(userStore.workouts),
      settingsStore.trainingReminderEnabled,
      settingsStore.trainingReminderTime,
      settingsStore.weeklyGoal,
      settingsStore.hasExplicitWeeklyGoal,
      i18n.global.locale.value
    ].join('|'),
    // Als Text vergleichen: ein neues Array bei jedem Lesen würde bei jeder Berührung neu planen.
    run
  )
  capacitorApp?.addListener?.('appStateChange', ({ isActive }) => { if (isActive) run() })
  getPlugin().then((plugin) => {
    plugin?.addListener?.('localNotificationActionPerformed', (event) => {
      // Das Plugin hält das Ereignis bis zum ersten Listener zurück (auch beim Kaltstart); Navigation macht main.js.
      if (event?.notification?.id === TRAINING_REMINDER_ID) onTap?.()
    })
  })
  run()
}
