import { describe, it, expect } from 'vitest'
import { nextDelayMs, classifyFeedbackResponse, isFinalHttpError, RETRY_DELAYS_MS, GIVE_UP_AFTER_MS } from '../feedbackRetryRules.js'

describe('feedbackRetryRules', () => {
  it('Abstand wächst und bleibt dann beim letzten Wert', () => {
    expect(nextDelayMs(0)).toBe(15_000)
    expect(nextDelayMs(1)).toBe(60_000)
    expect(nextDelayMs(99)).toBe(RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1])
  })

  it('innerhalb von 30 Minuten gibt es mehrere Versuche', () => {
    let t = 0
    let attempts = 0
    while (t + nextDelayMs(attempts) <= GIVE_UP_AFTER_MS) { t += nextDelayMs(attempts); attempts++ }
    expect(attempts).toBeGreaterThanOrEqual(6)
  })

  it('Antworten einordnen', () => {
    expect(classifyFeedbackResponse({ ai_feedback: 'Text' })).toBe('ready')
    expect(classifyFeedbackResponse({ feedback_status: 'insufficient_history' })).toBe('final')
    expect(classifyFeedbackResponse({ feedback_status: 'quota_limited' })).toBe('final')
    expect(classifyFeedbackResponse({ feedback_status: 'network_unavailable' })).toBe('retry')
    expect(classifyFeedbackResponse({})).toBe('retry')
  })

  it('nur echte Endzustände brechen ab, Timeout/Serverfehler/abgelaufenes Token nicht', () => {
    expect(isFinalHttpError(404)).toBe(true)
    expect(isFinalHttpError(403)).toBe(true)
    expect(isFinalHttpError(401)).toBe(false)
    expect(isFinalHttpError(429)).toBe(false)
    expect(isFinalHttpError(502)).toBe(false)
    expect(isFinalHttpError(undefined)).toBe(false)
  })

  it('503 (z. B. AI_QUOTA_UNAVAILABLE bei kurzem Datenbankfehler) bleibt wiederholbar, leeres Kontingent ist endgültig', () => {
    expect(isFinalHttpError(503)).toBe(false)
    // Ein leeres Kontingent kommt dagegen als 200 mit quota_limited und ist endgültig.
    expect(classifyFeedbackResponse({ success: true, feedback_status: 'quota_limited' })).toBe('final')
  })

  it('der erste erneute Versuch kommt nach 15 Sekunden (so lang wie der Takt des Trackers)', () => {
    expect(RETRY_DELAYS_MS[0]).toBe(15_000)
    expect(nextDelayMs(0)).toBe(15_000)
  })
})
