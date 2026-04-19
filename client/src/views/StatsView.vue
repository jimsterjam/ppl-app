<template>
  <div class="stats-view">
    <HeaderBar :title="t('stats.overview')" />

    <main class="stats-content">
      <section class="section">
        <RecentWorkouts :workouts="recentWorkoutsSource" :show-view-all="false" @delete="handleDeleteRecentWorkout" />
      </section>

      <section v-if="!isPro" class="pro-banner">
        <div>
          <p class="eyebrow">Pro Test</p>
          <h2 class="banner-title">14 Tage kostenlos testen</h2>
          <p class="banner-sub">Schalte Langzeit-Analysen frei und verfolge echte Fortschritte.</p>
        </div>
        <button class="cta-ghost" type="button" @click="openUpgrade('general')">Pro freischalten</button>
      </section>
      <section class="hero">
        <div class="hero-head">
          <div>
            <p class="eyebrow">Deine Trainingsstatistiken</p>
            <h2 class="hero-title">Fortschritt, der dich dranbleiben lässt</h2>
            <p class="hero-sub">Erweiterte Analyse ist fuer alle freigeschaltet. Pro bleibt im Draft-Status.</p>
          </div>
          <div class="range-selector">
            <button
              v-for="range in rangeOptions"
              :key="range.days"
              type="button"
              class="range-pill"
              :class="{ active: selectedRangeDays === range.days, locked: range.proOnly && !isPro }"
              @click="selectRange(range)"
            >
              <span>{{ range.label }}</span>
              <span v-if="range.proOnly && !isPro" class="lock">Draft</span>
            </button>
          </div>
        </div>

        <div class="summary-grid">
          <div class="summary-card">
            <span class="summary-label">Gesamttrainings</span>
            <span class="summary-value">{{ totalSessions }}</span>
            <span class="summary-sub">im Zeitraum</span>
          </div>
          <div class="summary-card">
            <span class="summary-label">Trainings / Woche</span>
            <span class="summary-value">{{ avgSessionsDisplay }}</span>
            <span class="summary-sub">Konstanz im Fokus</span>
          </div>
          <div class="summary-card">
            <span class="summary-label">Trainingsvolumen</span>
            <span class="summary-value">{{ totalVolumeLabel }}</span>
            <span class="summary-sub">Gesamtlast</span>
          </div>
          <div class="summary-card highlight">
            <span class="summary-label">Pers. Bestleistung</span>
            <span class="summary-value">{{ personalBestLabel }}</span>
            <span class="summary-sub">bester Satz</span>
          </div>
        </div>
      </section>

      <section v-if="analyticsLocked" class="panel milestone">
        <div>
          <h3>Erweiterte Analyse ist freigeschaltet</h3>
          <p>Die erweiterten Analysen sind fuer alle aktiv. Die Pro-Stufe wird derzeit als Draft gefuehrt.</p>
        </div>
        <button class="cta-inline" type="button" @click="openUpgrade('general')">Pro freischalten</button>
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
                <h4>Trainingsfrequenz pro Woche</h4>
                <span class="badge">Basis</span>
              </div>
              <div class="bar-chart">
                <div v-for="item in weeklyFrequency" :key="item.label" class="bar-item">
                  <div class="bar" :style="{ height: item.height + '%' }"></div>
                  <span class="bar-label">{{ item.label }}</span>
                </div>
              </div>
            </div>

            <div class="panel chart-card">
              <div class="card-head">
                <h4>Trainingsvolumen Entwicklung</h4>
                <span class="badge">Basis</span>
              </div>
              <div class="sparkline">
                <div v-for="item in volumeTrend" :key="item.label" class="spark-bar" :style="{ height: item.height + '%' }"></div>
              </div>
              <div class="sparkline-labels">
                <span>30 Tage</span>
                <span>{{ totalVolumeLabel }}</span>
              </div>
            </div>

            <div class="panel chart-card">
              <div class="card-head">
                <h4>Aktivitätstage</h4>
                <span class="badge">Basis</span>
              </div>
              <div class="calendar-grid">
                <div v-for="day in activityDays" :key="day.key" class="calendar-cell" :class="{ active: day.active }">
                  <span>{{ day.label }}</span>
                </div>
              </div>
            </div>

            <div class="panel chart-card">
              <div class="card-head">
                <h4>Letzte Trainingsfortschritte</h4>
                <span class="badge">Basis</span>
              </div>
              <ul class="recent-list">
                <li v-for="item in recentProgress" :key="item.id" class="recent-item">
                  <div class="recent-item-left">
                    <p class="recent-title">{{ item.title }}</p>
                    <span class="recent-sub">{{ item.subtitle }}</span>
                    <p v-if="item.note" class="recent-note">{{ item.note }}</p>
                    <ul v-if="item.exercises?.length" class="ex-vol-list">
                      <li v-for="ex in item.exercises" :key="ex.name" class="ex-vol-item">
                        <span class="ex-vol-name">{{ ex.name }}</span>
                        <span class="ex-vol-value">{{ formatKg(ex.volume) }}</span>
                      </li>
                    </ul>
                  </div>
                  <span class="recent-value">{{ item.value }}</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section class="section">
          <div class="section-head">
            <div>
              <h3>Erweiterte Analyse</h3>
              <span class="section-sub">Langzeit-Insights für echte Fortschritte</span>
            </div>
            <button class="cta-ghost" type="button" @click="openUpgrade('general')" v-if="!isPro">
              Draft
            </button>
          </div>

          <div class="pro-grid">
            <button
              v-for="card in advancedCards"
              :key="card.title"
              type="button"
              class="panel pro-card"
              :class="{ locked: !isPro }"
              @click="handleLockedClick(card)"
            >
              <div class="card-head">
                <h4>{{ card.title }}</h4>
                <span class="badge pro">Draft</span>
              </div>
              <p class="card-sub">{{ card.subtitle }}</p>
              <div class="locked-chart" :class="{ blur: !isPro }">
                <div class="locked-bar" v-for="n in 6" :key="n"></div>
              </div>
              <div v-if="!isPro" class="lock-overlay">
                <span class="lock-icon">🔒</span>
                <span>Detaillierte Analyse ist fuer alle freigeschaltet</span>
              </div>
            </button>
          </div>
        </section>

        <section class="section">
          <div class="section-head">
            <h3>Motivation & Insights</h3>
            <span class="section-sub">Kurz, ehrlich, motivierend</span>
          </div>
          <div class="insight-grid">
            <div v-for="insight in visibleInsights" :key="insight" class="panel insight-card">
              <span class="insight-icon">✨</span>
              <p>{{ insight }}</p>
            </div>
            <div v-if="!isPro" class="panel insight-card locked">
              <span class="insight-icon">🔒</span>
              <p>Mehr langfristige Insights sind bereits aktiv.</p>
              <button class="cta-inline" type="button" @click="openUpgrade('general')">Draft</button>
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

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
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
import { logger } from '@/utils/logger'
import { isOnline, getAllWorkoutsOffline, deleteWorkoutOffline, saveWorkoutOffline, OFFLINE_WORKOUTS_UPDATED_EVENT } from '@/utils/offlineStorage'
import { resolveWorkoutNotes } from '@/utils/workoutNotes'
import { deleteWorkout as deleteWorkoutApi } from '@/api/workouts'
import { deleteWorkoutFromStats, getWorkoutIdentifier } from '@/utils/workoutDeletion'

