import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describeEnvironmentMode } from '../validateEnv.js'

describe('Startwarnung: Umgebung ist nicht production', () => {
  it('production: keine Meldung', () => {
    assert.equal(describeEnvironmentMode({ NODE_ENV: 'production' }), null)
    assert.equal(describeEnvironmentMode({ NODE_ENV: ' Production ', RENDER: 'true' }), null)
  })

  it('auf Render ohne production: Fehlermeldung mit Handlungsanweisung', () => {
    for (const env of [{ NODE_ENV: 'development', RENDER: 'true' }, { RENDER_SERVICE_ID: 'srv-1' }]) {
      const notice = describeEnvironmentMode(env)
      assert.equal(notice.level, 'error')
      assert.match(notice.lines.join(' '), /NODE_ENV=production setzen/)
    }
    assert.match(describeEnvironmentMode({ RENDER: 'true' }).lines[0], /nicht gesetzt/)
  })

  it('lokal ohne production: nur ein Hinweis', () => {
    const notice = describeEnvironmentMode({ NODE_ENV: 'development' })
    assert.equal(notice.level, 'warn')
    assert.doesNotMatch(notice.lines.join(' '), /NODE_ENV=production setzen/)
  })

  it('nennt riskante Variablen nur beim Namen, nie mit Wert', () => {
    const notice = describeEnvironmentMode({ NODE_ENV: 'development', RENDER: 'true', SUBSCRIPTION_FORCE_PLAN: 'pro', ALLOW_MOCK_UPGRADE: 'true', SHOW_EMAIL_LINKS: '' })
    const text = notice.lines.join('\n')
    assert.match(text, /SUBSCRIPTION_FORCE_PLAN/)
    assert.match(text, /ALLOW_MOCK_UPGRADE/)
    assert.doesNotMatch(text, /SHOW_EMAIL_LINKS/) // leer = nicht gesetzt
    assert.doesNotMatch(text, /\bpro\b|true/)
  })
})

describe('Test-Routen sind entfernt', () => {
  const source = readFileSync(fileURLToPath(new URL('../../routes/workouts.js', import.meta.url)), 'utf8')
  it('es gibt keine ungeschützten oder nur per NODE_ENV gesperrten Debug-Endpunkte mehr', () => {
    assert.doesNotMatch(source, /router\.get\("\/test"/)
    assert.doesNotMatch(source, /ai-analysis-test/)
    assert.doesNotMatch(source, /ai-progress-feedback-test/)
  })
})
