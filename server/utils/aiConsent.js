// Einwilligung zur KI-Auswertung (App-Store-Regel 5.1.2: Nutzer müssen der Weitergabe ihrer
// Trainingsdaten an einen KI-Dienst ausdrücklich zustimmen). Gespeichert im Profil
// (UserProfile.aiConsent). Wird der Einwilligungstext inhaltlich geändert, CURRENT_AI_CONSENT_VERSION
// erhöhen - dann muss erneut zugestimmt werden.
export const CURRENT_AI_CONSENT_VERSION = 1

export function summarizeAiConsent(profile) {
  const consent = profile?.aiConsent || {}
  const granted = consent.granted === true && Number(consent.version) >= CURRENT_AI_CONSENT_VERSION
  return {
    granted,
    version: CURRENT_AI_CONSENT_VERSION,
    grantedAt: granted ? consent.grantedAt || null : null,
    revokedAt: consent.revokedAt || null
  }
}

// Nimmt nur ein echtes Boolean an - nie den Request-Body ungeprüft speichern.
export function parseConsentInput(body) {
  if (!body || typeof body.granted !== 'boolean') return null
  return { granted: body.granted }
}

export function buildConsentUpdate(granted, now = new Date()) {
  return granted
    ? { 'aiConsent.granted': true, 'aiConsent.version': CURRENT_AI_CONSENT_VERSION, 'aiConsent.grantedAt': now }
    : { 'aiConsent.granted': false, 'aiConsent.revokedAt': now }
}

// Middleware-Fabrik (loadProfile injizierbar für Tests). Läuft NACH der Authentifizierung.
// Ohne erkannte Nutzer-ID (Auth in Entwicklung abgeschaltet) wird durchgelassen.
export function createRequireAiConsent({ loadProfile, logger = console } = {}) {
  return async function requireAiConsent(req, res, next) {
    const uid = req.auth?.userId
    if (!uid) return next()
    try {
      const profile = await loadProfile(uid)
      if (summarizeAiConsent(profile).granted) return next()
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
