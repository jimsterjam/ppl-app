import { defineStore } from "pinia";
import { logger } from '@/utils/logger'
import { useAuthStore } from './authStore'
import {
  isOnline,
  getAllWorkoutsOffline,
  filterDeletedWorkouts,
  cacheWorkouts,
  deleteWorkoutOffline,
  saveWorkoutOffline,
  queueAction,
  purgeServerDeletedWorkouts,
  clearWorkoutTombstones,
  db
} from '@/utils/offlineStorage'
import {
  fetchWorkouts,
  fetchLatestWorkoutsForRecovery,
  fetchWorkoutProgressStats,
  createWorkout as createWorkoutApi,
  updateWorkout as updateWorkoutApi
} from '@/api/workouts'
import { processSyncQueue } from '@/utils/syncManager'

const DRAFT_TOMBSTONES_KEY = 'deleted_draft_ids_v1'
const DRAFT_TOMBSTONE_TTL_MS = 6 * 60 * 60 * 1000

function isDraftLike(workout) {
  const id = String(workout?._id || '')
  return workout?._isDraft === true || workout?.isDraft === true || id === 'draft' || id.startsWith('draft-')
}

function readDraftTombstones() {
  try {
    const raw = localStorage.getItem(DRAFT_TOMBSTONES_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeDraftTombstones(map) {
  try {
    localStorage.setItem(DRAFT_TOMBSTONES_KEY, JSON.stringify(map || {}))
  } catch {}
}

function markDraftsDeleted(ids = []) {
  const valid = [...new Set((ids || []).map(v => String(v || '').trim()).filter(Boolean))]
  if (!valid.length) return
  const next = readDraftTombstones()
  const now = Date.now()
  valid.forEach((id) => {
    next[id] = now
  })
  writeDraftTombstones(next)
}

function isDraftDeleted(id) {
  if (!id) return false
  const map = readDraftTombstones()
  const entry = map[String(id)]
  if (!entry) return false
  const timestamp = Number(typeof entry === 'object' ? (entry?.timestamp || entry?.deletedAt || 0) : entry)
  if (Number.isFinite(timestamp) && timestamp > 0) {
    return (Date.now() - timestamp) <= DRAFT_TOMBSTONE_TTL_MS
  }
  return Boolean(entry)
}

function filterOutDeletedDrafts(list = [], source = 'unknown') {
  const items = Array.isArray(list) ? list : []
  const removed = items.filter(w => isDraftLike(w) && isDraftDeleted(w?._id))
  if (removed.length) {
    logger.debug('🛡️ [DraftIntegrity] Blocked tombstoned drafts from source:', source, removed.map(w => String(w?._id || '')))
  }
  return items.filter(w => !(isDraftLike(w) && isDraftDeleted(w?._id)))
}

function filterByUserId(list = [], activeUid = '') {
  const items = Array.isArray(list) ? list : []
  const uid = String(activeUid || '').trim()
  if (!uid) return items
  return items.filter((w) => String(w?.userId || '') === uid)
}

function parseUidFromToken(token = null) {
  const raw = String(token || '').trim()
  if (!raw) return ''
  const parts = raw.split('.')
  if (parts.length < 2) return ''
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const decoded = atob(payload.padEnd(payload.length + (4 - payload.length % 4) % 4, '='))
    const json = JSON.parse(decoded)
    return String(json?.user_id || json?.uid || json?.sub || '').trim()
  } catch {
    return ''
  }
}

function resolveActiveUid(authStore, token = null, fallbackUser = null) {
  return String(
    authStore?.uid
    || authStore?.user?.uid
    || fallbackUser?.uid
    || fallbackUser?.id
    || parseUidFromToken(token)
    || ''
  ).trim()
}

function normalizeWorkoutFingerprint(workout = {}) {
  const date = String(workout?.date || '').trim()
  const name = String(workout?.name || '').trim().toLowerCase()
  const type = String(workout?.type || '').trim().toLowerCase()
  const exercises = Array.isArray(workout?.exercises) ? workout.exercises : []
  const exerciseCount = exercises.length
  const volume = exercises.reduce((sum, ex) => {
    if (Array.isArray(ex?.setDetails) && ex.setDetails.length) {
      return sum + ex.setDetails.reduce((setSum, set) => {
        const reps = Number(set?.reps) || 0
        const weight = Number(set?.weight) || 0
        return setSum + reps * weight
      }, 0)
    }
    const sets = Number(ex?.sets) || 0
    const reps = Number(ex?.reps) || 0
    const weight = Number(ex?.weight) || 0
    return sum + (sets * reps * weight)
  }, 0)
  return `${date}|${name}|${type}|${exerciseCount}|${Math.round(volume)}`
}

/**
 * Robuste Merge-Funktion für zwei Workout-Listen.
 * Regeln:
 *   - Server ist die autoritative Basis
 *   - Lokale offline-erstellte Workouts (_offlineCreated / offline_*) bleiben immer erhalten
 *   - Lokale Drafts overlay‑en ggf. einen passenden Server-Eintrag
 *   - Für Konflikte ohne Draft-Flag: last-write-wins (updatedAt)
 * @param {Object[]} serverList - Workouts vom Server
 * @param {Object[]} localList  - Workouts aus IndexedDB
 * @returns {Object[]}
 */
function mergeWorkoutLists(serverList, localList) {
  const map = new Map()

  // Basis: alle Server-Workouts
  for (const w of (serverList || [])) {
    const id = String(w?._id || '').trim()
    if (!id) continue
    map.set(id, w)
  }

  // Overlay: lokale Workouts
  for (const w of (localList || [])) {
    const id = String(w?._id || '').trim()
    if (!id) continue
    const isDraft = w._isDraft === true || w.isDraft === true
    const isOfflineCreated = w._offlineCreated === true || id.startsWith('offline_')

    // Lokale Workouts ohne Server-Pendant → immer behalten
    if (isOfflineCreated || isDraft) {
      if (!map.has(id)) {
        map.set(id, w)
      } else if (isDraft) {
        // Draft überlagert Server-Eintrag (User ist noch am Editieren)
        const existing = map.get(id)
        map.set(id, { ...existing, ...w, _isDraft: true, isDraft: true, completed: false })
      }
      continue
    }

    // Beides vorhanden: last-write-wins
    if (!map.has(id)) {
      map.set(id, w)
      continue
    }
    const existing = map.get(id)
    const existingTs = new Date(existing?.updatedAt || existing?.date || 0).getTime()
    const localTs = new Date(w?.updatedAt || w?.date || 0).getTime()
    if (localTs > existingTs) map.set(id, w)
  }

  return Array.from(map.values())
}

function dedupeWorkoutsForStats(list = []) {
  const items = Array.isArray(list) ? list.filter(Boolean) : []
  const byKey = new Map()

  items.forEach((workout) => {
    if (workout?._isDraft === true || workout?.isDraft === true) return
    const uid = String(workout?._id || workout?.id || workout?.workoutId || '').trim()
    const identity = uid || normalizeWorkoutFingerprint(workout)
    const existing = byKey.get(identity)
    if (!existing) {
      byKey.set(identity, workout)
      return
    }
    const existingTs = new Date(existing?.updatedAt || existing?.date || existing?.createdAt || 0).getTime()
    const nextTs = new Date(workout?.updatedAt || workout?.date || workout?.createdAt || 0).getTime()
    if (nextTs >= existingTs) byKey.set(identity, workout)
  })

  return Array.from(byKey.values())
}

function getStatsCacheKey(uid = '') {
  const normalizedUid = String(uid || '').trim()
  return normalizedUid ? `bro_split_stats:${normalizedUid}` : 'bro_split_stats'
}

function isTransientRequestError(error) {
  const status = Number(error?.statusCode || error?.response?.status || error?.context?.originalError?.response?.status || 0)
  const code = String(error?.code || error?.context?.originalError?.code || '')
  return status === 0 || [502, 503, 504].includes(status) || code === 'ECONNABORTED' || code === 'ERR_NETWORK'
}

const WORKOUTS_REQUEST_COOLDOWN_MS = 15000
let workoutsLoadPromise = null
let workoutsLoadPromiseUid = ''
const workoutsCooldownUntilByUid = new Map()


export const useUserStore = defineStore("user", {
  state: () => ({
    user: null,
    workouts: [],
    stats: null,
    statsErrorCode: null,
    // Separate Lade-Flags und Cache-Metadaten
    loadingWorkouts: false,
    loadingStats: false,
    workoutsLoaded: false,
    workoutsLoadedAt: 0,
    error: null
  }),

  getters: {
    // Computed properties für die UI
    totalWorkouts: (state) => state.workouts.filter(w => !w._isDraft).length,
    
    completedWorkoutsCount: (state) => 
      state.workouts.filter(w => {
        if (w._isDraft) return false;
        if (w.completed) return true;
        const hasSets = (w?.exercises || []).some(ex => {
          const sets = ex?.setDetails?.length ?? ex?.sets ?? 0;
          return sets > 0;
        });
        return hasSets;
      }).length,
    
    todaysWorkout: (state) => {
      const today = new Date().toISOString().split('T')[0];
      const workout = state.workouts.find(w => 
        (w?.date || '').startsWith(today) && (w.completed === false || w.completed === undefined) && !w._isDraft
      );
      logger.debug('🧠 [userStore] todaysWorkout:', workout ? { _id: workout._id, name: workout.name, completed: workout.completed, _isDraft: workout._isDraft } : null)
      return workout;
    },

    // Letztes gespeichertes Workout (kein Draft), nach updatedAt oder date
    lastSavedWorkout: (state) => {
      const list = state.workouts.filter(w => !w._isDraft);
      if (list.length === 0) return null;
      return [...list].sort((a, b) => {
        const ad = new Date(a.updatedAt || a.date || 0).getTime();
        const bd = new Date(b.updatedAt || b.date || 0).getTime();
        return bd - ad;
      })[0] || null;
    },

    workoutsByType: (state) => (type) => 
      state.workouts.filter(w => !w._isDraft && w.type === type),

    hasError: (state) => !!state.error,

    // Für kompatible Nutzung im Dashboard
    isLoading: (state) => state.loadingWorkouts,
    isWorkoutsLoading: (state) => state.loadingWorkouts,
    isStatsLoading: (state) => state.loadingStats,

    hasDraft: (state) => {
      const has = state.workouts.some(w => w._isDraft === true);
      logger.debug('🧠 [userStore] hasDraft:', has, 'drafts:', state.workouts.filter(w => w._isDraft === true).map(w => ({ _id: w._id, name: w.name })) )
      return has;
    },

    draftType: (state) => state.workouts.find(w => w._isDraft === true)?.type,

    draftTimestamp: (state) => {
      const draft = state.workouts.find(w => w._isDraft === true);
      if (!draft) return null;
      const ts = draft.updatedAt || draft.date || draft._syncedAt || draft.createdAt;
      const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
      return isNaN(d.getTime()) ? null : d;
    }
  },
  actions: {

    buildOfflineStatsFromWorkouts(list = []) {
      const workouts = dedupeWorkoutsForStats(Array.isArray(list) ? list.filter(w => w && !w._isDraft) : [])
      if (!workouts.length) return null

      const weekMap = new Map()
      const toWeekStart = (date) => {
        const d = new Date(date)
        if (Number.isNaN(d.getTime())) return null
        const day = d.getDay()
        const diff = (day === 0 ? -6 : 1) - day
        d.setDate(d.getDate() + diff)
        d.setHours(0, 0, 0, 0)
        return d
      }

      const calcVolume = (workout) => {
        let total = 0
        ;(workout.exercises || []).forEach((ex) => {
          if (Array.isArray(ex.setDetails) && ex.setDetails.length) {
            ex.setDetails.forEach((set) => {
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

      workouts.forEach((workout) => {
        const date = workout.date || workout.updatedAt || workout.createdAt
        const weekStart = toWeekStart(date)
        if (!weekStart) return
        const key = weekStart.toISOString().slice(0, 10)
        const entry = weekMap.get(key) || {
          weekStart: key,
          weekEnd: new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          sessionCount: 0,
          totalVolume: 0
        }
        entry.sessionCount += 1
        entry.totalVolume += calcVolume(workout)
        weekMap.set(key, entry)
      })

      const weeks = Array.from(weekMap.values()).sort((a, b) => new Date(a.weekStart) - new Date(b.weekStart))
      if (!weeks.length) return null

      const totalSessions = weeks.reduce((sum, week) => sum + (Number(week.sessionCount) || 0), 0)
      const totalVolume = weeks.reduce((sum, week) => sum + (Number(week.totalVolume) || 0), 0)
      const avgSessionsPerWeek = totalSessions / weeks.length
      const avgWeeklyVolume = totalVolume / weeks.length
      const weeksWithSessions = weeks.filter(week => (Number(week.sessionCount) || 0) > 0).length
      const consistencyScore = weeks.length ? Math.round((weeksWithSessions / weeks.length) * 100) : 0

      return {
        weeks,
        kpis: {
          sessions: totalSessions,
          avgSessionsPerWeek,
          avgWeeklyVolume,
          consistencyScore
        }
      }
    },

    applyWorkoutLimit(list, limit = 3) {
      const items = Array.isArray(list) ? list : []
      const drafts = items.filter(w => isDraftLike(w) && w?.completed !== true && !isDraftDeleted(w?._id))
      const regular = items.filter(w => !((w?._isDraft === true || w?.isDraft === true) && w?.completed !== true))
      const sorted = [...regular].sort((a, b) => {
        const ad = new Date(a.updatedAt || a.date || 0).getTime()
        const bd = new Date(b.updatedAt || b.date || 0).getTime()
        return bd - ad
      })
      return [...drafts, ...sorted.slice(0, limit)]
    },

        async startWorkout(type, token = null) {
          // Wrapper für createWorkout mit minimalen Daten
          const workoutData = { type, name: `${type.charAt(0).toUpperCase() + type.slice(1)} Day` };
          return await this.createWorkout(workoutData, token);
        },
    async loadWorkouts(token = null, _options = {}) {
      // Workouts per API laden, aber offline-first fallback
      this.error = null;
      this.loadingWorkouts = true;
      const force = _options?.force === true
      const authStore = useAuthStore()
      const activeUid = resolveActiveUid(authStore, token, this.user)
      if (!activeUid) {
        this.error = 'Nicht angemeldet. Bitte mit dem bisherigen Konto anmelden.'
        this.workoutsLoaded = true
        this.workoutsLoadedAt = Date.now()
        this.loadingWorkouts = false
        return this.workouts
      }

      if (workoutsLoadPromise && workoutsLoadPromiseUid === activeUid && !force) {
        return workoutsLoadPromise
      }

      const cooldownUntil = Number(workoutsCooldownUntilByUid.get(activeUid) || 0)
      if (!force && cooldownUntil > Date.now()) {
        this.loadingWorkouts = false
        return this.workouts
      }

      workoutsLoadPromiseUid = activeUid
      workoutsLoadPromise = (async () => {
      try {
        const online = isOnline();

        // Sofortige Anzeige aus Offline-Cache, damit UI nicht leer bleibt
        try {
          const cachedWorkouts = await getAllWorkoutsOffline({ userId: activeUid });
          const scopedCached = filterDeletedWorkouts(filterByUserId(cachedWorkouts, activeUid))
          if (Array.isArray(scopedCached) && scopedCached.length) {
            this.workouts = filterOutDeletedDrafts(scopedCached.map(w => ({
              ...w,
              completed: w.completed !== undefined ? w.completed : false,
              _isDraft: w._isDraft === true || w?.isDraft === true,
              isDraft: w._isDraft === true || w?.isDraft === true
            })), 'offline-cache-bootstrap');
            this.workoutsLoaded = true;
            this.workoutsLoadedAt = Date.now();
          }
        } catch (e) {
          logger.warn('⚠️ [Offline] Konnte cached Workouts nicht lesen:', e);
        }

        if (online) {
          // ─── SYNC STRATEGY ───────────────────────────────────────────────────
          // 1. Server-Fetch
          const serverWorkouts = await fetchWorkouts(token, activeUid)
          const serverIds = (Array.isArray(serverWorkouts) ? serverWorkouts : [])
            .map(w => String(w?._id || '').trim()).filter(Boolean)

          // 2. Tombstones für Server-IDs aufheben — der Server ist autoritativ.
          //    Wenn das Backend das Workout zurückgibt, darf kein lokaler Tombstone es blockieren.
          if (serverIds.length) {
            clearWorkoutTombstones(serverIds)
          }

          // 3. Lokalen Stand aus IndexedDB laden (enthält jetzt Server-Workouts +
          //    Drafts + offline-erstellte Workouts, die noch nicht gesynct sind)
          let localAll = []
          try {
            localAll = await getAllWorkoutsOffline({ userId: activeUid })
          } catch (e) {
            logger.warn('⚠️ [Sync] IndexedDB-Lesefehler beim Merge:', e)
          }

          // 4. Merge: Server ist die Basis, lokale Einträge supplementieren
          //    Server-Workouts werden NICHT durch filterDeletedWorkouts gefiltert —
          //    die Tombstones wurden in Schritt 2 bereits bereinigt.
          const serverNormalized = filterOutDeletedDrafts(
            filterByUserId(Array.isArray(serverWorkouts) ? serverWorkouts : [], activeUid),
            'server-fetch'
          )
          const localFiltered = filterOutDeletedDrafts(
            filterDeletedWorkouts(Array.isArray(localAll) ? localAll : []),
            'local-merge'
          )
          const merged = mergeWorkoutLists(serverNormalized, localFiltered)
            .map(w => ({
              ...w,
              completed: w.completed !== undefined ? w.completed : false,
              _isDraft: w._isDraft === true || w?.isDraft === true,
              isDraft: w._isDraft === true || w?.isDraft === true
            }))

          // 5. Merged-Liste in IndexedDB zurückschreiben (UI = IndexedDB = Server)
          try {
            await cacheWorkouts(merged)
          } catch (e) {
            logger.warn('⚠️ [Sync] Konnte Workouts nicht cachen:', e)
          }

          // 6. Workouts bereinigen, die der Server nicht mehr kennt
          //    Guard: nur wenn beide Werte gesetzt (verhindert ungescopten Purge)
          try {
            if (activeUid && serverIds.length) {
              await purgeServerDeletedWorkouts(serverIds, activeUid)
            }
          } catch (e) {
            logger.warn('⚠️ [Sync] purgeServerDeletedWorkouts fehlgeschlagen:', e)
          }

          this.workouts = this.applyWorkoutLimit(merged, 3)
          this.workoutsLoaded = true
          this.workoutsLoadedAt = Date.now()
          logger.debug(`✅ [Sync] loadWorkouts — server: ${serverIds.length}, lokal: ${localAll.length}, merged: ${merged.length}, angezeigt: ${this.workouts.length}`)
          return this.workouts
          // ─────────────────────────────────────────────────────────────────────
        }

        // Offline: Workouts aus IndexedDB laden
        const offlineWorkouts = await getAllWorkoutsOffline({ userId: activeUid });
        this.workouts = filterOutDeletedDrafts(filterDeletedWorkouts(filterByUserId(Array.isArray(offlineWorkouts) ? offlineWorkouts : [], activeUid)), 'offline-load');
        this.workouts = this.workouts.map(w => ({
          ...w,
          completed: w.completed !== undefined ? w.completed : false,
          _isDraft: w._isDraft === true || w?.isDraft === true,
          isDraft: w._isDraft === true || w?.isDraft === true
        }));
        this.workoutsLoaded = true;
        this.workoutsLoadedAt = Date.now();
        this.error = this.workouts.length ? null : this.error;
        logger.debug(`✅ [Offline] Loaded ${this.workouts.length} workouts from IndexedDB`);

        this.workouts = this.applyWorkoutLimit(this.workouts, 3)

        return this.workouts;
      } catch (error) {
        logger.error('❌ [API] Error loading workouts from server:', error);
        if (isTransientRequestError(error)) {
          workoutsCooldownUntilByUid.set(activeUid, Date.now() + WORKOUTS_REQUEST_COOLDOWN_MS)
        }
        this.error = error?.message || 'Fehler beim Laden der Workouts';
        try {
          const offlineWorkouts = await getAllWorkoutsOffline({ userId: activeUid });
          this.workouts = Array.isArray(offlineWorkouts)
            ? filterDeletedWorkouts(filterByUserId(offlineWorkouts, activeUid)).map(w => ({
                ...w,
                _isDraft: w._isDraft === true || w?.isDraft === true,
                isDraft: w._isDraft === true || w?.isDraft === true
              }))
            : [];
          this.workouts = filterOutDeletedDrafts(this.workouts, 'offline-fallback-catch')
          this.workouts = this.applyWorkoutLimit(this.workouts, 3)
          if (this.workouts.length) this.error = null;
        } catch {
          // Bewahre den aktuellen UI-Stand bei, statt bei Fehlern sofort zu leeren.
        }
      } finally {
        this.loadingWorkouts = false;
      }
      })().finally(() => {
        workoutsLoadPromise = null
        workoutsLoadPromiseUid = ''
      })

      return workoutsLoadPromise
    },

    async loadStats(token = null, params = {}) {
      this.loadingStats = true;
      this.error = null;
      this.statsErrorCode = null;
      const authStore = useAuthStore()
      const activeUid = resolveActiveUid(authStore, token, this.user)
      const statsCacheKey = getStatsCacheKey(activeUid)
      const readCachedStats = () => {
        try {
          const cached = localStorage.getItem(statsCacheKey);
          return cached ? JSON.parse(cached) : null;
        } catch (err) {
          logger.warn('⚠️ [userStore] Konnte Stats-Cache nicht lesen:', err);
          return null;
        }
      };
      const hasMeaningfulStats = (stats) => {
        if (!stats) return false
        const sessions = Number(stats?.kpis?.sessions || 0)
        const weeks = Array.isArray(stats?.weeks) ? stats.weeks.length : 0
        return sessions > 0 || weeks > 0
      }
      const recoverStatsFromLatestWorkouts = async () => {
        if (!token || !activeUid) return null

        const latest = await fetchLatestWorkoutsForRecovery(token, activeUid, 3)
        if (!Array.isArray(latest) || latest.length === 0) return null

        const normalizedLatest = latest.map((w) => ({
          ...w,
          completed: w?.completed !== undefined ? w.completed : false,
          _isDraft: w?._isDraft === true || w?.isDraft === true,
          isDraft: w?._isDraft === true || w?.isDraft === true
        }))

        this.workouts = this.applyWorkoutLimit(normalizedLatest, 3)

        const derived = this.buildOfflineStatsFromWorkouts(normalizedLatest)
        if (!derived) return null

        localStorage.setItem(statsCacheKey, JSON.stringify(derived))
        logger.debug('✅ [userStore] Stats-Recovery aktiv: letzte 3 Backend-Workouts lokal gesichert und Stats abgeleitet')
        return derived
      }

      try {
        const cached = readCachedStats();
        if (cached) {
          this.stats = cached;
        }
        if (!isOnline()) {
          if (!cached || !Array.isArray(cached?.weeks) || cached.weeks.length === 0) {
            try {
              const offlineWorkouts = activeUid
                ? await getAllWorkoutsOffline({ userId: activeUid })
                : []
              const derived = this.buildOfflineStatsFromWorkouts(filterByUserId(offlineWorkouts, activeUid))
              if (derived) {
                this.stats = derived
                localStorage.setItem(statsCacheKey, JSON.stringify(derived))
              } else {
                this.stats = cached
              }
            } catch {
              this.stats = cached
            }
          } else {
            this.stats = cached
          }
          if (this.stats) this.error = null;
          return this.stats;
        }

        const stats = await fetchWorkoutProgressStats(token, params);
        if (stats?.__forbidden === true || Number(stats?.__status || 0) === 403) {
          this.statsErrorCode = 403
          logger.debug('ℹ️ [userStore] Progress-Stats gesperrt (403):', {
            code: stats?.code || null,
            entitlementPlan: stats?.entitlement?.plan || null
          })
          let fallback = hasMeaningfulStats(readCachedStats()) ? readCachedStats() : null
          if (!hasMeaningfulStats(fallback)) {
            fallback = await recoverStatsFromLatestWorkouts()
          }
          if (!hasMeaningfulStats(fallback)) {
            const source = (Array.isArray(this.workouts) && this.workouts.length)
              ? filterByUserId(this.workouts, activeUid)
              : (await getAllWorkoutsOffline({ userId: activeUid }))
            const derived = this.buildOfflineStatsFromWorkouts(source)
            if (derived) {
              fallback = derived
              localStorage.setItem(statsCacheKey, JSON.stringify(derived))
            }
          }
          this.stats = fallback
          return this.stats
        }

        if (hasMeaningfulStats(stats)) {
          this.stats = stats;
          localStorage.setItem(statsCacheKey, JSON.stringify(stats));
          logger.debug('✅ [API] Progress Stats geladen:', {
            sessions: stats?.kpis?.sessions,
            weeks: stats?.weeks?.length || 0
          });
        } else {
          let fallback = hasMeaningfulStats(readCachedStats()) ? readCachedStats() : null;
          if (!hasMeaningfulStats(fallback)) {
            fallback = await recoverStatsFromLatestWorkouts()
          }
          if (!hasMeaningfulStats(fallback)) {
            const source = (Array.isArray(this.workouts) && this.workouts.length)
              ? filterByUserId(this.workouts, activeUid)
              : (await getAllWorkoutsOffline({ userId: activeUid }))
            const derived = this.buildOfflineStatsFromWorkouts(source)
            if (derived) {
              fallback = derived
              localStorage.setItem(statsCacheKey, JSON.stringify(derived))
              logger.debug('ℹ️ [userStore] Progress Stats lokal aus Workouts abgeleitet')
            }
          }
          this.stats = fallback
          logger.debug('ℹ️ [userStore] Keine frischen Stats, nutze Fallback:', !!this.stats);
        }
        return this.stats;
      } catch (error) {
        if (isTransientRequestError(error)) {
          logger.warn('⚠️ [API] Progress Stats temporär nicht erreichbar, nutze Cache:', {
            status: Number(error?.statusCode || error?.response?.status || error?.context?.originalError?.response?.status || 0) || null,
            code: String(error?.code || error?.context?.originalError?.code || ''),
            online: isOnline()
          })
        } else {
          logger.error('❌ [API] Fehler beim Laden der Progress Stats:', error);
        }
        this.statsErrorCode = Number(error?.statusCode || error?.response?.status || error?.context?.originalError?.response?.status || 0) || null;
        this.error = error?.message || 'Fehler beim Laden der Progress Stats';
        this.stats = readCachedStats();
        if (this.stats || isTransientRequestError(error)) this.error = null;
        return this.stats;
      } finally {
        this.loadingStats = false;
      }
    },

    async createWorkout(workoutData, token = null) {
      logger.debug('🏗️ [userStore] createWorkout called:', workoutData, 'token:', !!token)
      try {
        const authStore = useAuthStore()
        const enrichedWorkoutData = {
          ...workoutData,
          userId: workoutData?.userId || authStore.uid || null
        }
        logger.debug('DEBUG: createWorkout token:', token ? 'present' : 'null', 'data:', enrichedWorkoutData)
        const newWorkout = await createWorkoutApi(enrichedWorkoutData, token);
        logger.debug('🏗️ [userStore] API returned:', newWorkout)
        if (newWorkout) {
          this.workouts.push(newWorkout);
          this.workouts = this.applyWorkoutLimit(this.workouts, 3)
          if (newWorkout?._offlineCreated) {
            logger.warn('⚠️ [API] Workout offline erstellt und in Sync-Queue gelegt:', newWorkout._id)
            if (isOnline()) {
              processSyncQueue(token || null).catch((syncError) => {
                logger.warn('⚠️ [API] Sofort-Sync nach offline Create fehlgeschlagen:', syncError?.message || syncError)
              })
            }
          } else {
            logger.debug('✅ [API] Workout created:', newWorkout._id)
          }
        }
        return newWorkout;
      } catch (error) {
        logger.error('❌ [API] Error creating workout:', error);
        throw error;
      }
    },

    async createWorkoutOptimistic(workoutData, _token = null) {
      const authStore = useAuthStore()
      const localId = `offline_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      const localWorkout = {
        ...workoutData,
        _id: localId,
        _offlineCreated: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completed: workoutData.completed ?? false,
        userId: workoutData?.userId || authStore.uid || this.user?.id || this.user?.uid || null
      }

      try { await saveWorkoutOffline(localWorkout) } catch {}
      this.workouts.unshift(localWorkout)
      this.workouts = this.applyWorkoutLimit(this.workouts, 3)

      try { await queueAction('create', 'workout', localWorkout) } catch {}

      return localWorkout
    },

    async updateWorkout(id, updates, token = null) {
      logger.debug('📡 [userStore] updateWorkout called:', id, updates)
      const authStore = useAuthStore()
      const activeUid = resolveActiveUid(authStore, token, this.user)
      const isOfflineId = typeof id === 'string' && (id.startsWith('offline_') || id.startsWith('draft-'))
      if (isOfflineId) {
        try {
          const idx = this.workouts.findIndex(w => w._id === id)
          const merged = idx !== -1
            ? { ...this.workouts[idx], ...updates, userId: updates?.userId || this.workouts[idx]?.userId || activeUid || null }
            : { ...updates, _id: id, userId: updates?.userId || activeUid || null }
          await saveWorkoutOffline({ ...merged, _id: id, _offlineUpdated: true, updatedAt: Date.now() })
          await queueAction('update', 'workout', { ...merged, _id: id, _offlineUpdated: true })
          if (idx !== -1) {
            this.workouts[idx] = merged
          } else {
            this.workouts.unshift(merged)
          }
          this.workouts = this.applyWorkoutLimit(this.workouts, 3)
          if (updates.completed === true) {
            this.stats = null
            try { localStorage.removeItem(getStatsCacheKey(activeUid)) } catch {}
            logger.debug('🔄 [userStore] Stats-Cache nach Workout-Save invalidiert (offline path)')
          }
          return merged
        } catch (error) {
          logger.error('❌ [userStore] Error updating offline workout:', error)
          throw error
        }
      }
      // Wenn kein gültiges ObjectId: als neues Workout anlegen (POST)
      const isValidObjectId = typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
      if (!isValidObjectId) {
        logger.debug('📡 [userStore] Invalid ObjectId, creating new workout')
        try {
          // type aus vorhandenem Draft holen, falls nicht im updates-Objekt
          let draftType = updates.type;
          if (!draftType) {
            const draft = this.workouts.find(w => w._id === id);
            if (draft && draft.type) draftType = draft.type;
          }
          // Name automatisch nach Typ setzen, falls nicht vorhanden
          let draftName = updates.name;
          if (!draftName && draftType) {
            if (draftType.toLowerCase() === 'push') draftName = 'Push Day';
            else if (draftType.toLowerCase() === 'pull') draftName = 'Pull Day';
            else if (draftType.toLowerCase() === 'legs') draftName = 'Leg Day';
          }
          const newWorkout = await createWorkoutApi({
            ...updates,
            type: draftType,
            name: draftName,
            userId: updates?.userId || activeUid || null
          }, token);
          // Ersetze nur den konkreten temporären Eintrag, behalte andere Drafts
          this.workouts = this.workouts.filter(w => String(w?._id || '') !== String(id));
          // Füge das neue Workout hinzu
            if (newWorkout) {
            this.workouts.push(newWorkout);
            this.workouts = this.applyWorkoutLimit(this.workouts, 3)
            logger.debug('✅ [userStore] New workout created:', newWorkout._id, 'completed:', newWorkout.completed)
          }
          if (updates.completed === true) {
            this.stats = null
            try { localStorage.removeItem(getStatsCacheKey(activeUid)) } catch {}
            logger.debug('🔄 [userStore] Stats-Cache nach Workout-Save invalidiert (create path)')
          }
          return newWorkout;
        } catch (error) {
          logger.error('❌ [userStore] Error creating workout from draft:', error);
          throw error;
        }
      }
      // Andernfalls normales Update (PUT)
      try {
        const idx = this.workouts.findIndex(w => w._id === id)
        const optimistic = idx !== -1
          ? { ...this.workouts[idx], ...updates, userId: updates?.userId || this.workouts[idx]?.userId || activeUid || null }
          : { ...updates, _id: id, userId: updates?.userId || activeUid || null }
        const optimisticWithTs = { ...optimistic, updatedAt: new Date().toISOString() }
        try {
          await saveWorkoutOffline(optimisticWithTs)
        } catch (e) {
          logger.warn('⚠️ [userStore] Konnte Workout nicht offline zwischenspeichern:', e)
        }
        if (idx !== -1) {
          this.workouts[idx] = optimisticWithTs
        } else {
          this.workouts.unshift(optimisticWithTs)
        }
        this.workouts = this.applyWorkoutLimit(this.workouts, 3)
        if (updates.completed === true) {
          this.stats = null
          try { localStorage.removeItem(getStatsCacheKey(activeUid)) } catch {}
          logger.debug('🔄 [userStore] Stats-Cache nach Workout-Save invalidiert (update path)')
        }

        const timeoutMs = 4000
        const apiPromise = updateWorkoutApi(id, updates, token)
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs))
        const updatedWorkout = await Promise.race([apiPromise, timeoutPromise])
        if (!updatedWorkout) {
          logger.warn('⏳ [userStore] updateWorkout timeout, keep optimistic state')
          apiPromise
            .then((lateUpdate) => {
              if (!lateUpdate) return
              const lateIdx = this.workouts.findIndex(w => w._id === id)
              if (lateIdx !== -1) {
                this.workouts[lateIdx] = { ...this.workouts[lateIdx], ...lateUpdate }
                if (updates.completed !== undefined) {
                  this.workouts[lateIdx].completed = updates.completed
                }
                this.workouts = this.applyWorkoutLimit(this.workouts, 3)
              }
            })
            .catch(() => {})
          return optimisticWithTs
        }
        const updatedIdx = this.workouts.findIndex(w => w._id === id);
        if (updatedWorkout && updatedIdx !== -1) {
          this.workouts[updatedIdx] = { ...this.workouts[updatedIdx], ...updatedWorkout };
          // Sicherstellen, dass completed gesetzt wird, falls der Server es nicht zurückgibt
          if (updates.completed !== undefined) {
            this.workouts[updatedIdx].completed = updates.completed;
          }
        }
        this.workouts = this.applyWorkoutLimit(this.workouts, 3)
        return updatedWorkout;
      } catch (error) {
        logger.error('❌ [userStore] Error updating workout:', error);
        throw error;
      }
    },

    invalidateStatsCache() {
      const authStore = useAuthStore()
      const activeUid = resolveActiveUid(authStore, null, this.user)
      this.stats = null
      try { localStorage.removeItem(getStatsCacheKey(activeUid)) } catch {}
      logger.debug('🔄 [userStore] Stats-Cache invalidiert')
    },

    async markWorkoutCompleted(id, _token = null) {
      // Offline/Demo: Workout lokal als abgeschlossen markieren
      try {
        const idx = this.workouts.findIndex(w => w._id === id)
        if (idx !== -1) {
          this.workouts[idx] = {
            ...this.workouts[idx],
            completed: true,
            completedAt: new Date().toISOString()
          }
          this.workouts = this.applyWorkoutLimit(this.workouts, 3)
          localStorage.setItem('bro_split_workouts', JSON.stringify(this.workouts))
          logger.debug('✅ [Demo] Workout marked completed offline:', id)
          return this.workouts[idx]
        }
        return null
      } catch (error) {
        logger.error('❌ [Demo] Error completing workout:', error)
        throw error
      }
    },

    async clearDraft() {
      const authStore = useAuthStore()
      const activeUid = resolveActiveUid(authStore, null, this.user)
      const collectDraftIds = new Set(
        (this.workouts || [])
          .filter(w => isDraftLike(w) && w?.completed !== true)
          .filter((w) => !activeUid || String(w?.userId || '') === activeUid)
          .map(w => String(w?._id || '').trim())
          .filter(Boolean)
      )

      try {
        const offline = activeUid
          ? await getAllWorkoutsOffline({ userId: activeUid })
          : []
        offline
          .filter(w => isDraftLike(w) && w?.completed !== true)
          .forEach((w) => {
            const id = String(w?._id || '').trim()
            if (id) collectDraftIds.add(id)
          })

        const draftIds = [...collectDraftIds]
        if (draftIds.length) {
          try {
            await db.workouts.bulkDelete(draftIds)
          } catch {}
          await Promise.all(draftIds.map(id => deleteWorkoutOffline(id).catch(() => null)))
          markDraftsDeleted(draftIds)
          logger.debug('🧹 [DraftIntegrity] Tombstoned draft IDs after delete:', draftIds)
        }
      } catch (e) {
        logger.warn('⚠️ [userStore] Konnte Offline-Drafts nicht löschen:', e)
      }

      try {
        const detailKey = 'workout_detail_draft'
        sessionStorage.removeItem(detailKey)
        const allKeys = Object.keys(sessionStorage)
        allKeys.forEach((key) => {
          if (key.startsWith('workout_detail_draft_') || key.startsWith('workout_map_')) {
            sessionStorage.removeItem(key)
          }
        })
      } catch {}

      try {
        const before = this.workouts.length
        this.workouts = this.workouts.filter(w => !(isDraftLike(w) && w?.completed !== true))
        const after = this.workouts.length
        logger.debug('🧹 [userStore] Drafts aus Store entfernt. Workouts:', before, '→', after)
      } catch {
        // ignore
      }
    },

    // Hilfsmethoden
    getTodaysWorkout() {
      const today = new Date().toISOString().split('T')[0];
      return this.workouts.find(w => 
        w.date.startsWith(today) && !w.completed
      );
    },

    getCompletedWorkouts() {
      return this.workouts.filter(w => {
        if (w.isDraft) return false;
        if (w.completed) return true;
        const hasSets = (w?.exercises || []).some(ex => {
          const sets = ex?.setDetails?.length ?? ex?.sets ?? 0;
          return sets > 0;
        });
        return hasSets;
      });
    },

    getWorkoutsByType(type) {
      return this.workouts.filter(w => w.type === type);
    }
  }
});
