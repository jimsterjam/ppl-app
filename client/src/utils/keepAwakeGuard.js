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

// keepAwake() bei JEDEM acquire aufrufen (nicht nur beim ersten Tag): der Aufruf ist auf iOS
// idempotent (isIdleTimerDisabled = true), und ein einmal fehlgeschlagener Aufruf wird so beim
// nächsten acquire nachgeholt statt dauerhaft verloren zu sein.
async function applyKeepAwake(reason) {
  try {
    await KeepAwake.keepAwake()
    logger.debug('[keepAwakeGuard] Keep-Awake aktiviert', { reason, tags: Array.from(activeTags) })
  } catch (err) {
    logger.warn('[keepAwakeGuard] keepAwake() fehlgeschlagen:', err?.message)
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
  if (activeTags.size > 0) return
  try {
    await KeepAwake.allowSleep()
    logger.debug('[keepAwakeGuard] Keep-Awake deaktiviert (alle Tags freigegeben)')
  } catch (err) {
    logger.warn('[keepAwakeGuard] allowSleep() fehlgeschlagen:', err?.message)
  }
}

// Für Debug-/Test-Zwecke
export function getActiveKeepAwakeTags() {
  return Array.from(activeTags)
}
