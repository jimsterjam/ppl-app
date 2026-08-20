<template>
  <div class="stats-view">
    <HeaderBar :title="t('stats.overview')" />

    <!-- Post-Workout AI Feedback Summary -->
    <PostWorkoutSummary
      v-if="postWorkoutId"
      :workout-id="postWorkoutId"
      @close="postWorkoutId = null"
    />

    <main class="stats-content">
      <section class="section">
        <RecentWorkouts :workouts="recentWorkoutsSource" :show-view-all="false" @delete="handleDeleteRecentWorkout" />
      </section>

      <section class="section">
        <AIFeedbackHistory />
      </section>

      <section v-if="!isPro" class="pro-banner">
        <div>
          <p class="eyebrow">Pro Test</p>
          <h2 class="banner-title">14 Tage kostenlos testen</h2>
          <p class="banner-sub">Schalte Langzeit-Analysen frei und verfolge echte Fortschritte.</p>
        </div>
        <button class="cta-ghost" type="button" @click="openUpgrade('general')">Pro freischalten</button>
      </section>


      <div v-if="showLoading" class="loading-section">
        <div class="spinner"></div>
        <p>{{ t('stats.loading') }}</p>
      </div>

      <EmptyState
        v-else-if="!hasCoreData"
        icon="📈"
        :title="t('stats.emptyTitle')"
        :message="dataStatusMessage || t('stats.emptyMsg')"
      />

      <template v-else>
        <section class="section">
          <ProgressThreeMonthsSection :workouts="statsWorkouts" />
        </section>

        <section class="section">
          <WorkoutComparisonSection :workouts="statsWorkouts" />
        </section>

        <section v-if="showMilestoneUpgrade" class="panel milestone">
          <div>
            <h3>Starker Lauf!</h3>
            <p>Du hast bereits {{ totalSessions }} Trainings im Blick. Schalte Pro frei, um Langzeit-Analysen zu sehen.</p>
          </div>
          <button class="cta-inline" type="button" @click="openUpgrade('general')">Pro freischalten</button>
        </section>
        <section class="section">
          <div class="section-head">
            <h3>Basis-Statistiken</h3>
            <span class="section-sub">Letzte 30 Tage im Fokus</span>
          </div>

          <div class="base-grid">
            <div class="panel chart-card">
              <div class="card-head">
                <h4>Aktivitätstage</h4>
                <div class="calendar-head-right">
                  <span class="badge">Basis</span>
                  <div class="calendar-month-nav" aria-label="Monatsnavigation">
                    <button type="button" class="calendar-month-btn" aria-label="Vorheriger Monat" @click="goToPreviousMonth">‹</button>
                    <span class="calendar-month-label">{{ calendarMonthLabel }}</span>
                    <button type="button" class="calendar-month-btn" aria-label="Nächster Monat" @click="goToNextMonth">›</button>
                  </div>
                </div>
              </div>
              <div
                class="calendar-shell"
                @touchstart.passive="onCalendarTouchStart"
                @touchend.passive="onCalendarTouchEnd"
              >
                <div class="calendar-weekdays" role="row">
                  <span v-for="label in calendarWeekdayLabels" :key="label" class="calendar-weekday">{{ label }}</span>
                </div>
                <div
                  class="calendar-grid"
                  role="grid"
                >
                  <button
                    v-for="day in calendarDays"
                  :key="day.key"
                  type="button"
                  class="calendar-cell"
                  :class="{
                    'is-current-month': day.isCurrentMonth,
                    'is-outside-month': !day.isCurrentMonth,
                    active: day.active,
                    clickable: day.active,
                    today: day.isToday
                  }"
                  @click="openDayOverlay(day)"
                >
                    <span class="calendar-day-number">{{ day.label }}</span>
                    <span v-if="day.active" class="calendar-day-marker" aria-hidden="true"></span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

      </template>
    </main>

    <UpgradeModal
      :show="showUpgradeModal"
      limit-type="general"
      @close="showUpgradeModal = false"
      @continue-free="showUpgradeModal = false"
      @upgraded="handleUpgraded"
    />

    <AppModal
      v-model="showDeleteModal"
      :title="t('recent.deleteTitle')"
      :message="deleteModalMessage"
      :confirm-text="deletingRecentWorkout ? t('common.loading') : t('common.delete')"
      :cancel-text="t('common.cancel')"
      type="warning"
      :persistent="deletingRecentWorkout"
      :close-on-confirm="false"
      @confirm="confirmDeleteRecentWorkout"
    />

    <AppModal
      v-model="showDeleteErrorModal"
      :title="t('recent.deleteTitle')"
      :message="t('recent.deleteFailed')"
      :confirm-text="t('common.confirm')"
      :show-cancel="false"
      type="warning"
    />

    <!-- Kalender-Tag Overlay -->
    <Transition name="modal">
      <div v-if="calendarDayOverlay" class="day-overlay-backdrop" @click.self="closeDayOverlay">
        <div class="day-overlay-panel glass">
          <div class="day-overlay-header">
            <h4 class="day-overlay-title">{{ formatDayOverlayDate(calendarDayOverlay.key) }}</h4>
            <button class="day-overlay-close" type="button" @click="closeDayOverlay" aria-label="Schließen">&times;</button>
          </div>
          <div class="day-overlay-body">
            <div
              v-for="workout in calendarDayOverlay.workouts"
              :key="workout._id || workout.id"
              class="day-overlay-workout"
            >
              <div class="day-overlay-workout-name">{{ workout.name || 'Workout' }}</div>
              <div
                v-for="ex in (workout.exercises || []).slice(0, 8)"
                :key="ex._id || ex.name"
                class="day-overlay-exercise"
              >
                <span class="day-overlay-ex-name">{{ ex.name }}</span>
                <div v-if="getWorkingSetsStat(ex).length" class="day-overlay-sets">
                  <span
                    v-for="(set, si) in getWorkingSetsStat(ex)"
                    :key="si"
                    class="day-overlay-set"
                  >{{ si + 1 }}. <span v-if="set.weight">{{ set.weight }}kg</span><span v-if="set.reps"> &times; {{ set.reps }}</span></span>
                </div>
                <div v-else-if="ex.sets || ex.reps || ex.weight" class="day-overlay-sets">
                  <span class="day-overlay-set">{{ ex.sets ? ex.sets + ' Sätze' : '' }}{{ ex.reps ? ' · ' + ex.reps + ' Wdh' : '' }}{{ ex.weight ? ' · ' + ex.weight + 'kg' : '' }}</span>
                </div>
              </div>
              <p v-if="(workout.exercises || []).length > 8" class="day-overlay-more">+{{ workout.exercises.length - 8 }} weitere Übungen</p>
            </div>
          </div>
        </div>
      </div>
    </Transition>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useFirebaseAuth } from '@/utils/firebaseAuth'
