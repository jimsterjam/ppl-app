import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildRestNotification, NOTIFICATION_DELAY_MS } from '../../stores/restTimerStore.js'

// Gong, wenn der Nutzer außerhalb der App ist (Wunsch 09.10.): Ohne `sound` bleibt die Mitteilung auf
// iOS stumm. Die Datei muss im iOS-Projekt liegen UND im Xcode-Projekt als Ressource eingetragen sein.
describe('Pausenende-Mitteilung', () => {
  const at = 1_000_000

  it('iOS: mit Ton, leicht nach dem Pausenende (Vordergrund nimmt sie vorher zurück)', () => {
    const n = buildRestNotification(at, 'Pause vorbei', 'Nächster Satz', 'ios')
    expect(n.sound).toBe('rest-end.wav')
    expect(n.schedule.at.getTime()).toBe(at + NOTIFICATION_DELAY_MS)
    expect(NOTIFICATION_DELAY_MS).toBeGreaterThan(250) // länger als ein Tick des Timers (250 ms)
    expect(n.title).toBe('Pause vorbei')
  })

  it('andere Plattformen: kein sound-Feld (Android-Datei existiert nicht)', () => {
    expect('sound' in buildRestNotification(at, 't', 'b', 'android')).toBe(false)
    expect('sound' in buildRestNotification(at, 't', 'b', 'web')).toBe(false)
  })

  it('Ton-Datei liegt im iOS-Projekt und ist im Xcode-Projekt als Ressource eingetragen', () => {
    const iosDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../ios/App')
    const wav = resolve(iosDir, 'App/rest-end.wav')
    expect(existsSync(wav)).toBe(true)
    const header = readFileSync(wav).subarray(0, 12).toString('latin1')
    expect(header.startsWith('RIFF')).toBe(true)
    expect(header.endsWith('WAVE')).toBe(true)
    // iOS spielt Mitteilungstöne nur bis 30 Sekunden
    const bytes = readFileSync(wav)
    const byteRate = bytes.readUInt32LE(28)
    const dataSize = bytes.readUInt32LE(40)
    expect(dataSize / byteRate).toBeLessThan(30)

    const pbx = readFileSync(resolve(iosDir, 'App.xcodeproj/project.pbxproj'), 'utf8')
    const fileRef = pbx.match(/([0-9A-F]{24}) \/\* rest-end\.wav \*\/ = \{isa = PBXFileReference;/)
    const buildFile = pbx.match(/([0-9A-F]{24}) \/\* rest-end\.wav in Resources \*\/ = \{isa = PBXBuildFile; fileRef = ([0-9A-F]{24})/)
    expect(fileRef).not.toBeNull()
    expect(buildFile).not.toBeNull()
    expect(buildFile[2]).toBe(fileRef[1])
    // in der Gruppe "App" und in der Resources-Phase aufgeführt
    expect(pbx.split(`${fileRef[1]} /* rest-end.wav */,`).length).toBe(2)
    expect(pbx.split(`${buildFile[1]} /* rest-end.wav in Resources */,`).length).toBe(2)
  })
})
