import axios from "axios";
import { apiUrl, createResourceApi } from "./http";
import { 
  cacheExercises, 
  getAllExercisesOffline,
  saveExerciseOffline,
  getExerciseOffline,
  isOnline
} from "@/utils/offlineStorage";
import { logger } from "@/utils/logger";

// Web: relativ über /api; Mobile (Capacitor): VITE_API_BASE + /api
const API_URL = apiUrl('exercises');
if (typeof window !== 'undefined') {
  logger.info('[ExercisesAPI] baseURL =', API_URL);
}

// Axios-Instance für Exercises (timeout für offline-first: schnell aufgeben, Fallback nutzen)
const api = createResourceApi('exercises', { timeout: 5000 });

function isLikelyTransportError(error) {
  const code = String(error?.code || '').toUpperCase()
  return code === 'ERR_NETWORK' || code === 'ECONNABORTED' || !error?.response
}

// Alle Übungen abrufen – optional mit einfachen Query-Filtern
export async function fetchExercises(filters = {}) {
  try {
    const params = new URLSearchParams();
    if (filters.category) params.append('category', filters.category);
    if (filters.muscleGroup) params.append('muscleGroup', filters.muscleGroup);
    if (filters.equipment) params.append('equipment', filters.equipment);

    const query = params.toString();
    const res = await api.get(query ? `/?${query}` : '/');
    
    // Bei erfolgreichem Response: Cache für Offline
    if (Array.isArray(res.data) && res.data.length > 0) {
      await cacheExercises(res.data);
      logger.debug('💾 Exercises API - Cached:', res.data.length, 'exercises');
    }
    
    return res.data;
  } catch (error) {
    // Bei Netzwerkfehlern: Fallback zu Offline-Daten
    if (!error.response || !isOnline()) {
      const transportIssue = isLikelyTransportError(error) && isOnline()
      logger.warn(
        transportIssue
          ? '📡 Exercises API - Netzwerk/Transportproblem, lade aus Cache'
          : '📡 Exercises API - Offline, lade aus Cache',
        {
          code: error?.code || null,
          status: error?.response?.status || null,
          online: isOnline()
        }
      );
      const cached = await getAllExercisesOffline(filters);
      logger.debug('📦 Exercises API - Offline Cache:', cached.length, 'exercises');
      return cached;
    }
    throw error;
  }
}

// Einzelne Übung abrufen (nur nutzen, wenn Backend diese Route unterstützt)
export async function fetchExercise(exerciseId) {
  try {
    const res = await api.get(`/${exerciseId}`);
    
    // Cache für Offline
    if (res.data) {
      await saveExerciseOffline(res.data);
    }
    
    return res.data;
  } catch (error) {
    // Bei Netzwerkfehlern: Fallback zu Offline-Daten
    if (!error.response || !isOnline()) {
      const transportIssue = isLikelyTransportError(error) && isOnline()
      logger.warn(
        transportIssue
          ? '📡 Exercises API - Netzwerk/Transportproblem, lade Exercise aus Cache:'
          : '📡 Exercises API - Offline, lade Exercise aus Cache:',
        exerciseId
      );
      const cached = await getExerciseOffline(exerciseId);
      if (cached) {
        return cached;
      }
    }
    throw error;
  }
}

// Bild uploaden/ersetzen
export async function uploadExerciseImage(exerciseId, file, token) {
  const form = new FormData();
  form.append('image', file);
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    // Primäre Route
    const res = await axios.post(`${API_URL}/${exerciseId}/image`, form, { headers });
    return res.data;
  } catch (err1) {
    try {
      // Alias-Route
      const res2 = await axios.post(`${API_URL}/image/${exerciseId}`, form, { headers });
      return res2.data;
    } catch (err2) {
      // JSON-Fallback mit Data-URL
      const dataUrl = await fileToDataURL(file);
      const jsonHeaders = { ...headers, 'Content-Type': 'application/json' };
      const res3 = await axios.put(`${API_URL}/${exerciseId}/photo`, { imageData: dataUrl }, { headers: jsonHeaders });
      return res3.data;
    }
  }
}

async function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Bild löschen (optional)
export async function deleteExerciseImage(exerciseId, token) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await axios.delete(`${API_URL}/${exerciseId}/image`, { headers });
  return res.data;
}

// Alle Kategorien (Client-seitig genutzt)
export const EXERCISE_CATEGORIES = [
  'Push', 'Pull', 'Legs', 'Core', 'Cardio'
];

// Alle Muskelgruppen (Client-seitig genutzt)
export const MUSCLE_GROUPS = [
  'Brust', 'Schultern', 'Trizeps',
  'Rücken', 'Bizeps',
  'Quadrizeps', 'Hamstrings', 'Gesäß', 'Waden',
  'Bauch', 'Core',
  'Cardio'
];

// Equipment-Typen (Client-seitig genutzt)
export const EQUIPMENT_TYPES = [
  'Hanteln', 'Langhantel', 'Kurzhanteln',
  'Kabelzug', 'Maschine', 'Körpergewicht',
  'Kettlebell', 'Resistance Band', 'Cardio-Gerät'
];