import { useUserStore } from '@/stores/userStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useAuthStore } from '@/stores/authStore'
import { useSubscriptionStore } from '@/stores/subscriptionStore'
import HeaderBar from '@/components/HeaderBar.vue'
import EmptyState from '@/components/EmptyState.vue'
import AppModal from '@/components/AppModal.vue'
import UpgradeModal from '@/components/UpgradeModal.vue'
import RecentWorkouts from '@/components/RecentWorkouts.vue'
import AIFeedbackHistory from '@/components/AIFeedbackHistory.vue'
import ProgressThreeMonthsSection from '@/components/stats/ProgressThreeMonthsSection.vue'
import WorkoutComparisonSection from '@/components/stats/WorkoutComparisonSection.vue'
import PostWorkoutSummary from '@/components/PostWorkoutSummary.vue'
import { logger } from '@/utils/logger'
import { isOnline, getAllWorkoutsOffline, deleteWorkoutOffline, saveWorkoutOffline, OFFLINE_WORKOUTS_UPDATED_EVENT } from '@/utils/offlineStorage'
import { resolveWorkoutNotes } from '@/utils/workoutNotes'
import { deleteWorkout as deleteWorkoutApi } from '@/api/workouts'
import { deleteWorkoutFromStats, getWorkoutIdentifier } from '@/utils/workoutDeletion'

const { t, locale } = useI18n()
const route = useRoute()
const store = useUserStore()
const settings = useSettingsStore()
const { getIdToken, onAuthStateChanged, getCurrentUser } = useFirebaseAuth()
const authStore = useAuthStore()
const subscriptionStore = useSubscriptionStore()

const loading = ref(true)
const offlineWorkouts = ref([])
const authToken = ref(null)
const postWorkoutId = ref(null)

const statsWorkouts = computed(() => {
  const offlineList = Array.isArray(offlineWorkouts.value) ? offlineWorkouts.value : []
  const storeList = Array.isArray(store.workouts) ? store.workouts : []
  const list = [...offlineList, ...storeList]
  const normalized = list
    .filter(item => !(item?._isDraft || item?.isDraft))
    .map(item => ({
      ...item,
      notes: resolveWorkoutNotes(item)
    }))
  const deduped = new Map()
  normalized.forEach((item) => {
    const key = String(item?._id || item?.id || item?.workoutId || '').trim()
      || `${String(item?.date || '')}|${String(item?.name || '').toLowerCase()}|${String(item?.type || '').toLowerCase()}`
    const existing = deduped.get(key)
    if (!existing) {
      deduped.set(key, item)
      return
    }
    const existingTs = new Date(existing?.updatedAt || existing?.date || existing?.createdAt || 0).getTime()
    const nextTs = new Date(item?.updatedAt || item?.date || item?.createdAt || 0).getTime()
    if (nextTs >= existingTs) deduped.set(key, item)
  })
  return Array.from(deduped.values())
    .sort((a, b) => new Date(b.updatedAt || b.date || b.createdAt || 0) - new Date(a.updatedAt || a.date || a.createdAt || 0))
})

const isDe = computed(() => (locale.value || 'de').toLowerCase().startsWith('de'))

const statsLoading = computed(() => store.loadingStats)
const progressStats = computed(() => store.stats)
const derivedStats = computed(() => {
  if (!statsWorkouts.value.length) return null
  try {
    return store.buildOfflineStatsFromWorkouts(statsWorkouts.value)
  } catch (error) {
    logger.warn('[Stats] Fallback-Stats konnten nicht berechnet werden', error)
    return null
  }
})
const activeStats = computed(() => {
  const api = progressStats.value
  const derived = derivedStats.value
  if (!api) return derived || null
  if (!derived) return api
  // Offline-first: lokale IndexedDB-Daten gewinnen bei gleicher oder höherer Session-Zahl
  // (lokale Daten sind immer aktueller als der API-Cache)
  const apiSessions = Number(api?.kpis?.sessions || 0)
  const derivedSessions = Number(derived?.kpis?.sessions || 0)
  return derivedSessions >= apiSessions ? derived : api
})
const statsWeeks = computed(() => Array.isArray(activeStats.value?.weeks) ? activeStats.value.weeks : [])
const weeklyGoal = computed(() => Number(settings.weeklyGoal) || 0)
const isPro = computed(() => true)
const analyticsLocked = computed(() => false)
const showUpgradeModal = ref(false)
const selectedRangeDays = ref(30)
const showDeleteModal = ref(false)
const showDeleteErrorModal = ref(false)
const pendingDeleteWorkout = ref(null)
const deletingRecentWorkout = ref(false)

const deleteModalMessage = computed(() => {
  const workoutTitle = String(pendingDeleteWorkout.value?.name || '').trim() || t('recent.title')
  return t('recent.deleteConfirm', { name: workoutTitle })
})

const dataStatusMessage = computed(() => {
  if (loading.value) return ''
  const uid = resolveActiveUid(authToken.value)
  if (!uid && !authStore.isOfflineSessionValid) return 'Anmeldung erforderlich — bitte einloggen, um deine Workouts zu sehen.'
  return ''
})

function resolveActiveUid(token) {
  return String(
    authStore.uid
    || store.user?.uid
    || getCurrentUser?.()?.uid
    || _parseUidFromToken(token)
    || ''
  ).trim()
}

function _parseUidFromToken(token) {
  const raw = String(token || '').trim()
  if (!raw) return ''
  try {
    const parts = raw.split('.')
    if (parts.length < 2) return ''
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const decoded = atob(payload.padEnd(payload.length + (4 - payload.length % 4) % 4, '='))
    return String(JSON.parse(decoded)?.user_id || JSON.parse(decoded)?.uid || '').trim()
  } catch { return '' }
}

const statusLabels = computed(() => ({
  good: t('stats.diagnostics.status.good'),
  caution: t('stats.diagnostics.status.caution'),
  risk: t('stats.diagnostics.status.risk')
}))
const severityScore = { good: 0, caution: 1, risk: 2 }

const diagnosticsWindowSize = 4
const MS_PER_DAY = 24 * 60 * 60 * 1000

