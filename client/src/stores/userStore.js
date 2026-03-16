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
  db
} from '@/utils/offlineStorage'
import {
  fetchWorkouts,
  fetchWorkoutProgressStats,
  createWorkout as createWorkoutApi,
  updateWorkout as updateWorkoutApi
} from '@/api/workouts'

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
      const workouts = Array.isArray(list) ? list.filter(w => w && !w._isDraft) : []
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
        this.workouts = []
        this.workoutsLoaded = true
        this.workoutsLoadedAt = Date.now()
        this.loadingWorkouts = false
        return []
      }

      if (workoutsLoadPromise && workoutsLoadPromiseUid === activeUid) {
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
          const previousDrafts = (this.workouts || [])
            .filter(w => (w?._isDraft === true || w?.isDraft === true) && w?.completed !== true)
            .filter(w => !isDraftDeleted(w?._id))
            .map(w => ({ ...w, _isDraft: true, isDraft: true, completed: false }))

          const workouts = await fetchWorkouts(token, activeUid);
          this.workouts = filterOutDeletedDrafts(filterDeletedWorkouts(Array.isArray(workouts) ? workouts : []), 'server-fetch');
          this.workouts = filterByUserId(this.workouts, activeUid)
          // Setze completed: false für Workouts ohne completed Feld (Migration)
          this.workouts = this.workouts.map(w => ({
            ...w,
            completed: w.completed !== undefined ? w.completed : false,
            _isDraft: w._isDraft === true || w?.isDraft === true,
            isDraft: w._isDraft === true || w?.isDraft === true
          }));
          this.workoutsLoaded = true;
          this.workoutsLoadedAt = Date.now();
          logger.debug(`✅ [API] Loaded ${this.workouts.length} workouts from server:`, this.workouts.map(w => ({ _id: w._id, name: w.name, completed: w.completed, isDraft: w.isDraft })));

          // Lokale Offline-Workouts behalten (z.B. direkt gestartete Sessions)
          try {
            const offlineAll = await getAllWorkoutsOffline({ userId: activeUid });
            const offlineCreated = offlineAll.filter(w =>
              (String(w?._id || '').startsWith('offline_') || w?._offlineCreated)
              && activeUid
              && String(w?.userId || '') === activeUid
            );
            const existingIds = new Set(this.workouts.map(w => w._id));
            offlineCreated.forEach(w => {
              if (!existingIds.has(w._id)) this.workouts.unshift(w);
            });

            previousDrafts.forEach((draft) => {
              if (isDraftDeleted(draft?._id)) return
              const idx = this.workouts.findIndex(w => String(w?._id || '') === String(draft?._id || ''))
              if (idx !== -1) {
                this.workouts[idx] = { ...this.workouts[idx], ...draft, _isDraft: true, isDraft: true, completed: false }
              } else {
                this.workouts.unshift({ ...draft, _isDraft: true, isDraft: true, completed: false })
              }
            })

            const offlineDrafts = filterOutDeletedDrafts(
              offlineAll.filter(w =>
                (w?._isDraft === true || w?.isDraft === true)
                && w?.completed !== true
                && (!activeUid || String(w?.userId || '') === activeUid)
              ),
              'offline-drafts-merge'
            )
            offlineDrafts.forEach((draft) => {
              const idx = this.workouts.findIndex(w => String(w?._id || '') === String(draft?._id || ''))
              const normalizedDraft = { ...draft, _isDraft: true, isDraft: true, completed: false }
              if (idx !== -1) {
                this.workouts[idx] = { ...this.workouts[idx], ...normalizedDraft }
              } else {
                this.workouts.unshift(normalizedDraft)
              }
            })
          } catch (e) {
            logger.warn('⚠️ [Offline] Konnte lokale Workouts nicht mergen:', e);
          }

          try {
            await cacheWorkouts(this.workouts);
          } catch (e) {
            logger.warn('⚠️ [Offline] Konnte Workouts nicht cachen:', e);
          }

          this.workouts = this.applyWorkoutLimit(this.workouts, 3)

          return this.workouts;
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
          this.workouts = [];
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
        if (stats) {
          this.stats = stats;
          localStorage.setItem(statsCacheKey, JSON.stringify(stats));
          logger.debug('✅ [API] Progress Stats geladen:', {
            sessions: stats?.kpis?.sessions,
            weeks: stats?.weeks?.length || 0
          });
        } else {
          this.stats = readCachedStats();
          logger.debug('ℹ️ [userStore] Keine frischen Stats, nutze Cache:', !!this.stats);
        }
        return this.stats;
      } catch (error) {
        logger.error('❌ [API] Fehler beim Laden der Progress Stats:', error);
        this.statsErrorCode = Number(error?.statusCode || error?.response?.status || error?.context?.originalError?.response?.status || 0) || null;
        this.error = error?.message || 'Fehler beim Laden der Progress Stats';
        this.stats = readCachedStats();
        if (this.stats) this.error = null;
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
          logger.debug('✅ [API] Workout created:', newWorkout._id)
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
