import axios from "axios";
import { apiUrl } from "./http";
import { handleAPIError, withErrorHandling } from "./errorHandler";
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

// Web: relativ über /api; Mobile (Capacitor): VITE_API_BASE + /api
const API_URL = apiUrl('workouts');

// Axios-Instance für Workouts
const api = axios.create({ baseURL: API_URL });

// Alle Workouts abrufen
export async function fetchWorkouts(token = null) {
  try {
    const config = {
      // Behandle 404/204/500 als "keine Workouts" statt harter Fehler
      validateStatus: (status) => (status >= 200 && status < 300) || status === 404 || status === 204 || status === 500
    };
    if (token) {
      config.headers = { Authorization: `Bearer ${token}` };
    }

    // Verwende leeren Pfad, um trailing-slash-Inkompatibilitäten zu vermeiden
    const res = await api.get("", config);

    if (!res) return [];
    if (res.status === 404 || res.status === 204 || res.status === 500) return [];
    
    // Bei erfolgreichem Response: Cache für Offline
    if (Array.isArray(res.data) && res.data.length > 0) {
      await cacheWorkouts(res.data);
      logger.debug('💾 Workouts API - Cached:', res.data.length, 'workouts');
    }
    
    if (Array.isArray(res.data)) return res.data;
    // Falls Backend unerwartet kein Array liefert, sichere Rückgabe
    return [];
  } catch (error) {
    // Bei Netzwerkfehlern: Fallback zu Offline-Daten
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
    const config = {};
    if (token) {
      config.headers = { Authorization: `Bearer ${token}` };
    }
    const res = await api.get(`/${workoutId}`, config);
    
    // Cache für Offline
    if (res.data) {
      await saveWorkoutOffline(res.data);
    }
    
    return res.data;
  } catch (error) {
    // Bei Netzwerkfehlern: Fallback zu Offline-Daten
    if (!error.response || !isOnline()) {
      logger.warn('📡 Workouts API - Offline, lade Workout aus Cache:', workoutId);
      const cached = await getWorkoutOffline(workoutId);
      if (cached) {
        return cached;
      }
    }
    throw handleAPIError(error, 'Workout laden');
  }
}

// Neues Workout erstellen
export async function createWorkout(workoutData, token = null) {
  // Wenn explizit Offline: Speichere lokal und füge zur Sync Queue hinzu
  if (!isOnline()) {
    logger.warn('📡 Workouts API - Offline, erstelle Workout lokal');
    
    // Generiere temporäre ID
    const tempId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const offlineWorkout = {
      ...workoutData,
      _id: tempId,
      _offlineCreated: true,
      createdAt: new Date().toISOString()
    };
    
    // Speichere lokal
    await saveWorkoutOffline(offlineWorkout);
    
    // Füge zur Sync Queue hinzu
    await queueAction('create', 'workout', offlineWorkout);
    
    logger.debug('💾 Workouts API - Workout offline erstellt:', tempId);
    return offlineWorkout;
  }
  
  // Versuche API-Call (Online-Modus)
  try {
    const config = {};
    if (token) {
      config.headers = { Authorization: `Bearer ${token}` };
    }
    
    logger.debug('📡 Workouts API - Sende POST Request an Backend...');
    const res = await api.post("", workoutData, config);
    
    // Cache für Offline
    if (res.data) {
      await saveWorkoutOffline(res.data);
      logger.debug('✅ Workouts API - Workout erfolgreich erstellt:', res.data._id);
    }
    
    return res.data; // Erwartet das frisch erstellte Workout mit _id
  } catch (error) {
    // Fallback: Wenn API-Call fehlschlägt TROTZ Online-Status
    // (z.B. Server Error, Auth Error, Timeout)
    logger.error('❌ Workouts API - Fehler beim Erstellen, nutze Offline-Fallback:', error.message);
    
    // Erstelle Workout trotzdem lokal und füge zur Sync Queue
    const tempId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const offlineWorkout = {
      ...workoutData,
      _id: tempId,
      _offlineCreated: true,
      _failedOnline: true, // Markierung dass Online-Versuch fehlschlug
      createdAt: new Date().toISOString()
    };
    
    // Speichere lokal
    await saveWorkoutOffline(offlineWorkout);
    
    // Füge zur Sync Queue hinzu (wird später synchronisiert)
    await queueAction('create', 'workout', offlineWorkout);
    
    logger.debug('💾 Workouts API - Workout als Fallback offline erstellt:', tempId);
    return offlineWorkout;
  }
}

