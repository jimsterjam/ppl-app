import { createResourceApi } from "./http";
import { handleAPIError } from "./errorHandler";
import { 
  cacheWorkouts, 
  getAllWorkoutsOffline, 
  saveWorkoutOffline,
  getWorkoutOffline,
  deleteWorkoutOffline,
  queueAction,
  isOnline,
  purgeServerDeletedWorkouts,
  clearWorkoutTombstones
} from "@/utils/offlineStorage";
import { logger } from "@/utils/logger";

// API Basis-URL
const WORKOUTS_TIMEOUT_MS = Number.parseInt(import.meta.env.VITE_WORKOUTS_TIMEOUT_MS || '', 10) || 25000
const api = createResourceApi('workouts', { timeout: WORKOUTS_TIMEOUT_MS });

const CREATE_RETRY_DELAY_MS = Number.parseInt(import.meta.env.VITE_WORKOUTS_CREATE_RETRY_DELAY_MS || '', 10) || 1200
// Kürzerer Timeout speziell für Create-Requests: schneller Offline-Fallback statt 25s warten
const WORKOUTS_CREATE_TIMEOUT_MS = Number.parseInt(import.meta.env.VITE_WORKOUTS_CREATE_TIMEOUT_MS || '', 10) || 60000
const STATS_RETRY_DELAY_MS = Number.parseInt(import.meta.env.VITE_WORKOUTS_STATS_RETRY_DELAY_MS || '', 10) || 1000

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function shouldUseOfflineCreateFallback(error) {
  const status = Number(error?.response?.status || 0)
  if (!status) return true
  return [408, 425, 429, 500, 502, 503, 504].includes(status)
}

function shouldUseOfflineUpdateFallback(error) {
  const status = Number(error?.response?.status || 0)
  if (!status) return true
  return [408, 425, 429, 500, 502, 503, 504].includes(status)
}

function shouldRetryCreateRequest(error) {
  if (!error) return false
  const status = Number(error?.response?.status || 0)
  if ([408, 425, 429, 500, 502, 503, 504].includes(status)) return true
  const code = String(error?.code || '').toUpperCase()
  // Weder ERR_NETWORK noch ECONNABORTED dürfen retryen:
  // Der Server könnte den Request bereits verarbeitet haben, Response ging nur verloren.
  // Ein Retry würde ein Duplikat-Workout erzeugen. → Direkt Offline-Fallback.
  return false
}

