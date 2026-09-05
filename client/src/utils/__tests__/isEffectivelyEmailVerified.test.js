import { describe, test, expect } from 'vitest'
import { isEffectivelyEmailVerified } from '../firebaseAuth'

describe('isEffectivelyEmailVerified', () => {
  test('kein User -> false', () => {
    expect(isEffectivelyEmailVerified(null)).toBe(false)
    expect(isEffectivelyEmailVerified(undefined)).toBe(false)
  })

  test('E-Mail/Passwort-User mit emailVerified=true -> true', () => {
    const user = { emailVerified: true, providerData: [{ providerId: 'password' }] }
    expect(isEffectivelyEmailVerified(user)).toBe(true)
  })

  test('E-Mail/Passwort-User mit emailVerified=false -> false (Kernfall der Sicherheitslücke)', () => {
    const user = { emailVerified: false, providerData: [{ providerId: 'password' }] }
    expect(isEffectivelyEmailVerified(user)).toBe(false)
  })

  test('E-Mail/Passwort-User ganz ohne providerData/emailVerified -> false', () => {
    expect(isEffectivelyEmailVerified({})).toBe(false)
  })

  test('REGRESSION: Apple-User mit emailVerified=false gilt trotzdem als verifiziert', () => {
    const user = { emailVerified: false, providerData: [{ providerId: 'apple.com' }] }
    expect(isEffectivelyEmailVerified(user)).toBe(true)
  })

  test('Google-User mit emailVerified=false gilt trotzdem als verifiziert', () => {
    const user = { emailVerified: false, providerData: [{ providerId: 'google.com' }] }
    expect(isEffectivelyEmailVerified(user)).toBe(true)
  })

  test('User mit gemischten Providern (password + apple.com verlinkt) gilt als verifiziert', () => {
    const user = { emailVerified: false, providerData: [{ providerId: 'password' }, { providerId: 'apple.com' }] }
    expect(isEffectivelyEmailVerified(user)).toBe(true)
  })

  test('providerData fehlt komplett -> false statt zu werfen', () => {
    const user = { emailVerified: false }
    expect(isEffectivelyEmailVerified(user)).toBe(false)
  })
})
