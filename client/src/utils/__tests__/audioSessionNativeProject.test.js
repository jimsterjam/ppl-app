import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Swift lässt sich in der Cloud-Session nicht kompilieren: Diese Tests sichern die Audio-Einstellung ab, an der
// der Pausen-/Timer-Gong hängt.
const appDelegate = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../ios/App/App/AppDelegate.swift'),
  'utf8'
)

describe('AppDelegate: Audio-Sitzung für den Gong', () => {
  it('Kategorie .playback: Gong ist auch bei Stumm-Schalter zu hören (.ambient schweigt dort)', () => {
    expect(appDelegate).toMatch(/setCategory\(\.playback,/)
    expect(appDelegate).not.toMatch(/setCategory\(\.ambient/)
  })

  it('mixWithOthers: Musik anderer Apps wird nicht pausiert', () => {
    expect(appDelegate).toMatch(/setCategory\(\.playback,[^)]*\.mixWithOthers\)/)
  })

  it('wird beim Start, beim Wiederaktivieren und nach Routenwechsel erneut gesetzt', () => {
    expect(appDelegate).toContain('func applicationDidBecomeActive')
    expect(appDelegate).toContain('AVAudioSession.routeChangeNotification')
    expect(appDelegate).toContain('AVAudioSession.mediaServicesWereResetNotification')
    expect((appDelegate.match(/reassertAudioSession\(\)/g) || []).length).toBeGreaterThanOrEqual(2)
  })
})