const hasStatsWindow = computed(() => statsWeeks.value.length > 0)
const hasCoreData = computed(() => hasStatsWindow.value || statsWorkouts.value.length > 0)
// RecentWorkouts begrenzt selbst auf die letzten 7 Eintraege.
const recentWorkoutsSource = computed(() => statsWorkouts.value)
const showLoading = computed(() => (loading.value || statsLoading.value) && !hasCoreData.value)
const showMilestoneUpgrade = computed(() => false)

const rangeOptions = computed(() => [
  { label: '30 Tage', days: 30, proOnly: false },
  { label: '3 Monate', days: 90, proOnly: false },
  { label: '6 Monate', days: 180, proOnly: false },
  { label: '12 Monate', days: 365, proOnly: false }
])

const totalSessions = computed(() => {
  if (activeStats.value?.kpis?.sessions != null) return Math.round(activeStats.value.kpis.sessions)
  return statsWorkouts.value.length
})

const avgSessionsDisplay = computed(() => {
  if (activeStats.value?.kpis?.avgSessionsPerWeek != null) {
    return Number(activeStats.value.kpis.avgSessionsPerWeek || 0).toFixed(1)
  }
  const sessions = totalSessions.value
  const weeks = Math.max(1, Math.ceil(selectedRangeDays.value / 7))
  return (sessions / weeks).toFixed(1)
})

const totalVolume = computed(() => {
  if (statsWeeks.value.length) {
    return statsWeeks.value.reduce((sum, week) => sum + (Number(week.totalVolume) || 0), 0)
  }
  return statsWorkouts.value.reduce((sum, w) => sum + calcWorkoutVolume(w), 0)
})

const totalVolumeLabel = computed(() => formatKg(totalVolume.value))

const personalBest = computed(() => {
  let best = 0
  statsWorkouts.value.forEach((workout) => {
    ;(workout.exercises || []).forEach((ex) => {
      if (Array.isArray(ex.setDetails) && ex.setDetails.length) {
        ex.setDetails.forEach((set) => {
          if (set?.isWarmup) return // Warmup-Gewichte nicht als Bestleistung werten
          const weight = Number(set?.weight) || 0
          if (weight > best) best = weight
        })
      } else {
        const weight = Number(ex?.weight) || 0
        if (weight > best) best = weight
      }
    })
  })
  return best
})

const personalBestLabel = computed(() => (personalBest.value > 0 ? `${personalBest.value} kg` : '—'))

const now = new Date()
const calendarViewDate = ref(new Date(now.getFullYear(), now.getMonth(), 1))
const calendarTouchStartX = ref(null)
const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())

const calendarWeekdayLabels = computed(() => (
  isDe.value
    ? ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
))

const calendarMonthLabel = computed(() => {
  const fmt = new Intl.DateTimeFormat(isDe.value ? 'de-DE' : 'en-US', {
    month: 'long',
    year: 'numeric'
  })
  return fmt.format(calendarViewDate.value)
})

function goToPreviousMonth() {
  const d = calendarViewDate.value
  calendarViewDate.value = new Date(d.getFullYear(), d.getMonth() - 1, 1)
}

function goToNextMonth() {
  const d = calendarViewDate.value
  calendarViewDate.value = new Date(d.getFullYear(), d.getMonth() + 1, 1)
}

function onCalendarTouchStart(event) {
  const x = event?.changedTouches?.[0]?.clientX
  calendarTouchStartX.value = Number.isFinite(x) ? x : null
}

function onCalendarTouchEnd(event) {
  const startX = calendarTouchStartX.value
  const endX = event?.changedTouches?.[0]?.clientX
  calendarTouchStartX.value = null
  if (!Number.isFinite(startX) || !Number.isFinite(endX)) return
  const deltaX = endX - startX
  if (Math.abs(deltaX) < 40) return
  if (deltaX < 0) goToNextMonth()
  else goToPreviousMonth()
}

const calendarDays = computed(() => {
  const year = calendarViewDate.value.getFullYear()
  const month = calendarViewDate.value.getMonth()
  const firstDay = new Date(year, month, 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const visibleStart = new Date(year, month, 1 - startOffset)
  const list = []
  const pad = n => String(n).padStart(2, '0')
  const localKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(visibleStart)
    date.setDate(visibleStart.getDate() + i)
    date.setHours(0, 0, 0, 0)
    const key = localKey(date)
    const dayWorkouts = statsWorkouts.value.filter((w) => {
      const wDate = new Date(w.date)
      wDate.setHours(0, 0, 0, 0)
      return !Number.isNaN(wDate.getTime()) && localKey(wDate) === key
    })

    const isCurrentMonth = date.getMonth() === month
    const isToday = date.getTime() === todayDate.getTime()
    // Keep clicks/overlay behavior from existing implementation:
    // only days with workouts open the overlay.
    list.push({
      key,
      label: date.getDate(),
      active: dayWorkouts.length > 0,
      workouts: dayWorkouts,
      isCurrentMonth,
      isToday
    })
  }
  return list
})

// Kalender-Tag Overlay
const calendarDayOverlay = ref(null) // { key, label, workouts }

function openDayOverlay(day) {
  if (!day.active) return
  calendarDayOverlay.value = day
}

function closeDayOverlay() {
  calendarDayOverlay.value = null
}

watch(calendarViewDate, () => {
  closeDayOverlay()
})

function getWorkingSetsStat(exercise) {
  if (Array.isArray(exercise.setDetails)) {
    return exercise.setDetails.filter(s => !s.isWarmup)
  }
  return []
}

function formatDayOverlayDate(key) {
  return new Date(key + 'T00:00:00').toLocaleDateString(isDe.value ? 'de-DE' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })
}

const advancedCards = computed(() => ([
  { title: 'Langzeit-Fortschritt', subtitle: '3, 6, 12 Monate im Vergleich' },
  { title: 'Muskelgruppen-Balance', subtitle: 'Push/Pull/Legs im Gleichgewicht' },
  { title: 'Trainingskonsistenz Score', subtitle: 'Streaks, Trends, Wochenziele' },
  { title: 'Leistung pro Übung', subtitle: 'PRs und Kurven pro Exercise' },
  { title: 'Plateau-Erkennung', subtitle: 'Warnung bei stagnierendem Fortschritt' },
  { title: 'Volumen-Trend-Analyse', subtitle: 'Intensität und Regeneration' }
]))