const { t, locale } = useI18n()
const store = useUserStore()
const settings = useSettingsStore()
const { getIdToken, onAuthStateChanged, getCurrentUser } = useFirebaseAuth()
const authStore = useAuthStore()
const subscriptionStore = useSubscriptionStore()

const loading = ref(true)
const offlineWorkouts = ref([])
const authToken = ref(null)

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

const weeklyFrequency = computed(() => {
  const source = statsWeeks.value
  const recent = source.slice(-6)
  const maxVal = Math.max(1, ...recent.map(item => Number(item.sessionCount) || 0))
  return recent.map((item) => {
    const label = new Date(item.weekStart).toLocaleDateString(isDe.value ? 'de-DE' : 'en-US', { month: 'short', day: 'numeric' })
    const value = Number(item.sessionCount) || 0
    return {
      label,
      value,
      height: Math.round((value / maxVal) * 100)
    }
  })
})

const volumeTrend = computed(() => {
  const days = 30
  const today = new Date()
  const data = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    date.setHours(0, 0, 0, 0)
    const key = date.toISOString().slice(0, 10)
    const total = statsWorkouts.value.reduce((sum, w) => {
      const wDate = new Date(w.date)
      wDate.setHours(0, 0, 0, 0)
      if (Number.isNaN(wDate.getTime())) return sum
      return wDate.toISOString().slice(0, 10) === key ? sum + calcWorkoutVolume(w) : sum
    }, 0)
    data.push({ label: key, value: total })
  }
  const maxVal = Math.max(1, ...data.map(d => d.value))
  return data.map(item => ({ ...item, height: Math.round((item.value / maxVal) * 100) }))
})

const activityDays = computed(() => {
  const days = 28
  const today = new Date()
  const list = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    date.setHours(0, 0, 0, 0)
    const key = date.toISOString().slice(0, 10)
    const active = statsWorkouts.value.some((w) => {
      const wDate = new Date(w.date)
      wDate.setHours(0, 0, 0, 0)
      return !Number.isNaN(wDate.getTime()) && wDate.toISOString().slice(0, 10) === key
    })
    list.push({ key, label: date.getDate(), active })
  }
  return list
})