// Workout aktualisieren
export async function updateWorkout(workoutId, workoutData, token = null) {
  // Wenn explizit Offline: Speichere lokal und füge zur Sync Queue hinzu
  if (!isOnline()) {
    logger.warn('📡 Workouts API - Offline, aktualisiere Workout lokal');
    // Verhindere Fehler bei ungültigen IDs (z.B. draft, leer, undefined)
    if (!workoutId || workoutId === 'draft' || String(workoutId).startsWith('draft')) {
      logger.warn('⚠️ updateWorkout: Kein Offline-Save für temporäre oder leere ID:', workoutId)
      return { ...workoutData, _id: workoutId, _offlineUpdated: true, updatedAt: new Date().toISOString() }
    }
    const offlineWorkout = {
      ...workoutData,
      _id: workoutId,
      _offlineUpdated: true,
      updatedAt: new Date().toISOString()
    };
    // Update lokal
    await saveWorkoutOffline(offlineWorkout);
    // Füge zur Sync Queue hinzu
    await queueAction('update', 'workout', offlineWorkout);
    logger.debug('💾 Workouts API - Workout offline aktualisiert:', workoutId);
    return offlineWorkout;
  }
  
  // Versuche API-Call (Online-Modus)
  try {
    const config = {};
    if (token) {
      config.headers = { Authorization: `Bearer ${token}` };
    }
    const res = await api.put(`/${workoutId}`, workoutData, config);
    
    // Cache für Offline
    if (res.data) {
      await saveWorkoutOffline(res.data);
    }
    
    return res.data;
  } catch (error) {
    // Fallback: Wenn API-Call fehlschlägt TROTZ Online-Status
    logger.error('❌ Workouts API - Update fehlgeschlagen, nutze Offline-Fallback:', error.message);
    
    const offlineWorkout = {
      ...workoutData,
      _id: workoutId,
      _offlineUpdated: true,
      _failedOnline: true,
      updatedAt: new Date().toISOString()
    };
    
    // Update lokal
    await saveWorkoutOffline(offlineWorkout);
    
    // Füge zur Sync Queue hinzu
    await queueAction('update', 'workout', offlineWorkout);
    
    logger.debug('💾 Workouts API - Workout als Fallback offline aktualisiert:', workoutId);
    return offlineWorkout;
  }
}

// Workout als abgeschlossen markieren
export async function completeWorkout(workoutId, completedAt = null, token = null) {
  // Wenn Offline: Speichere lokal und füge zur Sync Queue hinzu
  if (!isOnline()) {
    logger.warn('📡 Workouts API - Offline, markiere Workout als completed lokal');
    
    // Hole aktuelles Workout aus Cache
    const currentWorkout = await getWorkoutOffline(workoutId);
    
    const offlineWorkout = {
      ...(currentWorkout || {}),
      _id: workoutId,
      completed: true,
      completedAt: completedAt || new Date().toISOString(),
      _offlineUpdated: true
    };
    
    // Update lokal
    await saveWorkoutOffline(offlineWorkout);
    
    // Füge zur Sync Queue hinzu
    await queueAction('update', 'workout', offlineWorkout);
    
    logger.debug('💾 Workouts API - Workout offline als completed markiert:', workoutId);
    return offlineWorkout;
  }
  
  try {
    const config = {};
    if (token) {
      config.headers = { Authorization: `Bearer ${token}` };
    }
    const payload = { completed: true };
    if (completedAt) payload.completedAt = completedAt;
    const res = await api.put(`/${workoutId}`, payload, config);
    
    // Cache für Offline
    if (res.data) {
      await saveWorkoutOffline(res.data);
    }
    
    return res.data;
  } catch (error) {
    throw handleAPIError(error, 'Workout abschließen');
  }
}

// Workout löschen
export async function deleteWorkout(workoutId, token = null) {
  // Wenn Offline: Lösche lokal und füge zur Sync Queue hinzu
  if (!isOnline()) {
    logger.warn('📡 Workouts API - Offline, lösche Workout lokal');
    
    // Lösche lokal
    await deleteWorkoutOffline(workoutId);
    
    // Füge zur Sync Queue hinzu
    await queueAction('delete', 'workout', { _id: workoutId });
    
    logger.debug('🗑️ Workouts API - Workout offline gelöscht:', workoutId);
    return { success: true, _id: workoutId };
  }
  
  try {
    const config = {};
    if (token) {
      config.headers = { Authorization: `Bearer ${token}` };
    }
    const res = await api.delete(`/${workoutId}`, config);
    
    // Lösche auch aus Cache
    await deleteWorkoutOffline(workoutId);
    
    return res.data;
  } catch (error) {
    throw handleAPIError(error, 'Workout löschen');
  }
}

// Workout-Statistiken abrufen
export async function fetchWorkoutStats(token = null) {
  try {
    const config = {
      validateStatus: (status) => (status >= 200 && status < 300) || status === 404 || status === 204 || status === 500
    };
    if (token) {
      config.headers = { Authorization: `Bearer ${token}` };
    }
    const res = await api.get("/stats/overview", config);
    if (!res) return null;
    if (res.status === 404 || res.status === 204 || res.status === 500) return null;
    return res.data ?? null;
  } catch (error) {
    // Bei Statistiken: null zurückgeben statt Error werfen
    return null;
  }
}

// ALLE Workouts des Users löschen (Danger Zone)
export async function deleteAllWorkouts(token = null) {
  try {
    const config = {};
    if (token) {
      config.headers = { Authorization: `Bearer ${token}` };
    }
    const res = await api.delete("", config); // DELETE /api/workouts
    return res.data;
  } catch (error) {
    throw handleAPIError(error, 'Alle Workouts löschen');
  }
}
