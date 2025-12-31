import axios from "axios";
import { apiUrl } from "./http";
import { handleAPIError } from "./errorHandler";
import { 
  cacheWorkouts, 
  getAllWorkoutsOffline, 
  saveWorkoutOffline,
  getWorkoutOffline,
  deleteWorkoutOffline,
  queueAction,
  isOnline
} from "@/utils/offlineStorage";
import { logger } from "@/utils/logger";

// API Basis-URL
const API_URL = apiUrl('workouts');
const api = axios.create({ baseURL: API_URL });

// ---------------------------
// Workouts abrufen
// ---------------------------
export async function fetchWorkouts(token = null) {
  try {
    const config = {
      validateStatus: (status) => (status >= 200 && status < 300) || [404, 204, 500].includes(status)
    };
    if (token) config.headers = { Authorization: `Bearer ${token}` };

    const res = await api.get("", config);
    if (!res || [404, 204, 500].includes(res.status)) return [];

    if (Array.isArray(res.data) && res.data.length > 0) {
      await cacheWorkouts(res.data);
      logger.debug('💾 Workouts API - Cached:', res.data.length, 'workouts');
    }

    return Array.isArray(res.data) ? res.data : [];
  } catch (error) {
    if (!error.response || !isOnline()) {
      logger.warn('📡 Workouts API - Offline, lade aus Cache');
      const cached = await getAllWorkoutsOffline();
      logger.debug('📦 Workouts API - Offline Cache:', cached.length, 'workouts');
      return cached;
    }
    throw handleAPIError(error, 'Workouts laden', { showToast: false });
  }
}

// Einzelnes Workout abrufen
export async function fetchWorkout(workoutId, token = null) {
  try {
    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    const res = await api.get(`/${workoutId}`, config);

    if (res.data) await saveWorkoutOffline(res.data);
    return res.data;
  } catch (error) {
    if (!error.response || !isOnline()) {
      logger.warn('📡 Workouts API - Offline, lade Workout aus Cache:', workoutId);
      const cached = await getWorkoutOffline(workoutId);
      if (cached) return cached;
    }
    throw handleAPIError(error, 'Workout laden');
  }
}

// Neues Workout erstellen / offline fallback
export async function createWorkout(workoutData, token = null) {
  if (!isOnline()) {
    const tempId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const offlineWorkout = { ...workoutData, _id: tempId, _offlineCreated: true, createdAt: new Date().toISOString() };
    await saveWorkoutOffline(offlineWorkout);
    await queueAction('create', 'workout', offlineWorkout);
    logger.debug('💾 Workouts API - Workout offline erstellt:', tempId);
    return offlineWorkout;
  }

  try {
    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    const res = await api.post("", workoutData, config);
    if (res.data) await saveWorkoutOffline(res.data);
    return res.data;
  } catch (error) {
    logger.error('❌ Workouts API - Fehler beim Erstellen, nutze Offline-Fallback:', error.message);
    const tempId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const offlineWorkout = { ...workoutData, _id: tempId, _offlineCreated: true, _failedOnline: true, createdAt: new Date().toISOString() };
    await saveWorkoutOffline(offlineWorkout);
    await queueAction('create', 'workout', offlineWorkout);
    logger.debug('💾 Workouts API - Workout als Fallback offline erstellt:', tempId);
    return offlineWorkout;
  }
}

// Workout aktualisieren
export async function updateWorkout(workoutId, workoutData, token = null) {
  if (!isOnline()) {
    const offlineWorkout = { ...workoutData, _id: workoutId, _offlineUpdated: true, createdAt: new Date().toISOString() };
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
    logger.error('❌ Workouts API - Update fehlgeschlagen, nutze Offline-Fallback:', error.message);
    const offlineWorkout = { ...workoutData, _id: workoutId, _offlineUpdated: true, _failedOnline: true, updatedAt: new Date().toISOString() };
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
  if (!isOnline()) {
    await deleteWorkoutOffline(workoutId);
    await queueAction('delete', 'workout', { _id: workoutId });
    logger.debug('🗑️ Workouts API - Workout offline gelöscht:', workoutId);
    return { success: true, _id: workoutId };
  }

  try {
    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    const res = await api.delete(`/${workoutId}`, config);
    await deleteWorkoutOffline(workoutId);
    return res.data;
  } catch (error) {
    throw handleAPIError(error, 'Workout löschen');
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