const baseInsights = computed(() => {
  const sessionsPerWeek = Number(avgSessionsDisplay.value) || 0
  const volumeChange = avgVolumePrev.value ? ((avgVolumeRecent.value - avgVolumePrev.value) / avgVolumePrev.value) * 100 : 0
  const consistency = activeStats.value?.kpis?.consistencyScore ?? 0
  return [
    `Du trainierst aktuell ${sessionsPerWeek.toFixed(1)} Tage pro Woche.`,
    volumeChange >= 0
      ? `Dein Trainingsvolumen ist um ${volumeChange.toFixed(0)} % gestiegen.`
      : `Dein Trainingsvolumen ist um ${Math.abs(volumeChange).toFixed(0)} % gesunken.`,
    `Deine Konsistenz liegt bei ${Math.round(consistency)} %.`
  ]
})

const proInsights = computed(() => ([
  'Langzeit-Analyse: Dein Volumen steigt in 3-Monats-Wellen.',
  'Muskelgruppen-Balance: Pull liegt leicht hinter Push.'
]))

const visibleInsights = computed(() => ([...baseInsights.value, ...proInsights.value]))

const sortedWeeks = computed(() => {
  if (!hasStatsWindow.value) return []
  return [...statsWeeks.value].sort((a, b) => new Date(a.weekStart) - new Date(b.weekStart))
})

const recentWeeks = computed(() => sliceWeeks(sortedWeeks.value, diagnosticsWindowSize, 0))
const previousWeeks = computed(() => sliceWeeks(sortedWeeks.value, diagnosticsWindowSize, diagnosticsWindowSize))

const avgSessionsRecent = computed(() => averageSessions(recentWeeks.value))
const avgSessionsPrev = computed(() => averageSessions(previousWeeks.value))
const avgVolumeRecent = computed(() => averageVolume(recentWeeks.value))
const avgVolumePrev = computed(() => averageVolume(previousWeeks.value))

const muscleSets = computed(() => collectMuscleSets(statsWorkouts.value))
const pushPull = computed(() => ({
  push: muscleSets.value.push?.sets || 0,
  pull: muscleSets.value.pull?.sets || 0
}))

const metricList = computed(() => {
  if (!hasCoreData.value) return []
  return [
    buildFrequencyMetric(),
    buildMuscleVolumeMetric(),
    buildPushPullMetric(),
    buildProgressionMetric(),
    buildRecoveryMetric()
  ].filter(Boolean)
})

const statusSummary = computed(() => {
  if (!metricList.value.length) return ''
  return metricList.value
    .map(metric => metric.summary)
    .filter(Boolean)
    .join(', ')
})

const primaryIssue = computed(() => {
  const ranked = metricList.value
    .filter(metric => metric.issue && metric.status !== 'good')
    .sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0))

  return ranked[0]?.issue || null
})

async function loadData() {
  try {
    loading.value = true
    await loadOfflineWorkouts()
    const online = isOnline()
    const token = online ? await getIdToken().catch(() => null) : null
    authToken.value = token

    if (online) {
      // StatsView: immer force-fetch damit IndexedDB alle DB-Workouts enthält
      try {
        await store.loadWorkouts(token, { force: true })
      } catch (err) {
        logger.debug('[Stats] loadWorkouts fehlgeschlagen', err)
      }
      // Nach loadWorkouts nochmals mit gültigem Token laden
      await loadOfflineWorkouts(token)
    }

    // Stats-Cache immer invalidieren — StatsView zeigt immer den aktuellen Stand
    store.invalidateStatsCache()

    if (token) {
      store.loadStats(token, { rangeDays: selectedRangeDays.value }).then(async () => {
        if (Number(store.statsErrorCode || 0) === 403 && isPro.value) {
          try {
            await subscriptionStore.checkSubscription(null, { force: true })
          } catch {}
        }
      }).catch((err) => {
        logger.warn('[Stats] Laden der Progress-Stats fehlgeschlagen', err)
      })
    } else {
      store.stats = null
    }
  } catch (error) {
    logger.error('Fehler beim Laden der Stats', error)
  } finally {
    loading.value = false
  }
}

async function loadOfflineWorkouts(token) {
  try {
    const activeUid = resolveActiveUid(token || authToken.value)
    logger.debug('[Stats] loadOfflineWorkouts — uid:', activeUid || '(empty)')
    const offline = await getAllWorkoutsOffline()
    const allItems = Array.isArray(offline) ? offline : []

    // Legacy-Fix: bereits gespeicherte Workouts ohne userId dem aktiven User zuordnen,
    // damit sie in den Stats nicht durch UID-Filter verschwinden.
    if (activeUid) {
      const missingUserIdItems = allItems.filter((item) => {
        const id = String(item?._id || item?.id || item?.workoutId || '').trim()
        const itemUserId = String(item?.userId || '').trim()
        return Boolean(id) && !itemUserId
      })

      if (missingUserIdItems.length) {
        Promise.all(
          missingUserIdItems.map((item) => saveWorkoutOffline({ ...item, userId: activeUid }))
        ).catch((error) => {
          logger.warn('[Stats] Backfill userId fuer Legacy-Workouts fehlgeschlagen', error)
        })
      }
    }

    offlineWorkouts.value = activeUid
      ? allItems.filter((item) => {
          const itemUserId = String(item?.userId || '').trim()
          return !itemUserId || itemUserId === activeUid
        })
      : allItems
    logger.debug('[Stats] loadOfflineWorkouts — final count:', offlineWorkouts.value.length)
  } catch (error) {
    logger.warn('[Stats] Offline workouts load failed', error)
  }
}

function handleOfflineWorkoutsUpdated() {
  // Token mitgeben damit resolveActiveUid zuverlässig die UID aus dem JWT lesen kann
  loadOfflineWorkouts(authToken.value)
}

watch(selectedRangeDays, async (next) => {
  if (!isOnline() || !isPro.value) return
  const token = await getIdToken().catch(() => null)
  await store.loadStats(token, { rangeDays: next })
})

// Beobachte route.query.postWorkout um PostWorkoutSummary anzuzeigen
watch(
  () => ({
    postWorkout: route.query.postWorkout,
    workoutId: route.query.workoutId
  }),
  (newQuery) => {
    if (newQuery.postWorkout === '1' && newQuery.workoutId) {
      postWorkoutId.value = String(newQuery.workoutId)
    }
  },
  { immediate: true }
)

function selectRange(range) {
  if (range.proOnly && !isPro.value) {
    openUpgrade('general')
    return
  }
  selectedRangeDays.value = range.days
}

