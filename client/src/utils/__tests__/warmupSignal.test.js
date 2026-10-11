import { describe, it, expect } from 'vitest'
import { buildWarmupNotification, WARMUP_NOTIFICATION_ID } from '../warmupSignal.js'
import { NOTIFICATION_ID, NOTIFICATION_DELAY_MS, NOTIFICATION_SOUND } from '../restEndSignal.js'

describe('Warm-up-Mitteilung', () => {
  const at = 5_000_000

  it('eigene ID, damit sie die Pausen-Mitteilung nicht überschreibt', () => {
    expect(WARMUP_NOTIFICATION_ID).not.toBe(NOTIFICATION_ID)
    expect(buildWarmupNotification(at, 't', 'b').id).toBe(WARMUP_NOTIFICATION_ID)
  })

  it('kommt etwas nach dem Ende, damit die App im Vordergrund sie vorher zurücknehmen kann', () => {
    const n = buildWarmupNotification(at, 'Cardio geschafft', 'Weiter mit: Gelenke aufwärmen', 'ios')
    expect(n.schedule.at.getTime()).toBe(at + NOTIFICATION_DELAY_MS)
    expect(n.title).toBe('Cardio geschafft')
    expect(n.body).toBe('Weiter mit: Gelenke aufwärmen')
  })

  it('iOS: mit Ton (Datei im App-Paket), sonst kein sound-Feld', () => {
    expect(buildWarmupNotification(at, 't', 'b', 'ios').sound).toBe(NOTIFICATION_SOUND)
    expect('sound' in buildWarmupNotification(at, 't', 'b', 'android')).toBe(false)
    expect('sound' in buildWarmupNotification(at, 't', 'b', 'web')).toBe(false)
  })
})
