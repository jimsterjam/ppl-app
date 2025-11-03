import axios from "axios";

// Immer relative URL verwenden; im Dev leitet der Vite-Proxy auf 3001
const API_URL = `/api/exercises`;
if (typeof window !== 'undefined') {
  // eslint-disable-next-line no-console
  console.info('[ExercisesAPI] baseURL =', API_URL);
}

// Axios-Instance für Exercises
const api = axios.create({ baseURL: API_URL });

// Alle Übungen abrufen – optional mit einfachen Query-Filtern
export async function fetchExercises(filters = {}) {
  const params = new URLSearchParams();
  if (filters.category) params.append('category', filters.category);
  if (filters.muscleGroup) params.append('muscleGroup', filters.muscleGroup);
  if (filters.equipment) params.append('equipment', filters.equipment);

  const query = params.toString();
  const res = await api.get(query ? `/?${query}` : '/');
  return res.data;
}

// Einzelne Übung abrufen (nur nutzen, wenn Backend diese Route unterstützt)
export async function fetchExercise(exerciseId) {
  const res = await api.get(`/${exerciseId}`);
  return res.data;
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