function openUpgrade(type) {
  showUpgradeModal.value = true
}

function handleLockedClick() {
  if (!isPro.value) {
    openUpgrade('general')
  }
}

function handleUpgraded() {
  if (selectedRangeDays.value !== 30) return
  selectedRangeDays.value = 90
  loadData()
}

function handleDeleteRecentWorkout(workout) {
  pendingDeleteWorkout.value = workout
  showDeleteModal.value = true
}

async function confirmDeleteRecentWorkout() {
  if (deletingRecentWorkout.value) return
  deletingRecentWorkout.value = true
  const workout = pendingDeleteWorkout.value
  const workoutId = getWorkoutIdentifier(workout)
  if (!workoutId) {
    deletingRecentWorkout.value = false
    return
  }

  // Sofort: UI aktualisieren + Modal schließen (offline-first)
  offlineWorkouts.value = (offlineWorkouts.value || []).filter(item => getWorkoutIdentifier(item) !== workoutId)
  store.workouts = (store.workouts || []).filter(item => getWorkoutIdentifier(item) !== workoutId)
  store.invalidateStatsCache()
  showDeleteModal.value = false
  pendingDeleteWorkout.value = null

  // Hintergrund: IndexedDB + Server-Sync (fire-and-forget)
  deleteWorkoutFromStats({
    workout,
    authToken: authToken.value,
    online: isOnline(),
    deleteWorkoutApi,
    deleteWorkoutOffline,
    getIdToken,
    getCurrentUser,
    loadOfflineWorkouts,
    reloadWorkouts: (token) => store.loadWorkouts(token, { force: true }).then(() => loadOfflineWorkouts()),
    reloadStats: (token) => store.loadStats(token, { rangeDays: selectedRangeDays.value }),
    onLocalRemove: () => {},
    logger
  })
    .catch(err => logger.warn('[Stats] Background delete sync failed', err))
    .finally(() => {
      deletingRecentWorkout.value = false
    })
}

function calcWorkoutVolume(workout) {
  if (!workout) return 0
  let total = 0
  ;(workout.exercises || []).forEach((ex) => {
    if (Array.isArray(ex.setDetails) && ex.setDetails.length) {
      ex.setDetails.forEach((set) => {
        if (set?.isWarmup) return
        const reps = Number(set?.reps) || 0
        const weight = Number(set?.weight) || 0
        if (!reps && !weight) return // leere Zeilen überspringen
        total += reps * weight
      })
    } else {
      const sets = Number(ex?.sets) || 0
      const reps = Number(ex?.reps) || 0
      const weight = Number(ex?.weight) || 0
      total += sets * reps * weight
    }
  })
  return total
}

function formatKg(value) {
  const numeric = Number(value) || 0
  const formatted = new Intl.NumberFormat(isDe.value ? 'de-DE' : 'en-US', {
    maximumFractionDigits: 0
  }).format(numeric)
  return `${formatted}\u00a0kg`
}

onMounted(async () => {
  if (typeof window !== 'undefined') {
    window.addEventListener(OFFLINE_WORKOUTS_UPDATED_EVENT, handleOfflineWorkoutsUpdated)
  }
  // Sofort laden mit already-known authStore UID (offline-first)
  logger.debug('[Stats] onMounted — authStore.uid:', authStore.uid, 'initialized:', authStore.initialized, 'online:', isOnline())
  if (authStore.uid || authStore.isOfflineSessionValid) {
    await loadData()
  } else {
    // Kein bekannter User — loading sofort beenden damit Empty-State sichtbar wird
    loading.value = false
  }
  // Firebase callback für spätere Updates (z.B. Token wird verfügbar)
  onAuthStateChanged(async (user) => {
    logger.debug('[Stats] onAuthStateChanged fired:', user?.uid || 'null')
    if (user) {
      await loadData()
    } else if (!isOnline() && authStore.isOfflineSessionValid) {
      await loadData()
    } else {
      offlineWorkouts.value = []
    }
  })
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener(OFFLINE_WORKOUTS_UPDATED_EVENT, handleOfflineWorkoutsUpdated)
  }
})

function buildFrequencyMetric() {
  if (!Number.isFinite(avgSessionsRecent.value)) return null
  const value = avgSessionsRecent.value
  const prev = avgSessionsPrev.value
  const target = weeklyGoal.value || 4
  const diff = value - target
  const status = interpretDiff(diff, 0.25)
  const severity = severityScore[status]
  const valueText = `${formatNumber(value, 1)} ${isDe.value ? 'Sessions/Woche' : 'sessions/week'}`
  const trendText = buildTrendText(value - prev, 'sessions')
  const interpretation = diff >= 0
    ? (isDe.value ? 'im Zielbereich (≥ Ziel)' : 'on target (≥ goal)')
    : (isDe.value
        ? `−${formatNumber(Math.abs(diff), 1)} unter Ziel`
        : `-${formatNumber(Math.abs(diff), 1)} under goal`)
  const issue = status !== 'good'
    ? (isDe.value
        ? `Frequenz ${formatNumber(Math.abs(diff), 1)} unter Ziel`
        : `Frequency ${formatNumber(Math.abs(diff), 1)} below target`)
    : null
  return {
    key: 'frequency',
    label: t('stats.diagnostics.metrics.frequency'),
    value: valueText,
    trend: trendText,
    interpretation,
    summary: diff >= 0
      ? (isDe.value ? 'Frequenz gut' : 'Frequency good')
      : (isDe.value ? 'Frequenz niedrig' : 'Frequency low'),
    status,
    statusText: statusLabels.value[status],
    issue,
    severity
  }
}

