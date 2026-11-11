// Trainings-Erinnerung (Absprache Paul 11.11.2026): plant die nächste lokale iOS-Mitteilung im Voraus, weil bei
// geschlossener App kein Code läuft. Neu gerechnet wird bei jeder Änderung der Workouts oder Einstellungen und beim
// Zurückkehren in die App; ein Training vor dem Zeitpunkt verschiebt die Mitteilung, sie kommt dann nie an.
// Rechenregeln: utils/trainingNudge.js. Kein Server, keine Daten verlassen das Gerät.
import { watch } from 'vue'
import { Capacitor } from '@capacitor/core'
import { logger } from '@/utils/logger'
import { readPref, writePref, getActiveUid } from '@/utils/userScopedStorage'
import { getNotificationPermission } from '@/utils/notificationPermission'
import { planNextReminder, resolveWeeklyRhythm } from '@/utils/trainingNudge'

/** Eigene ID, getrennt von Pausentimer (940001), Warm-up (940002) und Workout-Timer (930000+). */
export const TRAINING_REMINDER_ID = 940003
const LAST_KEY = 'training-reminder-last'
const ASKED_KEY = 'training-reminder-asked'
const SYNC_DELAY_MS = 800

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

function readLast() {
  try {
    const parsed = JSON.parse(readPref(LAST_KEY) || 'null')
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
  const next = planDay ? t('trainingReminder.nextPlanDay', { day: planDay }) : t('trainingReminder.nextNoPlan')
  if (reminder.kind === 'goal') {
    return { title: t('trainingReminder.goalTitle', { count: reminder.remaining }, reminder.remaining), body: next }
  }
  return {
    title: t('trainingReminder.gapTitle'),
    body: `${t('trainingReminder.gapBody', { days: reminder.daysSince })} ${next}`
  }
}

/** Geplante Erinnerung löschen (Abmelden, Kontowechsel, Schalter aus). Wirft nie. */
export async function cancelTrainingReminder() {
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
  if (!uid || !settings?.trainingReminderEnabled) return null
  if ((await getNotificationPermission()) !== 'granted') return null
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
      previous: readLast()
    })
    if (!reminder) return null
    const { title, body } = buildReminderText(reminder, { t, planDay: planDayTitle(planInfo) })
    await plugin.schedule({
      notifications: [{ id: TRAINING_REMINDER_ID, title, body, schedule: { at: reminder.at, allowWhileIdle: true } }]
    })
    writePref(LAST_KEY, JSON.stringify({ pauseKey: reminder.pauseKey, at: reminder.at.getTime() }))
    return reminder.at
  } catch (error) {
    logger.warn('[trainingReminder] Planen fehlgeschlagen', { message: error?.message })
    return null
  }
}

/** Kurzer Fingerabdruck der Workouts: Anzahl und jüngstes Datum reichen, um Änderungen zu erkennen. */
function workoutsSignature(workouts) {
  let latest = ''
  let count = 0
  for (const w of workouts || []) {
    if (!w || w.isDraft || w._isDraft) continue
    count += 1
    const raw = String(w.date || w.updatedAt || '')
    if (raw > latest) latest = raw
  }
  return `${count}|${latest}`
}

/**
 * Einmal beim App-Start aufrufen (main.js). Plant neu, sobald sich Konto, Workouts oder Einstellungen ändern und wenn
 * die App wieder in den Vordergrund kommt. Ein Tipp auf die Mitteilung öffnet das Dashboard.
 */
export function startTrainingReminderSync({ authStore, userStore, settingsStore, i18n, router, capacitorApp }) {
  let timer = null
  const run = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      // Ohne geladene Workouts nicht rechnen: eine leere Liste hieße „noch nie trainiert“.
      if (!userStore.workoutsLoaded) return
      syncTrainingReminder({ settings: settingsStore, workouts: userStore.workouts, t: i18n.global.t })
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
    ],
    run
  )
  capacitorApp?.addListener?.('appStateChange', ({ isActive }) => { if (isActive) run() })
  getPlugin().then((plugin) => {
    plugin?.addListener?.('localNotificationActionPerformed', (event) => {
      if (event?.notification?.id === TRAINING_REMINDER_ID) router?.push?.({ name: 'dashboard' })?.catch?.(() => {})
    })
  })
  run()
}
