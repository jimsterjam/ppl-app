// Asynchrone Abläufe, die mit dem Token eines Kontos Anfragen für dessen Daten stellen (Warteschlange und Tracker für
// KI-Feedback): Das Konto kann zwischen Start, Token-Abruf und Anfrage wechseln. Dieser Wächter hält das Konto vom Start
// fest und prüft vor jedem Schritt, ob noch dasselbe aktiv ist und der Token zu ihm gehört (Absprache Paul 06.11.2026).
import { getActiveUid } from './userScopedStorage'

/** Konto-ID aus einem Firebase-Token (ohne Netzwerk); leer, wenn nicht lesbar. */
export function uidFromToken(token) {
  const parts = String(token || '').split('.')
  if (parts.length < 2) return ''
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = JSON.parse(atob(payload.padEnd(payload.length + (4 - payload.length % 4) % 4, '=')))
    return String(json?.user_id || json?.uid || json?.sub || '').trim()
  } catch {
    return ''
  }
}

export function createAccountGuard() {
  const uid = getActiveUid()
  return {
    uid,
    /** Es ist ein Konto angemeldet. */
    hasAccount: Boolean(uid),
    /** Noch dasselbe Konto wie beim Start. */
    isStillActive: () => Boolean(uid) && getActiveUid() === uid,
    /** Der Token gehört nicht zu einem anderen Konto (nicht lesbare Token gelten nur über isStillActive). */
    tokenMatches: (token) => {
      const owner = uidFromToken(token)
      return !owner || owner === uid
    }
  }
}