function buildMuscleVolumeMetric() {
  const groups = ['push', 'pull', 'legs']
  const totals = groups.map(key => ({
    key,
    sets: Math.round(muscleSets.value[key]?.sets || 0),
    reps: Math.round(muscleSets.value[key]?.reps || 0)
  }))
  const totalSets = totals.reduce((sum, item) => sum + item.sets, 0)
  if (!totalSets) return null

  const minGroup = totals.reduce((lowest, current) => {
    if (!lowest || current.sets < lowest.sets) return current
    return lowest
  }, null)
  const maxGroup = totals.reduce((top, current) => {
    if (!top || current.sets > top.sets) return current
    return top
  }, null)

  const ratio = maxGroup && minGroup && maxGroup.sets ? minGroup.sets / maxGroup.sets : 1
  const status = ratio >= 0.8 ? 'good' : ratio >= 0.6 ? 'caution' : 'risk'
  const severity = severityScore[status]

  const labels = {
    push: isDe.value ? 'Push' : 'Push',
    pull: isDe.value ? 'Pull' : 'Pull',
    legs: isDe.value ? 'Beine' : 'Legs'
  }
  const valueText = isDe.value
    ? totals.map(item => `${labels[item.key]} ${item.sets} Sätze`).join(' · ')
    : totals.map(item => `${labels[item.key]} ${item.sets} sets`).join(' · ')

  const trend = isDe.value ? 'Verteilung (letzte 4 Wochen)' : 'Distribution (last 4 weeks)'
  const interpretation = status === 'good'
    ? (isDe.value ? 'Push/Pull/Beine ausgewogen' : 'Push/Pull/Legs balanced')
    : (isDe.value
        ? `${labels[minGroup.key]} ${Math.round((1 - ratio) * 100)} % unter ${labels[maxGroup.key]}`
        : `${labels[minGroup.key]} ${Math.round((1 - ratio) * 100)} % below ${labels[maxGroup.key]}`)

  const issue = status !== 'good'
    ? (isDe.value ? `${labels[minGroup.key]} zu wenig Volumen` : `${labels[minGroup.key]} volume too low`)
    : null

  return {
    key: 'muscle-volume',
    label: t('stats.diagnostics.metrics.muscleVolume'),
    value: valueText,
    trend,
    interpretation,
    summary: status === 'good'
      ? (isDe.value ? 'Volumen verteilt' : 'Volume balanced')
      : (isDe.value ? 'Volumen unausgeglichen' : 'Volume unbalanced'),
    status,
    statusText: statusLabels.value[status],
    issue,
    severity
  }
}

function buildPushPullMetric() {
  const { push, pull } = pushPull.value
  if (!push && !pull) return null
  if (!pull) {
    return {
      key: 'push-pull',
      label: t('stats.diagnostics.metrics.pushPull'),
      value: isDe.value ? 'Nur Push' : 'Push only',
      trend: isDe.value ? 'keine Pull-Daten' : 'no pull data',
      interpretation: isDe.value ? 'Pull fehlt komplett' : 'Pull sessions missing',
      summary: isDe.value ? 'Pull fehlt' : 'Pull missing',
      status: 'risk',
      statusText: statusLabels.value.risk,
      issue: isDe.value ? 'Kein Pull-Volumen erfasst' : 'No pull volume logged',
      severity: severityScore.risk
    }
  }

  const ratio = push / pull
  const status = ratio >= 0.85 && ratio <= 1.2 ? 'good' : ratio >= 0.7 && ratio <= 1.4 ? 'caution' : 'risk'
  const severity = severityScore[status]
  const valueText = `${formatNumber(ratio, 2)} ${isDe.value ? 'Verhältnis Push/Pull' : 'push/pull ratio'}`
  const interpretation = status === 'good'
    ? (isDe.value ? 'Balance stimmt' : 'balance on point')
    : (isDe.value
        ? (ratio > 1 ? 'Push überwiegt' : 'Pull überwiegt')
        : (ratio > 1 ? 'Push dominates' : 'Pull dominates'))
  const issue = status !== 'good'
    ? (isDe.value
        ? (ratio > 1 ? 'Pull-Volumen aufholen' : 'Push-Volumen nachziehen')
        : (ratio > 1 ? 'Increase pull work' : 'Increase push work'))
    : null

  return {
    key: 'push-pull',
    label: t('stats.diagnostics.metrics.pushPull'),
    value: valueText,
    trend: isDe.value ? 'letzte 4 Wochen' : 'last 4 weeks',
    interpretation,
    summary: status === 'good'
      ? (isDe.value ? 'Push/Pull in Balance' : 'Push/Pull balanced')
      : (isDe.value ? 'Push/Pull verschoben' : 'Push/Pull skewed'),
    status,
    statusText: statusLabels.value[status],
    issue,
    severity
  }
}

function buildProgressionMetric() {
  if (!Number.isFinite(avgVolumeRecent.value) || !Number.isFinite(avgVolumePrev.value)) return null
  const prev = avgVolumePrev.value
  const current = avgVolumeRecent.value
  if (prev === 0 && current === 0) return null
  const deltaPercent = prev ? ((current - prev) / prev) * 100 : 0
  const status = deltaPercent >= 5 ? 'good' : deltaPercent >= -5 ? 'caution' : 'risk'
  const severity = severityScore[status]
  const valueText = `${formatNumber(current, 0)} ${isDe.value ? 'Volumen/Woche' : 'volume/week'}`
  const trend = `${deltaPercent >= 0 ? '+' : ''}${formatNumber(deltaPercent, 1)}% ${isDe.value ? 'vs vorher' : 'vs prior'}`
  const interpretation = status === 'good'
    ? (isDe.value ? 'Progress steigt' : 'progress increasing')
    : status === 'caution'
      ? (isDe.value ? 'Progress stagniert' : 'progress flat')
      : (isDe.value ? 'Progress fällt' : 'progress dropping')
  const issue = status === 'risk'
    ? (isDe.value ? 'Progress stagniert, Volumen sinkt' : 'Progress stalled, volume down')
    : null

  return {
    key: 'progression',
    label: t('stats.diagnostics.metrics.progression'),
    value: valueText,
    trend,
    interpretation,
    summary: interpretation,
    status,
    statusText: statusLabels.value[status],
    issue,
    severity
  }
}

function buildRecoveryMetric() {
  if (!Number.isFinite(avgSessionsRecent.value)) return null
  const freqDiff = avgSessionsRecent.value - (weeklyGoal.value || 4)
  const volumeDelta = avgVolumePrev.value ? ((avgVolumeRecent.value - avgVolumePrev.value) / avgVolumePrev.value) * 100 : 0
  const stressScore = (freqDiff > 0 ? 1 : 0) + (volumeDelta > 10 ? 1 : 0)
  const status = stressScore >= 2 ? 'high' : stressScore === 1 ? 'medium' : 'low'
  const statusMap = {
    low: { status: 'good', text: isDe.value ? 'niedrig' : 'low' },
    medium: { status: 'caution', text: isDe.value ? 'mittel' : 'medium' },
    high: { status: 'risk', text: isDe.value ? 'hoch' : 'high' }
  }
  const mapped = statusMap[status]
  const severity = severityScore[mapped.status]
  const reason = status === 'high'
    ? (isDe.value ? 'Hohe Belastung, Regeneration beachten' : 'High load, monitor recovery')
    : status === 'medium'
      ? (isDe.value ? 'Belastung im Rahmen' : 'Load acceptable')
      : (isDe.value ? 'Erholung ausreichend' : 'Recovery adequate')
  const issue = mapped.status === 'risk'
    ? (isDe.value ? 'Stress zu hoch, Deload erwägen' : 'Stress high, consider deload')
    : null

  return {
    key: 'recovery',
    label: t('stats.diagnostics.metrics.recovery'),
    value: `${isDe.value ? 'Status' : 'Status'}: ${reason}`,
    trend: isDe.value
      ? `Frequenz Δ ${formatNumber(freqDiff, 1)}, Volumen Δ ${formatNumber(volumeDelta, 1)} %`
      : `Frequency Δ ${formatNumber(freqDiff, 1)}, Volume Δ ${formatNumber(volumeDelta, 1)} %`,
    interpretation: reason,
    summary: reason,
    status: mapped.status,
    statusText: statusLabels.value[mapped.status],
    issue,
    severity
  }
}

