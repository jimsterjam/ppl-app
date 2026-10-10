import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  REST_MELODIES, REST_SOUND_IDS, DEFAULT_REST_SOUND, ALARM_MAX_SEC,
  noteHz, sanitizeRestSound, alarmSoundFile, alarmFileSeconds, renderAlarmSamples
} from '../restMelodies.js'

// Wunsch Paul 10.10.: mehrere Melodien zur Auswahl für das Pausenende. Dieselben Noten spielt die App
// (Web Audio) und der Generator für die Wecker-Dateien (iOS).
const iosDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../ios/App')

describe('restMelodies', () => {
  it('fünf Töne zur Auswahl: Standard plus vier eigene', () => {
    expect(REST_SOUND_IDS).toEqual([DEFAULT_REST_SOUND, 'deep', 'chimes', 'marimba', 'bright'])
  })

  it('noteHz: A4 = 440, A3 = 220', () => {
    expect(noteHz('A4')).toBeCloseTo(440, 5)
    expect(noteHz('A3')).toBeCloseTo(220, 5)
    expect(() => noteHz('H4')).toThrow()
  })

  it('sanitizeRestSound: unbekannte Werte fallen auf den Standard zurück', () => {
    expect(sanitizeRestSound('deep')).toBe('deep')
    expect(sanitizeRestSound('../evil')).toBe(DEFAULT_REST_SOUND)
    expect(sanitizeRestSound(null)).toBe(DEFAULT_REST_SOUND)
  })

  it('Standard hat keine Datei (iOS-Wecker), die Melodien je eine', () => {
    expect(alarmSoundFile(DEFAULT_REST_SOUND)).toBeNull()
    expect(alarmSoundFile('marimba')).toBe('rest-alarm-marimba.wav')
  })

  it.each(Object.keys(REST_MELODIES))('%s: letzter Ton klingt innerhalb des Durchgangs aus, Datei unter 30 s', (id) => {
    const melody = REST_MELODIES[id]
    const lastStart = Math.max(...melody.notes.map((n) => n.at))
    expect(lastStart + melody.ringSec).toBeLessThanOrEqual(melody.cycleSec)
    expect(alarmFileSeconds(id)).toBeGreaterThan(0)
    expect(alarmFileSeconds(id)).toBeLessThanOrEqual(ALARM_MAX_SEC)
    expect(ALARM_MAX_SEC).toBeLessThan(30)
  })

  it.each(Object.keys(REST_MELODIES))('%s: erzeugte Samples haben die richtige Länge und übersteuern nicht', (id) => {
    const samples = renderAlarmSamples(id, 8000)
    expect(samples.length).toBe(Math.round(alarmFileSeconds(id) * 8000))
    const peak = samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
    expect(peak).toBeGreaterThan(0.5)
    expect(peak).toBeLessThanOrEqual(0.85 + 1e-6)
    expect(Math.abs(samples[samples.length - 1])).toBeLessThan(0.01)
  })

  it('Wecker-Dateien liegen im iOS-Projekt (gültiges WAV, < 30 s) und sind im Xcode-Projekt eingetragen', () => {
    const pbx = readFileSync(resolve(iosDir, 'App.xcodeproj/project.pbxproj'), 'utf8')
    for (const id of Object.keys(REST_MELODIES)) {
      const name = alarmSoundFile(id)
      const wav = resolve(iosDir, 'App', name)
      expect(existsSync(wav), `${name} fehlt - cd client && node scripts/generate-rest-melodies.mjs`).toBe(true)
      const bytes = readFileSync(wav)
      expect(bytes.subarray(0, 4).toString('latin1')).toBe('RIFF')
      expect(bytes.subarray(8, 12).toString('latin1')).toBe('WAVE')
      const seconds = bytes.readUInt32LE(40) / bytes.readUInt32LE(28)
      expect(seconds).toBeCloseTo(alarmFileSeconds(id), 1)
      expect(seconds).toBeLessThan(30)

      const escaped = name.replace(/\./g, '\\.')
      const fileRef = pbx.match(new RegExp(`([0-9A-F]{24}) /\\* ${escaped} \\*/ = \\{isa = PBXFileReference;`))
      const buildFile = pbx.match(new RegExp(`([0-9A-F]{24}) /\\* ${escaped} in Resources \\*/ = \\{isa = PBXBuildFile; fileRef = ([0-9A-F]{24})`))
      expect(fileRef, `${name}: PBXFileReference`).not.toBeNull()
      expect(buildFile, `${name}: PBXBuildFile`).not.toBeNull()
      expect(buildFile[2]).toBe(fileRef[1])
      // IDs kommen im Projekt nur dort vor, wo sie hingehören (eindeutig, in Gruppe/Resources-Phase)
      expect(pbx.split(fileRef[1]).length - 1, `${name}: Datei-ID`).toBe(3)
      expect(pbx.split(buildFile[1]).length - 1, `${name}: Build-ID`).toBe(2)
    }
  })

  it('Generator erzeugt dieselben Daten wie die Dateien im Projekt (Noten nicht ohne Neuerzeugen ändern)', () => {
    for (const id of Object.keys(REST_MELODIES)) {
      const bytes = readFileSync(resolve(iosDir, 'App', alarmSoundFile(id)))
      const expected = renderAlarmSamples(id, 22050)
      expect(bytes.readUInt32LE(24)).toBe(22050)
      expect((bytes.length - 44) / 2).toBe(expected.length)
      // Stichprobe: 5 Stellen
      for (const frac of [0.01, 0.2, 0.5, 0.7, 0.95]) {
        const i = Math.floor(expected.length * frac)
        expect(bytes.readInt16LE(44 + i * 2)).toBe(Math.round(Math.max(-1, Math.min(1, expected[i])) * 32767))
      }
    }
  })
})
