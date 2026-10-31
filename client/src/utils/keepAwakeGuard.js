/**
 * Gemeinsamer, referenzgezählter Keep-Awake-Guard.
 *
 * @capacitor-community/keep-awake kennt nur einen globalen Ein/Aus-Zustand auf dem Gerät.
 * Mehrere unabhängige Stellen im Code (Pausen-Timer, Workout-Speichern, KI-Feedback-Erzeugung)
 * wollen den Bildschirm aber jeweils für ihre eigene Dauer aktiv halten - ohne diesen Guard
 * würde z.B. das Ende des Speichervorgangs (allowSleep()) versehentlich einen noch laufenden
 * Pausen-Timer "ausschalten" (Display darf einschlafen), obwohl der Timer selbst das noch gar
 * nicht wollte, und umgekehrt.
 *
 * Nutzung:
 *   await acquireKeepAwake('save')      // Bildschirm bleibt an
 *   ...
 *   await releaseKeepAwake('save')      // erst wenn ALLE Tags freigegeben sind, darf der
 *                                        // Bildschirm wieder einschlafen
 */

import { KeepAwake } from '@capacitor-community/keep-awake'
import { logger } from './logger'

const activeTags = new Set()

// Einstellung "Display im Training" (Einstellungen): 'workout' = ganzes Workout (bisheriges Verhalten),
// 'rest' = nur Pausen-/Aufwärm-/Intervall-Timer, 'off' = nie (Speichern und KI-Feedback halten das Display
// trotzdem kurz wach, damit nichts abbricht). Geräteweit, nicht pro Konto.
export const KEEP_AWAKE_MODES = ['workout', 'rest', 'off']
export const DEFAULT_KEEP_AWAKE_MODE = 'workout'
const MODE_STORAGE_KEY = 'keep-awake-mode'
const ALWAYS_TAGS = new Set(['workout-save', 'ai-feedback'])
const WORKOUT_ONLY_TAGS = new Set(['session-stopwatch'])

export function getKeepAwakeMode() {
  try {
    const stored = localStorage.getItem(MODE_STORAGE_KEY)
    return KEEP_AWAKE_MODES.includes(stored) ? stored : DEFAULT_KEEP_AWAKE_MODE
  } catch {
    return DEFAULT_KEEP_AWAKE_MODE
  }
}

export async function setKeepAwakeMode(mode) {
  if (!KEEP_AWAKE_MODES.includes(mode)) return
  try { localStorage.setItem(MODE_STORAGE_KEY, mode) } catch {}
  await applyKeepAwake('mode-changed')
}

// Welche der aktiven Tags halten das Display laut Einstellung wach?
function effectiveTags() {
  const mode = getKeepAwakeMode()
  return Array.from(activeTags).filter((tag) => {
    if (mode === 'workout') return true
    if (ALWAYS_TAGS.has(tag)) return true
    return mode === 'rest' && !WORKOUT_ONLY_TAGS.has(tag)
  })
}

let awake = false

// Bei JEDEM Aufruf setzen (auch wenn schon an): der Aufruf ist auf iOS idempotent
// (isIdleTimerDisabled = true), und ein einmal fehlgeschlagener Aufruf wird so beim nächsten
// acquire nachgeholt statt dauerhaft verloren zu sein.
async function applyKeepAwake(reason) {
  const tags = effectiveTags()
  try {
    if (tags.length > 0) {
      await KeepAwake.keepAwake()
      awake = true
      logger.debug('[keepAwakeGuard] Keep-Awake aktiviert', { reason, tags })
    } else if (awake) {
      await KeepAwake.allowSleep()
      awake = false
      logger.debug('[keepAwakeGuard] Keep-Awake deaktiviert', { reason })
    }
  } catch (err) {
    logger.warn('[keepAwakeGuard] Keep-Awake-Umschaltung fehlgeschlagen:', err?.message)
  }
}

export async function acquireKeepAwake(tag) {
  if (typeof window === 'undefined') return
  const key = String(tag || 'unknown')
  activeTags.add(key)
  await applyKeepAwake(key)
}

/**
 * Nach Rückkehr in die App (Hintergrund -> Vordergrund) erneut setzen, falls noch etwas läuft:
 * iOS setzt die Sperre beim App-Wechsel teilweise zurück (Aufruf in main.js).
 */
export async function reapplyKeepAwake() {
  if (typeof window === 'undefined' || activeTags.size === 0) return
  await applyKeepAwake('app-active')
}

export async function releaseKeepAwake(tag) {
  if (typeof window === 'undefined') return
  const key = String(tag || 'unknown')
  activeTags.delete(key)
  await applyKeepAwake(`release:${key}`)
}

// Für Debug-/Test-Zwecke
export function getActiveKeepAwakeTags() {
  return Array.from(activeTags)
}
