import { normalizeDefaultExercises } from '@/utils/normalizeDefaultExercises'
import { logger } from '@/utils/logger'
import { curateDefaultExercises } from '@/utils/exerciseCuration'
import bundledDefaultExercises from '@/data/default-exercises.json'

let cachedExercises = null
let loadPromise = null

const ENABLE_CURATION = String(import.meta.env.VITE_EXERCISE_CURATION_ENABLED || '1').trim() !== '0'
const ENABLE_EXOTIC_FILTER = String(import.meta.env.VITE_EXERCISE_EXOTIC_FILTER_ENABLED || '1').trim() !== '0'

export async function loadDefaultExercises() {
  if (cachedExercises) {
    logger.debug('[DefaultExercises] Returning cached:', cachedExercises.length)
    return cachedExercises
  }
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    // Primary: static bundled JSON import (most robust in Capacitor WebView)
    try {
      logger.debug('[DefaultExercises] Using static bundled JSON...')
      const raw = bundledDefaultExercises
      logger.debug('[DefaultExercises] Static bundle result:', Array.isArray(raw) ? raw.length : typeof raw)
      if (Array.isArray(raw) && raw.length > 0) {
        const curated = curateDefaultExercises(raw, {
          enableCuration: ENABLE_CURATION,
          enableExoticFilter: ENABLE_EXOTIC_FILTER
        })
        cachedExercises = normalizeDefaultExercises(curated)
        logger.debug('[DefaultExercises] Normalized from static bundle:', cachedExercises.length)
        return cachedExercises
      }
    } catch (err) {
      logger.warn('[DefaultExercises] Static bundled JSON failed:', err?.message || err)
    }

    // Fallback: fetch from public directory (dev server, web)
    try {
      logger.debug('[DefaultExercises] Trying fetch fallback...')
      const response = await fetch('/data/default-exercises.json')
      if (response.ok) {
        const json = await response.json()
        if (Array.isArray(json) && json.length > 0) {
          const curated = curateDefaultExercises(json, {
            enableCuration: ENABLE_CURATION,
            enableExoticFilter: ENABLE_EXOTIC_FILTER
          })
          cachedExercises = normalizeDefaultExercises(curated)
          logger.debug('[DefaultExercises] Normalized from fetch:', cachedExercises.length)
          return cachedExercises
        }
      } else {
        logger.warn('[DefaultExercises] Fetch returned status:', response.status)
      }
    } catch (err) {
      logger.warn('[DefaultExercises] Fetch failed:', err?.message || err)
    }

    logger.error('[DefaultExercises] All sources failed — returning empty array')
    return []
  })().finally(() => {
    loadPromise = null
  })

  return loadPromise
}

export function getCachedDefaultExercises() {
  return Array.isArray(cachedExercises) ? cachedExercises : []
}