function sliceWeeks(weeks, size, offset = 0) {
  if (!Array.isArray(weeks) || !weeks.length || size <= 0) return []
  const end = Math.max(weeks.length - offset, 0)
  const start = Math.max(0, end - size)
  return weeks.slice(start, end)
}

function averageSessions(weeks) {
  if (!weeks.length) return 0
  const total = weeks.reduce((sum, week) => sum + (Number(week.sessionCount) || 0), 0)
  return Number((total / weeks.length).toFixed(2))
}

function averageVolume(weeks) {
  if (!weeks.length) return 0
  const total = weeks.reduce((sum, week) => sum + (Number(week.totalVolume) || 0), 0)
  return total / weeks.length
}

function collectMuscleSets(list) {
  const cutoff = Date.now() - 28 * MS_PER_DAY
  const base = {
    push: { sets: 0, reps: 0 },
    pull: { sets: 0, reps: 0 },
    legs: { sets: 0, reps: 0 }
  }

  list.forEach(workout => {
    if (!workout || workout.isDraft) return
    const workoutDate = new Date(workout.date)
    if (Number.isNaN(workoutDate.getTime()) || workoutDate.getTime() < cutoff) return

    ;(workout.exercises || []).forEach(exercise => {
      const bucketKey = normalizeCategory(exercise?.category, workout?.type)
      if (!base[bucketKey]) base[bucketKey] = { sets: 0, reps: 0 }
      if (Array.isArray(exercise.setDetails) && exercise.setDetails.length) {
        exercise.setDetails.forEach(set => {
          if (set?.isWarmup) return // Warmup-Sätze nicht in Muskelgruppen-Statistik zählen
          base[bucketKey].sets += 1
          base[bucketKey].reps += Number(set?.reps) || 0
        })
      } else {
        const sets = Number(exercise?.sets) || 1
        const reps = Number(exercise?.reps) || 0
        base[bucketKey].sets += Math.max(0, sets)
        base[bucketKey].reps += Math.max(0, sets * reps)
      }
    })
  })

  return base
}

function normalizeCategory(category, workoutType) {
  const source = (category || workoutType || 'push').toString().toLowerCase()
  if (source.includes('pull') || source.includes('ruck') || source.includes('back')) return 'pull'
  if (source.includes('leg') || source.includes('bein')) return 'legs'
  return 'push'
}

function interpretDiff(diff, tolerance) {
  if (Math.abs(diff) <= tolerance) return 'good'
  return Math.abs(diff) <= tolerance * 2 ? 'caution' : 'risk'
}

function buildTrendText(delta, unit) {
  if (!Number.isFinite(delta)) return isDe.value ? 'keine Veränderung' : 'no change'
  if (Math.abs(delta) < 0.01) return isDe.value ? 'stabil' : 'steady'
  if (unit === 'sessions') {
    return `${delta > 0 ? '+' : ''}${formatNumber(delta, 1)} ${isDe.value ? 'Sessions' : 'sessions'}`
  }
  return `${delta > 0 ? '+' : ''}${formatNumber(delta, 1)}`
}

function formatNumber(value, digits = 0) {
  const formatter = new Intl.NumberFormat(isDe.value ? 'de-DE' : 'en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })
  return formatter.format(Number(value) || 0)
}
</script>

<style scoped>
.stats-view {
  min-height: 100dvh;
  background: radial-gradient(circle at 20% 20%, rgba(213, 255, 102, 0.18), transparent 35%),
    radial-gradient(circle at 80% 0%, rgba(255, 163, 110, 0.22), transparent 40%),
    var(--bg);
  color: var(--fg);
  padding-bottom: 70px;
}

.stats-content {
  display: flex;
  flex-direction: column;
  gap: 28px;
  padding: 24px clamp(16px, 4vw, 48px);
  font-family: "Sora", "Space Grotesk", "SF Pro Display", sans-serif;
}

.range-pill.active {
  background: linear-gradient(120deg, rgba(61, 142, 230, 0.75), rgba(255, 164, 89, 0.75));
}

.calendar-shell {
  margin-top: 10px;
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
  margin-bottom: 8px;
}

.calendar-weekday {
  text-align: center;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--muted);
  text-transform: uppercase;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
}

.calendar-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 4px;
  min-height: 48px;
  padding: 7px 4px 6px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: var(--fg);
  cursor: default;
}

.calendar-day-number {
  font-size: 0.86rem;
  font-weight: 600;
  line-height: 1.2;
}

.calendar-cell.is-outside-month {
  color: rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.015);
  border-color: rgba(255, 255, 255, 0.04);
}

.calendar-cell.today {
  border-color: rgba(61, 142, 230, 0.85);
  background: rgba(61, 142, 230, 0.14);
  box-shadow: 0 0 0 1px rgba(61, 142, 230, 0.4);
}

.calendar-cell.clickable {
  cursor: pointer;
}

.calendar-cell.clickable:hover {
  transform: translateY(-1px);
  border-color: rgba(61, 142, 230, 0.5);
}

.calendar-day-marker {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--accent-color, #3d8ee6);
}

/* Kalender-Overlay */
.day-overlay-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 3000;
  padding: 0 0 24px;
}

.day-overlay-panel {
  width: 100%;
  max-width: 560px;
  max-height: 94dvh;
  overflow-y: auto;
  border-radius: 24px 24px 16px 16px;
  padding: 28px 24px 40px;
  background: rgba(28, 28, 34, 0.97);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 -4px 40px rgba(0, 0, 0, 0.6);
}

