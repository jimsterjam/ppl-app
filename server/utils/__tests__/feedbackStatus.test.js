import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveListFeedbackStatus, FEEDBACK_PENDING_FAILED_AFTER_MS } from '../feedbackStatus.js'

describe('resolveListFeedbackStatus', () => {
  const now = Date.parse('2026-09-29T10:00:00Z')

  test('Feedback vorhanden -> generated, egal welcher Status gespeichert ist', () => {
    assert.equal(resolveListFeedbackStatus({ ai_feedback: 'Text', ai_feedback_status: 'pending' }, now), 'generated')
  })

  test('pending bis 30 Minuten, danach failed', () => {
    const fresh = { ai_feedback_status: 'pending', ai_pending_since: new Date(now - 5 * 60 * 1000) }
    const stale = { ai_feedback_status: 'pending', ai_pending_since: new Date(now - FEEDBACK_PENDING_FAILED_AFTER_MS - 1000) }
    assert.equal(resolveListFeedbackStatus(fresh, now), 'pending')
    assert.equal(resolveListFeedbackStatus(stale, now), 'failed')
  })

  test('deferred und none bleiben unverändert', () => {
    assert.equal(resolveListFeedbackStatus({ ai_feedback_status: 'deferred' }, now), 'deferred')
    assert.equal(resolveListFeedbackStatus({}, now), 'none')
  })
})
