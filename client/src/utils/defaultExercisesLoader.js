import { normalizeDefaultExercises } from '@/utils/normalizeDefaultExercises'

let cachedExercises = null
let loadPromise = null

export async function loadDefaultExercises() {
  if (cachedExercises) return cachedExercises
  if (loadPromise) return loadPromise

  loadPromise = fetch('/data/default-exercises.json')
    .then(async (response) => {
      if (!response.ok) {
        throw new Error('Default exercises nicht verfügbar')
      }
      const json = await response.json()
      cachedExercises = normalizeDefaultExercises(json)
      return cachedExercises
    })
    .finally(() => {
      loadPromise = null
    })

  return loadPromise
}

export function getCachedDefaultExercises() {
  return Array.isArray(cachedExercises) ? cachedExercises : []
}