function isLikelyTransportError(error) {
  const code = String(error?.code || '').toUpperCase()
  return code === 'ERR_NETWORK' || code === 'ECONNABORTED' || !error?.response
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

// ---------------------------
// Workouts abrufen
// ---------------------------
export async function fetchWorkouts(token = null, userId = null) {
  try {
    const config = {
      validateStatus: (status) => (status >= 200 && status < 300) || [404, 204, 500].includes(status)
    };
    if (token) config.headers = { Authorization: `Bearer ${token}` };

    const res = await api.get("", config);
    if (!res || [404, 204].includes(res.status)) return [];
    if (res.status === 500) {
      // Server-Fehler (z.B. Render Cold-Start / MongoDB nicht bereit) → lokalen Cache nutzen
      logger.warn('⚠️ Workouts API - Server 500, lade aus lokalem Cache');
      const cached = userId ? await getAllWorkoutsOffline({ userId }) : [];
      logger.debug('📦 Workouts API - Server-Error Fallback Cache:', cached.length, 'workouts');
      return cached;
    }

    if (Array.isArray(res.data) && res.data.length > 0) {
      await cacheWorkouts(res.data);
      // Fix #3: Lokale Workouts bereinigen, die der Server nicht mehr kennt
      const serverIds = res.data.map(w => String(w?._id || '').trim()).filter(Boolean)
      // Server hat diese IDs bestätigt → Tombstones entfernen falls fälschlicherweise gesetzt
      clearWorkoutTombstones(serverIds)
      await purgeServerDeletedWorkouts(serverIds, userId || '').catch(() => {})
      logger.debug('💾 Workouts API - Cached:', res.data.length, 'workouts');
    }

    return Array.isArray(res.data) ? res.data : [];
  } catch (error) {
    const errorStatus = Number(error?.response?.status || 0)
    const isServerError = errorStatus >= 500 && errorStatus < 600
    if (!error.response || !isOnline() || isServerError) {
      const transportIssue = isLikelyTransportError(error) && isOnline()
      logger.warn(
        isServerError
          ? `⚠️ Workouts API - Server ${errorStatus}, lade aus Cache`
          : transportIssue
            ? '📡 Workouts API - Netzwerk/Transportproblem, lade aus Cache'
            : '📡 Workouts API - Offline, lade aus Cache',
        {
          code: error?.code || null,
          status: errorStatus || null,
          online: isOnline()
        }
      );
      const cached = userId
        ? await getAllWorkoutsOffline({ userId })
        : [];
      logger.debug('📦 Workouts API - Offline Cache:', cached.length, 'workouts');
      return cached;
    }
    throw handleAPIError(error, 'Workouts laden', { showToast: false });
  }
}

export async function fetchLatestWorkoutsForRecovery(token = null, userId = null, limit = 7) {
  const safeLimit = Math.max(1, Math.min(10, Number(limit) || 7))
  try {
    const config = {
      validateStatus: (status) => (status >= 200 && status < 300) || [404, 204, 500].includes(status)
    }
    if (token) config.headers = { Authorization: `Bearer ${token}` }

    const res = await api.get("", config)
    if (!res || [404, 204].includes(res.status)) return []
    if (res.status === 500) {
      const cached = userId ? await getAllWorkoutsOffline({ userId }) : []
      return cached.slice(0, safeLimit)
    }

    const list = Array.isArray(res.data) ? res.data : []
    const scoped = userId
      ? list.filter((w) => String(w?.userId || '') === String(userId || '').trim())
      : list

    const latest = [...scoped]
      .sort((a, b) => new Date(b?.updatedAt || b?.date || b?.createdAt || 0) - new Date(a?.updatedAt || a?.date || a?.createdAt || 0))
      .slice(0, safeLimit)

    await Promise.all(latest.map(async (workout) => {
      try {
        await saveWorkoutOffline({
          ...workout,
          _offlineCreated: false,
          _syncedAt: new Date().toISOString()
        })
      } catch {}
    }))

    return latest
  } catch (error) {
    if (!error.response || !isOnline()) {
      const cached = userId
        ? await getAllWorkoutsOffline({ userId })
        : []
      return [...cached]
        .sort((a, b) => new Date(b?.updatedAt || b?.date || b?.createdAt || 0) - new Date(a?.updatedAt || a?.date || a?.createdAt || 0))
        .slice(0, safeLimit)
    }
    throw handleAPIError(error, 'Workouts Recovery laden', { showToast: false })
  }
}

// Einzelnes Workout abrufen
export async function fetchWorkout(workoutId, token = null) {
  try {
    logger.debug('📡 Workouts API - fetchWorkout start:', { workoutId, hasToken: !!token })
    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    const res = await api.get(`/${workoutId}`, config);

    if (res.data) await saveWorkoutOffline(res.data);
    logger.debug('✅ Workouts API - fetchWorkout success:', {
      workoutId,
      returnedId: res?.data?._id || null,
      hasData: !!res?.data
    })
    return res.data;
  } catch (error) {
    const transportIssue = isLikelyTransportError(error) && isOnline()
    logger.warn('⚠️ Workouts API - fetchWorkout failed, checking offline fallback:', {
      workoutId,
      message: error?.message,
      status: error?.response?.status || null,
      code: error?.code || null,
      transportIssue,
      online: isOnline()
    })
    if (!error.response || !isOnline()) {
      logger.warn(
        transportIssue
          ? '📡 Workouts API - Netzwerk/Transportproblem, lade Workout aus Cache:'
          : '📡 Workouts API - Offline, lade Workout aus Cache:',
        workoutId
      );
      const cached = await getWorkoutOffline(workoutId);
      if (cached) return cached;
    }
    throw handleAPIError(error, 'Workout laden');
  }
}

// KI-generiertes Workout anhand eines kurzen Fragebogens (Ziel, Level, Equipment etc.)
export async function quickGenerateWorkout(context, token = null) {
  try {
    const config = {
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      timeout: 45000
    }
    const res = await api.post('/quick-generator', context, config)
    return res.data
  } catch (error) {
    logger.warn('⚠️ Workouts API - quickGenerateWorkout failed:', error?.message)
    throw handleAPIError(error, 'Workout generieren', { showToast: false })
  }
}

// Liste aller Workouts mit gespeichertem AI-Feedback (chronologisch, neueste zuerst)
// timeoutMs: optionaler, kürzerer Timeout als der globale WORKOUTS_TIMEOUT_MS (25s) -
// diese Liste wird i.d.R. im Hintergrund nachgeladen (siehe AIFeedbackHistory.vue
// cache-first), es lohnt sich also nicht, bei einem kalt startenden Server (Render Free-Tier
// Cold-Start) die vollen 25s + LAN-Fallback-Versuch abzuwarten, bevor der Nutzer eine
// Fehler-/Retry-Möglichkeit sieht.
export async function fetchWorkoutFeedbacks(token = null, { page = 1, limit = 20, timeoutMs } = {}) {
  try {
    const config = {
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      params: { page, limit },
      ...(Number.isFinite(timeoutMs) && timeoutMs > 0 ? { timeout: timeoutMs } : {})
    }
    const res = await api.get('/feedbacks', config)
    return res.data
  } catch (error) {
    logger.warn('⚠️ Workouts API - fetchWorkoutFeedbacks failed:', error?.message)
    throw handleAPIError(error, 'Feedbacks laden', { showToast: false })
  }
}

// Feature "Feedback später bewerten": manuelles Anstoßen der KI-Analyse für ein Workout, das
// beim Speichern bewusst ohne automatisches Feedback gespeichert wurde (siehe
// ai_feedback_status in models/Workout.js) - aufgerufen aus AIFeedbackHistory.vue über den
// "Jetzt generieren"-Button. Derselbe Endpunkt wie der automatische Aufruf aus
// PostWorkoutSummary.vue (POST /:id/ai-analysis), hier nur als wiederverwendbare Funktion statt
// einer eigenen axios-Instanz, wie es der Rest dieser Datei bereits macht.
export async function requestAiAnalysis(workoutId, token = null, { timeoutMs } = {}) {
  try {
    const config = {
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      ...(Number.isFinite(timeoutMs) && timeoutMs > 0 ? { timeout: timeoutMs } : {})
    }
    const res = await api.post(`/${workoutId}/ai-analysis`, {}, config)
    return res.data
  } catch (error) {
    logger.warn('⚠️ Workouts API - requestAiAnalysis failed:', error?.message)
    throw handleAPIError(error, 'KI-Analyse anfordern', { showToast: false })
  }
}

// Neues Workout erstellen / offline fallback
export async function createWorkout(workoutData, token = null, options = {}) {
  const skipOfflineQueue = options?.skipOfflineQueue === true
  const requestId = `cw_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

  logger.debug('📤 Workouts API - createWorkout start', {
    requestId,
    skipOfflineQueue,
    online: isOnline(),
    hasToken: !!token,
    type: workoutData?.type,
    exercises: Array.isArray(workoutData?.exercises) ? workoutData.exercises.length : 0
  })

  if (skipOfflineQueue) {
    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {}
    const res = await api.post("", workoutData, config)
    logger.debug('✅ Workouts API - createWorkout direct success', {
      requestId,
      status: res?.status || null,
      id: res?.data?._id || null
    })
    return res.data
  }
  // Online zuerst direkt speichern, um doppelte Queue-Create-Einträge zu vermeiden.
  if (isOnline()) {
    try {
      const config = {
        ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
        timeout: WORKOUTS_CREATE_TIMEOUT_MS
      };
      const res = await api.post("", workoutData, config);
      logger.debug('📥 Workouts API - createWorkout online response', {
        requestId,
        status: res?.status || null,
        hasData: !!res?.data,
        id: res?.data?._id || null
      })
      if (res.data && res.data._id) {
        const syncedWorkout = {
          ...res.data,
          userId: workoutData?.userId || res.data?.userId || null,
          _offlineCreated: false,
          _syncedAt: new Date().toISOString()
        }
        await saveWorkoutOffline(syncedWorkout);
        logger.debug('✅ Workouts API - Workout online gespeichert & lokal aktualisiert', {
          requestId,
          realId: res.data._id
        });
        return syncedWorkout;
      }
      // Falls keine Daten zurückkommen, fallback unten verwenden
    } catch (error) {
      let effectiveError = error
      if (shouldRetryCreateRequest(error)) {
        logger.warn('⚠️ Workouts API - createWorkout erster Versuch fehlgeschlagen, retrye einmal', {
          requestId,
          message: error?.message,
          code: error?.code || null,
          status: Number(error?.response?.status || 0) || null
        })
        try {
          await sleep(CREATE_RETRY_DELAY_MS)
          const retryConfig = {
            ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
            timeout: WORKOUTS_CREATE_TIMEOUT_MS
          }
          const retryRes = await api.post("", workoutData, retryConfig)
          if (retryRes?.data && retryRes.data._id) {
            const retriedWorkout = {
              ...retryRes.data,
              userId: workoutData?.userId || retryRes.data?.userId || null,
              _offlineCreated: false,
              _syncedAt: new Date().toISOString()
            }
            await saveWorkoutOffline(retriedWorkout)
            logger.debug('✅ Workouts API - createWorkout retry success', {
              requestId,
              id: retryRes.data._id
            })
            return retriedWorkout
          }
        } catch (retryError) {
          effectiveError = retryError
        }
      }

      const status = Number(effectiveError?.response?.status || 0)
      logger.error('❌ Workouts API - Fehler beim Online-Speichern, bleibt offline:', {
        requestId,
        message: effectiveError?.message,
        code: effectiveError?.code || null,
        status: status || null,
        method: effectiveError?.config?.method || null,
        url: effectiveError?.config?.url || null,
        baseURL: effectiveError?.config?.baseURL || null,
        timeout: effectiveError?.config?.timeout || null,
        serverError: effectiveError?.response?.data || null
      });

      if (!shouldUseOfflineCreateFallback(effectiveError)) {
        throw handleAPIError(effectiveError, 'Workout speichern', { showToast: false })
      }

      // Nur bei Netzwerk-/Transient-Fehlern offline fallbacken.
    }
  }

  // Offline-Fallback (oder Online-Fehler): lokal speichern und in Queue legen.
  const tempId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const offlineWorkout = {
    ...workoutData,
    userId: workoutData?.userId || null,
    _id: tempId,
    _offlineCreated: true,
    createdAt: new Date().toISOString()
  };
  await saveWorkoutOffline(offlineWorkout);
  await queueAction('create', 'workout', offlineWorkout);
  logger.debug('💾 Workouts API - Workout offline erstellt/gequeued', {
    requestId,
    tempId
  });

  return offlineWorkout;
}

// Workout aktualisieren
export async function updateWorkout(workoutId, workoutData, token = null) {
  if (!isOnline()) {
    const existingWorkout = await getWorkoutOffline(workoutId);
    const offlineWorkout = {
      ...existingWorkout,
      ...workoutData,
      _id: workoutId,
      userId: workoutData?.userId || existingWorkout?.userId || null,
      _offlineUpdated: true,
      createdAt: new Date().toISOString()
    };
    await saveWorkoutOffline(offlineWorkout);
    await queueAction('update', 'workout', offlineWorkout);
    logger.debug('💾 Workouts API - Workout offline aktualisiert:', workoutId);
    return offlineWorkout;
  }

  try {
    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    const res = await api.put(`/${workoutId}`, workoutData, config);
    if (res.data) await saveWorkoutOffline(res.data);
    return res.data;
  } catch (error) {
    if (!shouldUseOfflineUpdateFallback(error)) {
      throw handleAPIError(error, 'Workout aktualisieren', { showToast: false })
    }

    logger.error('❌ Workouts API - Update fehlgeschlagen, nutze Offline-Fallback:', error.message);
    const existingWorkout = await getWorkoutOffline(workoutId);
    const offlineWorkout = {
      ...existingWorkout,
      ...workoutData,
      _id: workoutId,
      userId: workoutData?.userId || existingWorkout?.userId || null,
      _offlineUpdated: true,
      _failedOnline: true,
      updatedAt: new Date().toISOString()
    };
    await saveWorkoutOffline(offlineWorkout);
    await queueAction('update', 'workout', offlineWorkout);
    logger.debug('💾 Workouts API - Workout als Fallback offline aktualisiert:', workoutId);
    return offlineWorkout;
  }
}

// Workout abschließen
export async function completeWorkout(workoutId, completedAt = null, token = null) {
  if (!isOnline()) {
    const currentWorkout = await getWorkoutOffline(workoutId);
    const offlineWorkout = { ...(currentWorkout || {}), _id: workoutId, completed: true, completedAt: completedAt || new Date().toISOString(), _offlineUpdated: true };
    await saveWorkoutOffline(offlineWorkout);
    await queueAction('update', 'workout', offlineWorkout);
    logger.debug('💾 Workouts API - Workout offline als completed markiert:', workoutId);
    return offlineWorkout;
  }

  try {
    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    const payload = { completed: true, ...(completedAt && { completedAt }) };
    const res = await api.put(`/${workoutId}`, payload, config);
    if (res.data) await saveWorkoutOffline(res.data);
    return res.data;
  } catch (error) {
    throw handleAPIError(error, 'Workout abschließen');
  }
}

// Workout löschen
export async function deleteWorkout(workoutId, token = null) {
  const id = String(workoutId || '').trim()
  const isLocalOnlyId = id.startsWith('offline_') || id.startsWith('draft-') || id === 'draft' || id === 'workout_detail_draft'

  if (!isOnline() || isLocalOnlyId) {
    await deleteWorkoutOffline(workoutId);
    logger.debug('🗑️ Workouts API - Workout offline gelöscht:', workoutId);
    return { success: true, _id: workoutId };
  }

  try {
    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    const res = await api.delete(`/${workoutId}`, config);
    await deleteWorkoutOffline(workoutId);
    return res.data;
  } catch (error) {
    const status = Number(error?.response?.status || 0)
    if (status === 404 || status === 410) {
      logger.debug('🗑️ Workouts API - Workout serverseitig bereits gelöscht, räume lokal auf:', workoutId)
      await deleteWorkoutOffline(workoutId)
      return { success: true, _id: workoutId, alreadyDeleted: true }
    }

    logger.info('Workouts API - Delete online fehlgeschlagen, nutze lokalen Fallback', {
      workoutId,
      message: error?.message,
      code: error?.code || null,
      status: status || null
    })
    try {
      await deleteWorkoutOffline(workoutId)
      await queueAction('delete', 'workout', {
        _id: workoutId,
        userId: parseUidFromToken(token) || null,
        _failedOnlineDelete: true
      })
      return { success: true, _id: workoutId, offlineFallback: true }
    } catch {
      throw handleAPIError(error, 'Workout löschen')
    }
  }
}

// Workout-Statistiken
export async function fetchWorkoutStats(token = null) {
  try {
    const config = { validateStatus: (status) => (status >= 200 && status < 300) || [404, 204, 500].includes(status) };
    if (token) config.headers = { Authorization: `Bearer ${token}` };
    const res = await api.get("/stats/overview", config);
    if (!res || [404, 204, 500].includes(res.status)) return null;
    return res.data ?? null;
  } catch {
    return null;
  }
}

export async function fetchWorkoutProgressStats(token = null, params = {}) {
  try {
    const config = {
      params,
      validateStatus: (status) => (status >= 200 && status < 300) || [403, 404, 204, 500].includes(status)
    };
    if (token) config.headers = { Authorization: `Bearer ${token}` };
    const res = await api.get("/stats/progress", config);
    if (!res || [404, 204, 500].includes(res.status)) return null;
    if (res.status === 403) {
      return {
        __forbidden: true,
        __status: 403,
        code: String(res?.data?.code || ''),
        entitlement: res?.data?.entitlement || null
      }
    }
    return res.data ?? null;
  } catch (error) {
    if (shouldRetryCreateRequest(error)) {
      try {
        await sleep(STATS_RETRY_DELAY_MS)
        const retryConfig = {
          params,
          validateStatus: (status) => (status >= 200 && status < 300) || [403, 404, 204, 500].includes(status)
        }
        if (token) retryConfig.headers = { Authorization: `Bearer ${token}` }
        const retryRes = await api.get("/stats/progress", retryConfig)
        if (!retryRes || [404, 204, 500].includes(retryRes.status)) return null
        if (retryRes.status === 403) {
          return {
            __forbidden: true,
            __status: 403,
            code: String(retryRes?.data?.code || ''),
            entitlement: retryRes?.data?.entitlement || null
          }
        }
        return retryRes.data ?? null
      } catch (retryError) {
        if (isLikelyTransportError(retryError)) {
          logger.warn('📡 Workouts API - Progress-Stats Netzwerk/Transportproblem, nutze Cache-Fallback', {
            code: retryError?.code || null,
            status: retryError?.response?.status || null,
            online: isOnline()
          })
          return null
        }
        throw handleAPIError(retryError, 'Progress-Stats laden', { showToast: false })
      }
    }

    if (isLikelyTransportError(error)) {
      logger.warn('📡 Workouts API - Progress-Stats Netzwerk/Transportproblem, nutze Cache-Fallback', {
        code: error?.code || null,
        status: error?.response?.status || null,
        online: isOnline()
      })
      return null
    }

    throw handleAPIError(error, 'Progress-Stats laden', { showToast: false });
  }
}

// Alle Workouts löschen
export async function deleteAllWorkouts(token = null) {
  try {
    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    const res = await api.delete("", { ...config, validateStatus: () => true });
    // Graceful handling: wenn Server 200/204 liefert, Daten zurückgeben
    if (res.status >= 200 && res.status < 300) {
      return res.data || { deletedCount: 0 };
    }
    // Wenn DB nicht verbunden oder andere Serverantwort: nicht als Fehler werfen
    return res.data || { deletedCount: 0 };
  } catch (error) {
    // Nicht hart abbrechen – Client-Cleanup läuft weiter
    logger.warn('⚠️ Workouts API - Server-Delete fehlgeschlagen, fahre mit lokalem Cleanup fort');
    return { deletedCount: 0 };
  }
}
