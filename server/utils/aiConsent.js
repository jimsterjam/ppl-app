// Einwilligung zur KI-Auswertung (App-Store-Regel 5.1.2: Nutzer müssen der Weitergabe ihrer
// Trainingsdaten an einen KI-Dienst ausdrücklich zustimmen). Gespeichert im Profil
// (UserProfile.aiConsent). Wird der Einwilligungstext inhaltlich geändert, CURRENT_AI_CONSENT_VERSION
// erhöhen - dann muss erneut zugestimmt werden.
export const CURRENT_AI_CONSENT_VERSION = 2

// Ältere App-Versionen (vor Textversion 2) kennen nur Text 1 und schicken keine Versionsangabe. Der neue Text ergänzt nur
// "deine Antworten auf kurze Fragen nach dem Training" - diese Fragen gibt es in älteren Apps nicht, sie senden solche Daten
// nie. Deshalb reicht für alle KI-Aufrufe die Zustimmung zu Text 1; Text 2 (ANSWERS_CONSENT_VERSION) verlangt nur das Speichern
// und Verwenden der Antworten. (Vorher blieben ältere Apps in einer Schleife: Zustimmen -> "nicht gespeichert" -> erneut fragen.)
export const MIN_AI_CONSENT_VERSION = 1
export const ANSWERS_CONSENT_VERSION = 2

/**
 * Gilt die Einwilligung für die Textversion `requiredVersion`? Ohne Angabe die älteste (Text 1), die ältere Apps kennen;
 * die neue App fragt mit ihrer Textversion (Query `consentVersion`, siehe declaredConsentVersion) und wird erst mit Version 2 "erteilt".
 */
export function summarizeAiConsent(profile, requiredVersion = MIN_AI_CONSENT_VERSION) {
  const consent = profile?.aiConsent || {}
  const needed = Number.isInteger(requiredVersion) && requiredVersion >= MIN_AI_CONSENT_VERSION && requiredVersion <= CURRENT_AI_CONSENT_VERSION
    ? requiredVersion
    : MIN_AI_CONSENT_VERSION
  const granted = consent.granted === true && Number(consent.version) >= needed
  return {
    granted,
    version: CURRENT_AI_CONSENT_VERSION,
    grantedAt: granted ? consent.grantedAt || null : null,
    revokedAt: consent.revokedAt || null
  }
}

/** Textversion, die der Client beim Abfragen nennt (`?consentVersion=2`); fehlt sie oder ist sie ungültig: Text 1 (ältere App). */
export function declaredConsentVersion(req) {
  const raw = Array.isArray(req?.query?.consentVersion) ? req.query.consentVersion[0] : req?.query?.consentVersion
  const value = Number(raw)
  return Number.isInteger(value) && value >= MIN_AI_CONSENT_VERSION && value <= CURRENT_AI_CONSENT_VERSION ? value : MIN_AI_CONSENT_VERSION
}

// Nimmt nur ein echtes Boolean an - nie den Request-Body ungeprüft speichern.
// Version: die Textversion, die der Nutzer im Fenster gesehen hat (der Client schickt sie mit). Fehlt sie (ältere App-Version),
// war es Textversion 1 - so gilt eine Zustimmung zum alten Text nicht für den neuen (Selbst-Review F16 Etappe 3).
// Eine gemeldete Version, die es nicht gibt (neuer als der Server, kleiner als 1, keine ganze Zahl), wird abgelehnt statt
// angepasst - sonst ließe sich damit die Zustimmung zum aktuellen Text vortäuschen.
export function parseConsentInput(body) {
  if (!body || typeof body.granted !== 'boolean') return null
  if (body.version === undefined || body.version === null) return { granted: body.granted, version: 1 }
  if (!Number.isInteger(body.version) || body.version < 1 || body.version > CURRENT_AI_CONSENT_VERSION) return null
  return { granted: body.granted, version: body.version }
}

export function buildConsentUpdate(granted, now = new Date(), version = CURRENT_AI_CONSENT_VERSION) {
  return granted
    ? { 'aiConsent.granted': true, 'aiConsent.version': version, 'aiConsent.grantedAt': now }
    : { 'aiConsent.granted': false, 'aiConsent.revokedAt': now }
}

// Middleware-Fabrik (loadProfile injizierbar für Tests). Läuft NACH der Authentifizierung.
// Ohne erkannte Nutzer-ID (Auth in Entwicklung abgeschaltet) wird durchgelassen.
export function createRequireAiConsent({ loadProfile, logger = console, minVersion = MIN_AI_CONSENT_VERSION } = {}) {
  return async function requireAiConsent(req, res, next) {
    const uid = req.auth?.userId
    if (!uid) return next()
    try {
      const profile = await loadProfile(uid)
      if (summarizeAiConsent(profile, minVersion).granted) {
        // Für die Route: zu welcher Textversion wurde zugestimmt (Antworten nur ab Version 2 verwenden).
        req.aiConsentVersion = Number(profile?.aiConsent?.version) || 0
        return next()
      }
      return res.status(403).json({
        error: 'AI consent required',
        code: 'AI_CONSENT_REQUIRED',
        consentVersion: CURRENT_AI_CONSENT_VERSION
      })
    } catch (error) {
      logger.error?.('AI consent check failed:', error?.message || error)
      // Im Zweifel nicht senden: lieber KI verweigern als Daten ohne Einwilligung übertragen.
      return res.status(503).json({ error: 'AI consent check unavailable', code: 'AI_CONSENT_UNAVAILABLE' })
    }
  }
}
