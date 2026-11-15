// Textversion der KI-Einwilligung, die das Einwilligungsfenster (AiConsentModal.vue) zeigt. Der Client schickt sie beim
// Zustimmen mit; der Server speichert sie. Muss mit CURRENT_AI_CONSENT_VERSION in server/utils/aiConsent.js übereinstimmen
// (per Server-Test abgeglichen). Wird der Text inhaltlich geändert, beide erhöhen - dann muss erneut zugestimmt werden.
// Bewusst ohne Imports, damit auch der Server-Test sie laden kann.
export const AI_CONSENT_TEXT_VERSION = 2