const recentProgress = computed(() => {
  return [...statsWorkouts.value]
    .filter(w => !w.isDraft)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 4)
    .map((w) => {
      const exercises = (w.exercises || []).flatMap((ex) => {
        let vol = 0
        if (Array.isArray(ex.setDetails) && ex.setDetails.length) {
          ex.setDetails.forEach((set) => {
            if (set?.isWarmup) return
            vol += (Number(set.reps) || 0) * (Number(set.weight) || 0)
          })
        } else {
          vol = (Number(ex.sets) || 1) * (Number(ex.reps) || 0) * (Number(ex.weight) || 0)
        }
        return vol > 0 ? [{ name: ex.name || '?', volume: vol }] : []
      })
      return {
        id: w._id,
        title: w.name || 'Workout',
        subtitle: new Date(w.date).toLocaleDateString(isDe.value ? 'de-DE' : 'en-US'),
        note: typeof w.notes === 'string' ? w.notes.trim() : '',
        value: formatKg(calcWorkoutVolume(w)),
        exercises
      }
    })
})

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

.hero {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 24px;
  border-radius: 24px;
  background: linear-gradient(140deg, rgba(20, 22, 28, 0.92), rgba(34, 38, 48, 0.9));
  border: 1px solid color-mix(in srgb, var(--line-soft) 55%, transparent);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.25);
}

.hero-head {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.hero-title {
  margin: 6px 0 0;
  font-size: clamp(1.8rem, 3vw, 2.4rem);
  font-weight: 700;
  color: var(--fg-strong, #fff);
}

.hero-sub {
  color: color-mix(in srgb, var(--muted) 70%, white 20%);
  font-size: 0.95rem;
  max-width: 540px;
}

.range-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.range-pill {
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.08);
  color: var(--fg);
  padding: 10px 14px;
  border-radius: 999px;
  font-weight: 600;
  display: inline-flex;
  gap: 8px;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.range-pill.active {
  background: linear-gradient(120deg, rgba(215, 255, 31, 0.75), rgba(255, 164, 89, 0.75));
  color: #1a1a1a;
  border-color: transparent;
}

.range-pill.locked {
  opacity: 0.65;
}

.range-pill .lock {
  background: rgba(0, 0, 0, 0.3);
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.7rem;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
}

.summary-card {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 18px;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.summary-card.highlight {
  background: linear-gradient(150deg, rgba(213, 255, 102, 0.2), rgba(255, 164, 89, 0.25));
}

.summary-label {
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

.summary-value {
  font-size: 1.7rem;
  font-weight: 700;
}

.summary-sub {
  font-size: 0.85rem;
  color: var(--muted);
}

[data-theme="light"] .stats-view {
  background: var(--bg);
}

[data-theme="light"] .hero {
  background: var(--bg-panel);
  border-color: var(--line-strong);
  box-shadow: var(--shadow-soft);
}

[data-theme="light"] .hero-sub {
  color: var(--muted);
}

[data-theme="light"] .range-pill {
  background: var(--bg-panel);
  border-color: var(--line-strong);
  color: var(--fg);
}

[data-theme="light"] .range-pill.active {
  background: var(--accent);
  color: var(--accent-contrast);
}

[data-theme="light"] .summary-card {
  background: var(--card-bg);
  border-color: var(--line-soft);
}

[data-theme="light"] .summary-card.highlight {
  background: color-mix(in srgb, var(--accent) 14%, transparent);
}

.section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.section-sub {
  color: var(--muted);
  font-size: 0.85rem;
}

.base-grid,
.pro-grid,
.insight-grid {
  display: grid;
  gap: 16px;
}

.base-grid {
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.pro-grid {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.panel {
  border-radius: 18px;
  border: 1px solid var(--line-soft);
  background: var(--bg-panel);
  box-shadow: var(--shadow-soft);
  padding: 16px;
  position: relative;
}

.chart-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.badge {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  background: rgba(255, 255, 255, 0.08);
}

.badge.pro {
  background: rgba(215, 255, 31, 0.3);
  color: #1a1a1a;
}

.bar-chart {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
  align-items: end;
  height: 120px;
}

.bar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.bar {
  width: 100%;
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(215, 255, 31, 0.9), rgba(40, 182, 246, 0.75));
  min-height: 12px;
}

.bar-label {
  font-size: 0.7rem;
  color: var(--muted);
  text-align: center;
}

.sparkline {
  display: grid;
  grid-template-columns: repeat(30, 1fr);
  gap: 2px;
  height: 80px;
  align-items: end;
}

.spark-bar {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 6px;
}

.sparkline-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--muted);
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}

.calendar-cell {
  padding: 6px;
  border-radius: 8px;
  text-align: center;
  font-size: 0.75rem;
  background: rgba(255, 255, 255, 0.04);
  color: var(--muted);
}

.calendar-cell.active {
  background: rgba(215, 255, 31, 0.5);
  color: #1a1a1a;
  font-weight: 700;
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
  background: linear-gradient(120deg, rgba(215, 255, 31, 0.22), rgba(255, 164, 89, 0.18));
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
  background: linear-gradient(120deg, rgba(255, 164, 89, 0.18), rgba(215, 255, 31, 0.18));
}

.insight-icon {
  font-size: 1.4rem;
}

.cta-inline {
  align-self: flex-start;
  margin-top: 6px;
  border: none;
  background: rgba(215, 255, 31, 0.9);
  color: #1a1a1a;
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
  border-top-color: rgba(215, 255, 31, 0.9);
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

