import axios from "axios";

// Dev: über Vite-Proxy, Prod: relativ hinter gleichem Origin
const API_URL = "/api/exercises";

// Axios-Instance für Exercises (aktuell ohne zwingende Auth)
const api = axios.create({
  baseURL: API_URL
});

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