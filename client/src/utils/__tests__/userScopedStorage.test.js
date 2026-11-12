import { describe, it, expect, beforeEach, vi } from 'vitest'

// Einstellungen gehören zum Konto, nicht zum Gerät (Absprache Jimmy 06.11.2026).
function installStorage(initial = {}) {
  const data = new Map(Object.entries(initial))
  vi.stubGlobal('localStorage', {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)) },
    removeItem: (k) => { data.delete(k) }
  })
  return data
}

async function load(initial) {
  vi.resetModules()
  const data = installStorage(initial)
  const mod = await import('../userScopedStorage.js')
  return { data, ...mod }
}

describe('userScopedStorage', () => {
  beforeEach(() => { vi.unstubAllGlobals() })

  it('zwei Konten auf demselben Gerät haben getrennte Werte', async () => {
    const s = await load({ ppl_user_prefs_migrated_v1: '1' })
    s.setActiveUid('uidA')
    s.writePref('theme', 'light')
    s.setActiveUid('uidB')
    expect(s.readPref('theme')).toBeNull()
    s.writePref('theme', 'dark')
    s.setActiveUid('uidA')
    expect(s.readPref('theme')).toBe('light')
    s.setActiveUid('uidB')
    expect(s.readPref('theme')).toBe('dark')
    expect(s.scopedKey('theme', 'uidA')).toBe('theme:uidA')
  })

  it('abgemeldet: eigener Wert des vorigen Kontos ist nicht lesbar', async () => {
    const s = await load({ ppl_user_prefs_migrated_v1: '1' })
    s.setActiveUid('uidA')
    s.writePref('theme', 'light')
    s.setActiveUid(null)
    expect(s.readPref('theme')).toBeNull()
    expect(s.getActiveUid()).toBe('')
  })

  it('abgemeldet gewählte Werte gehen nicht auf die Platte, das nächste Konto ohne eigenen Wert übernimmt sie', async () => {
    const s = await load({ ppl_user_prefs_migrated_v1: '1' })
    s.writePref('app-lang', 'en')
    expect(s.data.has('app-lang')).toBe(false)
    s.setActiveUid('uidB')
    expect(s.readPref('app-lang')).toBe('en')
  })

  it('abgemeldet gewählte Werte überschreiben nie einen vorhandenen eigenen Wert', async () => {
    const s = await load({ ppl_user_prefs_migrated_v1: '1', 'app-lang:uidB': 'de' })
    s.writePref('app-lang', 'en')
    s.setActiveUid('uidB')
    expect(s.readPref('app-lang')).toBe('de')
  })

  it('Werte aus der Zeit ohne Konto werden nach der Anmeldung nicht an ein weiteres Konto weitergegeben', async () => {
    const s = await load({ ppl_user_prefs_migrated_v1: '1' })
    s.writePref('theme', 'light')
    s.setActiveUid('uidA')
    s.setActiveUid(null)
    s.setActiveUid('uidB')
    expect(s.readPref('theme')).toBeNull()
  })

  it('das aktive Konto bleibt über einen App-Neustart erhalten und wird beim Abmelden vergessen', async () => {
    const s = await load({ ppl_user_prefs_migrated_v1: '1' })
    s.setActiveUid('uidA')
    s.writePref('theme', 'light')
    const restarted = await load(Object.fromEntries(s.data))
    expect(restarted.getActiveUid()).toBe('uidA')
    expect(restarted.readPref('theme')).toBe('light')
    restarted.setActiveUid(null)
    const afterLogout = await load(Object.fromEntries(restarted.data))
    expect(afterLogout.getActiveUid()).toBe('')
  })

  it('Update: alte geräteweite Werte gehen einmalig an das erste angemeldete Konto und werden gelöscht', async () => {
    const s = await load({ theme: 'light', 'theme-accent': 'violet', 'app-lang': 'en', 'weekly-goal': '5' })
    s.setActiveUid('uidA')
    expect(s.readPref('theme')).toBe('light')
    expect(s.readPref('app-lang')).toBe('en')
    expect(s.data.has('theme')).toBe(false)
    expect(s.data.has('weekly-goal')).toBe(false)
    s.setActiveUid('uidB')
    expect(s.readPref('theme')).toBeNull()
    expect(s.readPref('weekly-goal')).toBeNull()
  })

  it('Update ohne angemeldetes Konto: alte Werte bleiben unberührt und sind für niemanden lesbar', async () => {
    const s = await load({ theme: 'light' })
    expect(s.readPref('theme')).toBeNull()
    expect(s.data.get('theme')).toBe('light')
  })

  it('Update: ein schon vorhandener Wert des Kontos wird nicht überschrieben', async () => {
    const s = await load({ theme: 'light', 'theme:uidA': 'dark' })
    s.setActiveUid('uidA')
    expect(s.readPref('theme')).toBe('dark')
  })

  it('Löschen entfernt nur den Wert des aktiven Kontos', async () => {
    const s = await load({ ppl_user_prefs_migrated_v1: '1' })
    s.setActiveUid('uidA'); s.writePref('theme', 'light')
    s.setActiveUid('uidB'); s.writePref('theme', 'dark')
    s.removePref('theme')
    expect(s.readPref('theme')).toBeNull()
    expect(s.readPref('theme', 'uidA')).toBe('light')
  })

  it('Update: schlägt das Schreiben fehl, bleibt der alte Wert erhalten und die Übernahme wird später wiederholt', async () => {
    vi.resetModules()
    const data = new Map([['theme', 'light'], ['app-lang', 'en']])
    let failWrites = true
    vi.stubGlobal('localStorage', {
      getItem: (k) => (data.has(k) ? data.get(k) : null),
      setItem: (k, v) => { if (failWrites) throw new Error('QuotaExceededError'); data.set(k, String(v)) },
      removeItem: (k) => { data.delete(k) }
    })
    const s = await import('../userScopedStorage.js')
    s.setActiveUid('uidA')
    expect(data.get('theme')).toBe('light')
    expect(data.get('app-lang')).toBe('en')
    expect(data.has('ppl_user_prefs_migrated_v1')).toBe(false)

    failWrites = false
    expect(s.migrateLegacyPrefs('uidA')).toBe(true)
    expect(s.readPref('theme', 'uidA')).toBe('light')
    expect(s.readPref('app-lang', 'uidA')).toBe('en')
    expect(data.has('theme')).toBe(false)
    expect(data.get('ppl_user_prefs_migrated_v1')).toBe('1')
  })

  it('Wahl aus der Zeit ohne Konto: scheitert das Schreiben, wird sie trotzdem nicht an ein späteres Konto weitergegeben', async () => {
    vi.resetModules()
    const data = new Map([['ppl_user_prefs_migrated_v1', '1']])
    let failWrites = false
    vi.stubGlobal('localStorage', {
      getItem: (k) => (data.has(k) ? data.get(k) : null),
      setItem: (k, v) => { if (failWrites) throw new Error('QuotaExceededError'); data.set(k, String(v)) },
      removeItem: (k) => { data.delete(k) }
    })
    const s = await import('../userScopedStorage.js')
    s.writePref('app-lang', 'en')
    failWrites = true
    expect(() => s.setActiveUid('uidA')).not.toThrow()
    failWrites = false
    s.setActiveUid('uidB')
    expect(s.readPref('app-lang')).toBeNull()
  })
})
