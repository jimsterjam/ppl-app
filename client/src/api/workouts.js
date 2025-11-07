import axios from "axios";
import { apiUrl } from "./http";
import { handleAPIError, withErrorHandling } from "./errorHandler";

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
    if (Array.isArray(res.data)) return res.data;
    // Falls Backend unerwartet kein Array liefert, sichere Rückgabe
    return [];
  } catch (error) {
    // Bei Netzwerkfehlern: Leeres Array zurückgeben statt Error werfen
    if (!error.response) {
      return [];
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
    return res.data;
  } catch (error) {
    throw handleAPIError(error, 'Workout laden');
  }
}

// Neues Workout erstellen
export async function createWorkout(workoutData, token = null) {
  try {
    const config = {};
    if (token) {
      config.headers = { Authorization: `Bearer ${token}` };
    }
    const res = await api.post("", workoutData, config);
    return res.data; // Erwartet das frisch erstellte Workout mit _id
  } catch (error) {
    throw handleAPIError(error, 'Workout erstellen');
  }
}

// Workout aktualisieren
export async function updateWorkout(workoutId, workoutData, token = null) {
  try {
    const config = {};
    if (token) {
      config.headers = { Authorization: `Bearer ${token}` };
    }
    const res = await api.put(`/${workoutId}`, workoutData, config);
    return res.data;
  } catch (error) {
    throw handleAPIError(error, 'Workout aktualisieren');
  }
}

// Workout als abgeschlossen markieren
export async function completeWorkout(workoutId, completedAt = null, token = null) {
  try {
    const config = {};
    if (token) {
      config.headers = { Authorization: `Bearer ${token}` };
    }
    const payload = { completed: true };
    if (completedAt) payload.completedAt = completedAt;
    const res = await api.put(`/${workoutId}`, payload, config);
    return res.data;
  } catch (error) {
    throw handleAPIError(error, 'Workout abschließen');
  }
}

// Workout löschen
export async function deleteWorkout(workoutId, token = null) {
  try {
    const config = {};
    if (token) {
      config.headers = { Authorization: `Bearer ${token}` };
    }
    const res = await api.delete(`/${workoutId}`, config);
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
