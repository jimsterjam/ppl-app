import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { isEmailVerifiedFromToken } = await import(join(__dirname, '../firebaseAuth.js'))

describe('isEmailVerifiedFromToken', () => {
  test('E-Mail/Passwort-Login mit email_verified=true wird akzeptiert', () => {
    const token = { email_verified: true, firebase: { sign_in_provider: 'password' } }
    assert.equal(isEmailVerifiedFromToken(token), true)
  })

  test('E-Mail/Passwort-Login mit email_verified=false wird abgelehnt', () => {
    const token = { email_verified: false, firebase: { sign_in_provider: 'password' } }
    assert.equal(isEmailVerifiedFromToken(token), false)
  })

  test('E-Mail/Passwort-Login ohne email_verified-Feld wird abgelehnt', () => {
    const token = { firebase: { sign_in_provider: 'password' } }
    assert.equal(isEmailVerifiedFromToken(token), false)
  })

  test('Google-Login mit email_verified=true wird akzeptiert', () => {
    const token = { email_verified: true, firebase: { sign_in_provider: 'google.com' } }
    assert.equal(isEmailVerifiedFromToken(token), true)
  })

  test('REGRESSION: Apple-Login wird trotz email_verified=false akzeptiert (föderierter Provider)', () => {
    const token = { email_verified: false, firebase: { sign_in_provider: 'apple.com' } }
    assert.equal(isEmailVerifiedFromToken(token), true)
  })

  test('Apple-Login ohne email_verified-Feld überhaupt wird ebenfalls akzeptiert', () => {
    const token = { firebase: { sign_in_provider: 'apple.com' } }
    assert.equal(isEmailVerifiedFromToken(token), true)
  })

  test('Custom-Claim emailVerified=true (google-native Fallback-Pfad) wird weiterhin akzeptiert', () => {
    const token = { emailVerified: true, firebase: { sign_in_provider: 'custom' } }
    assert.equal(isEmailVerifiedFromToken(token), true)
  })

  test('fehlendes firebase-Objekt (kaputtes/unerwartetes Token) wird sicher abgelehnt statt zu werfen', () => {
    const token = { email_verified: false }
    assert.equal(isEmailVerifiedFromToken(token), false)
  })

  test('komplett leeres Token-Objekt wirft nicht und wird abgelehnt', () => {
    assert.equal(isEmailVerifiedFromToken({}), false)
  })
})
