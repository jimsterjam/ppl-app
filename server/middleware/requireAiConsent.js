import UserProfile from '../models/UserProfile.js'
import { createRequireAiConsent, ANSWERS_CONSENT_VERSION } from '../utils/aiConsent.js'

const loadProfile = (uid) => UserProfile.findOne({ uid }).select('aiConsent').lean()

// Alle KI-Aufrufe: Zustimmung ab Textversion 1 (auch ältere Apps).
export const requireAiConsent = createRequireAiConsent({ loadProfile })

// Antworten auf die Fragen nach dem Training speichern: erst ab Textversion 2 (der Text nennt diese Daten).
export const requireAiConsentForAnswers = createRequireAiConsent({ loadProfile, minVersion: ANSWERS_CONSENT_VERSION })