.day-overlay-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 22px;
}

.day-overlay-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text);
  margin: 0;
  text-transform: capitalize;
}

.day-overlay-close {
  background: rgba(255, 255, 255, 0.08);
  border: none;
  color: var(--text);
  font-size: 1.8rem;
  line-height: 1;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.day-overlay-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.day-overlay-workout {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 18px;
  padding: 20px 22px;
  border: 1px solid rgba(255, 255, 255, 0.07);
}

.day-overlay-workout-name {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.day-overlay-exercise {
  margin-bottom: 14px;
}

.day-overlay-exercise:last-child {
  margin-bottom: 0;
}

.day-overlay-ex-name {
  display: block;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 7px;
}

.day-overlay-sets {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.day-overlay-set {
  font-size: 0.92rem;
  color: var(--muted);
  background: rgba(255, 255, 255, 0.06);
  padding: 4px 12px;
  border-radius: 8px;
}

.day-overlay-more {
  font-size: 0.92rem;
  color: var(--muted);
  margin: 12px 0 0;
  text-align: center;
}

.recent-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.recent-item {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
}

.recent-title {
  font-weight: 600;
  margin: 0;
}

.recent-sub {
  font-size: 0.75rem;
  color: var(--muted);
}

.recent-note {
  margin: 6px 0 0;
  font-size: 0.78rem;
  color: var(--muted);
  max-width: 28ch;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.recent-value {
  font-weight: 700;
  flex-shrink: 0;
}

.recent-item-left {
  flex: 1;
  min-width: 0;
}

.ex-vol-list {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.ex-vol-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  padding: 2px 6px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
}

.ex-vol-name {
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 20ch;
}

.ex-vol-value {
  color: var(--accent-color);
  font-weight: 600;
  flex-shrink: 0;
  margin-left: 8px;
}

.pro-card {
  text-align: left;
  background: rgba(255, 255, 255, 0.06);
  cursor: pointer;
}

.pro-card.locked {
  overflow: hidden;
}

.card-sub {
  color: var(--muted);
  font-size: 0.85rem;
}

.locked-chart {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
  margin-top: 12px;
}

.locked-bar {
  height: 46px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.15);
}

.locked-chart.blur {
  filter: blur(4px);
}

.lock-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(8, 10, 14, 0.7);
  color: #fff;
  font-size: 0.85rem;
}

.lock-icon {
  font-size: 1.2rem;
}

.cta-ghost {
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 8px 12px;
  border-radius: 999px;
  background: transparent;
  color: var(--fg);
  cursor: pointer;
  white-space: nowrap;
}

.pro-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: linear-gradient(120deg, rgba(61, 142, 230, 0.22), rgba(255, 164, 89, 0.18));
}

.banner-title {
  margin: 6px 0 0;
  font-size: clamp(1.2rem, 2.4vw, 1.6rem);
  font-weight: 700;
}

.banner-sub {
  margin-top: 6px;
  color: var(--muted);
}

@media (max-width: 640px) {
  .section-head {
    align-items: flex-start;
  }
  .cta-ghost {
    width: 100%;
    text-align: center;
  }
  .pro-banner {
    flex-direction: column;
    align-items: flex-start;
  }
}

.insight-grid {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.insight-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.insight-card.locked {
  background: rgba(255, 255, 255, 0.04);
}

.milestone {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: linear-gradient(120deg, rgba(255, 164, 89, 0.18), rgba(61, 142, 230, 0.18));
}

.insight-icon {
  font-size: 1.4rem;
}

.cta-inline {
  align-self: flex-start;
  margin-top: 6px;
  border: none;
  background: var(--accent);
  color: var(--accent-contrast);
  padding: 6px 12px;
  border-radius: 999px;
  font-weight: 700;
  cursor: pointer;
}

.panel {
  border-radius: var(--panel-radius);
  border: 1px solid var(--line-soft);
  background: var(--bg-panel);
  box-shadow: var(--shadow-soft);
  padding: clamp(18px, 3vw, 24px);
}

.calendar-head-right {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.calendar-month-nav {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.calendar-month-label {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--fg);
  min-width: 11ch;
  text-align: center;
  text-transform: capitalize;
}

.calendar-month-btn {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(255, 255, 255, 0.06);
  color: var(--fg);
  line-height: 1;
  font-size: 1rem;
  cursor: pointer;
}

.calendar-month-btn:hover {
  border-color: rgba(61, 142, 230, 0.5);
}

@media (max-width: 540px) {
  .calendar-cell {
    min-height: 44px;
    border-radius: 8px;
    padding: 6px 2px 5px;
  }

  .calendar-day-number {
    font-size: 0.8rem;
  }
}

.loading-section {
  border-radius: var(--panel-radius);
  border: 1px solid var(--line-soft);
  background: var(--bg-panel);
  box-shadow: var(--shadow-soft);
  padding: 2.25rem 1.5rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
  justify-content: center;
}

.spinner {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: 3px solid rgba(255, 255, 255, 0.12);
  border-top-color: rgba(61, 142, 230, 0.9);
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.3em;
  font-size: 0.72rem;
  color: var(--muted);
  margin: 0 0 10px;
}

.status-line,
.issue-line {
  margin: 0;
  color: var(--fg-strong);
  line-height: 1.55;
}

.issue-panel {
  border-color: rgba(255, 137, 137, 0.5);
  background: rgba(255, 137, 137, 0.08);
}

.metric-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.metric-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: baseline;
}

.metric-label {
  margin: 0;
  font-weight: 600;
  color: var(--fg-strong);
}

.metric-status {
  font-size: 0.78rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--muted);
}

.metric-body {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-top: 10px;
}

.metric-value {
  margin: 0;
  font-weight: 600;
}

.metric-trend,
.metric-note {
  margin: 0;
  color: var(--muted);
  line-height: 1.55;
}

.metric-item.good { border-color: rgba(121, 255, 180, 0.3); }
.metric-item.caution { border-color: rgba(255, 210, 133, 0.35); }
.metric-item.risk { border-color: rgba(255, 137, 137, 0.5); }

@media (max-width: 540px) {
  .metric-body { flex-direction: column; }
}

[data-theme="light"] .panel,
[data-theme="light"] .loading-section {
  background: rgba(255, 255, 255, 0.65);
  border-color: rgba(12, 16, 30, 0.12);
}

[data-theme="light"] .issue-panel {
  background: rgba(255, 137, 137, 0.12);
}
</style>

