// Einstellungen und Zähler zu den Fragen nach dem Training (Backlog F16). Gehören zum Konto, nicht zum Gerät
// (userScopedStorage): Ein zweites Konto auf demselben Gerät sieht nichts vom ersten.
import { readPref, writePref } from '@/utils/userScopedStorage'

const KEY_ENABLED = 'post-questions'
const KEY_INTRO_SEEN = 'post-questions-intro-seen'
const KEY_SKIPS = 'post-questions-skips'

// Nach so vielen Mal Überspringen in Folge wird angeboten, die Fragen auszuschalten.
export const SKIPS_BEFORE_OFFER = 3

/** Standard: an (Absprache Jimmy 14.11.). Nur ein ausdrückliches Ausschalten zählt. */
export function isQuestionsEnabled() {
  return readPref(KEY_ENABLED) !== '0'
}

export function setQuestionsEnabled(enabled) {
  writePref(KEY_ENABLED, enabled ? '1' : '0')
  // Wieder eingeschaltet: Zähler neu beginnen, sonst käme sofort wieder das Angebot zum Ausschalten.
  if (enabled) writePref(KEY_SKIPS, '0')
}

export function hasSeenIntro() {
  return readPref(KEY_INTRO_SEEN) === '1'
}

export function markIntroSeen() {
  writePref(KEY_INTRO_SEEN, '1')
}

export function skipsInARow() {
  const value = Number.parseInt(readPref(KEY_SKIPS) || '0', 10)
  return Number.isFinite(value) && value > 0 ? value : 0
}

/** Der Nutzer hat die Fragen übersprungen, ohne etwas zu beantworten. */
export function recordSkip() {
  const next = skipsInARow() + 1
  writePref(KEY_SKIPS, String(next))
  return next
}

/** Mindestens eine Antwort gegeben (oder bewusst weitergefragt): Zähler zurück auf 0. */
export function resetSkips() {
  writePref(KEY_SKIPS, '0')
}

export function shouldOfferTurnOff() {
  return skipsInARow() >= SKIPS_BEFORE_OFFER
}
