import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Buffer } from 'node:buffer'
import { timerSoundFile, melodySoundFile, TIMER_SOUND_FILES } from '../timerSoundFiles.js'
import { REST_MELODIES, REST_SOUND_IDS } from '../restMelodies.js'

const here = dirname(fileURLToPath(import.meta.url))
const iosDir = resolve(here, '../../../ios/App/App')
const pbxproj = readFileSync(resolve(here, '../../../ios/App/App.xcodeproj/project.pbxproj'), 'utf8')

describe('Timer-Tondateien für das iOS-Plugin TimerSound', () => {
  it('jedes Signal aus emitTimerSignal hat eine Datei (alle Klangarten und Melodien)', () => {
    expect(timerSoundFile({ kind: 'round-start' })).toBe('timer-whistle.wav')
    expect(timerSoundFile({ kind: 'rest-end' })).toBe('timer-whistle.wav')
    expect(timerSoundFile({ kind: 'rest-end', melodyId: 'default' })).toBe('timer-whistle.wav')
    expect(timerSoundFile({ kind: 'rest-warn' })).toBe('timer-bell-warn.wav')
    expect(timerSoundFile({ kind: 'session-end' })).toBe('timer-siren.wav')
    for (const n of [1, 2, 3]) {
      expect(timerSoundFile({ kind: `countdown-${n}`, soundType: 'box-gong' })).toBe(`timer-boxgong-${n}.wav`)
      expect(timerSoundFile({ kind: `countdown-${n}`, soundType: 'chinese-gong' })).toBe(`timer-chinesegong-${n}.wav`)
      expect(timerSoundFile({ kind: `countdown-${n}`, soundType: 'bell' })).toBe(`timer-bell-${n}.wav`)
      expect(timerSoundFile({ kind: `countdown-${n}`, soundType: 'beep' })).toBe(`timer-beep-${n}.wav`)
    }
    for (const id of Object.keys(REST_MELODIES)) expect(timerSoundFile({ kind: 'rest-end', melodyId: id })).toBe(`timer-melody-${id}.wav`)
    // Jede auswählbare Melodie (außer 'default' = Gong) hat eine eigene Datei
    expect(REST_SOUND_IDS.filter((id) => id !== 'default').every((id) => melodySoundFile(id))).toBe(true)
  })

  it('Gegenprobe: unbekannte Signale haben keine Datei (dann Web Audio)', () => {
    expect(timerSoundFile({ kind: 'countdown-4' })).toBe(null)
    expect(timerSoundFile({ kind: 'whatever' })).toBe(null)
    expect(timerSoundFile()).toBe(null)
  })

  it('jede Datei liegt im iOS-Projekt und ist unter "Copy Bundle Resources" eingetragen', () => {
    const resources = pbxproj.slice(pbxproj.indexOf('/* Begin PBXResourcesBuildPhase section */'), pbxproj.indexOf('/* End PBXResourcesBuildPhase section */'))
    for (const file of TIMER_SOUND_FILES) {
      expect(existsSync(resolve(iosDir, file)), file).toBe(true)
      expect(resources.includes(`/* ${file} in Resources */`), `${file} fehlt in Copy Bundle Resources`).toBe(true)
    }
  })

  it('Plugin-Quelltext ist kompiliert (Compile Sources) und registriert', () => {
    const sources = pbxproj.slice(pbxproj.indexOf('/* Begin PBXSourcesBuildPhase section */'), pbxproj.indexOf('/* End PBXSourcesBuildPhase section */'))
    expect(sources).toContain('/* TimerSoundPlugin.swift in Sources */')
    const controller = readFileSync(resolve(iosDir, 'MainViewController.swift'), 'utf8')
    expect(controller).toContain('registerPluginInstance(TimerSoundPlugin())')
    const plugin = readFileSync(resolve(iosDir, 'TimerSoundPlugin.swift'), 'utf8')
    expect(plugin).toContain('jsName = "TimerSound"')
    for (const method of ['isAvailable', 'play', 'schedule', 'cancel', 'getVolume']) expect(plugin).toContain(`name: "${method}"`)
  })

  it('Dateien sind unverändert aus dem Generator (nicht von Hand bearbeitet, Klang passt zu timerAudio.js)', async () => {
    const { renderAll, wavBuffer } = await import('../../../scripts/generate-timer-sounds.mjs')
    const { SR } = await import('../../../scripts/timerSoundSynth.mjs')
    for (const [file, samples] of renderAll()) {
      const disk = readFileSync(resolve(iosDir, file))
      expect(Buffer.compare(disk, wavBuffer(samples, SR)), `${file} weicht vom Generator ab - neu erzeugen`).toBe(0)
      // hörbar, aber nicht übersteuert
      let peak = 0
      for (const v of samples) peak = Math.max(peak, Math.abs(v))
      expect(peak, file).toBeGreaterThan(0.2)
      expect(peak, file).toBeLessThanOrEqual(0.9)
    }
  }, 20000)
})
