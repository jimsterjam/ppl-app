import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  WARMUP_STEPS, WARMUP_TIMER_SECONDS, WARMUP_EXERCISES, emptyWarmup, sanitizeWarmup, isWarmupComplete,
  currentWarmupStep, nextWarmupStep, jointsTypeFor, warmupExerciseKey, pickWarmupExercise
} from '../warmupPlan.js'

const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../public')

describe('Warm-up-Schritte', () => {
  it('drei Schritte; Timer nur bei Cardio (5 Min.) und Gelenken (2 Min.)', () => {
    expect(WARMUP_STEPS).toEqual(['cardio', 'joints', 'specific'])
    expect(WARMUP_TIMER_SECONDS).toEqual({ cardio: 300, joints: 120 })
    expect(WARMUP_TIMER_SECONDS.specific).toBeUndefined()
  })

  it('sanitizeWarmup: nur echte Booleans, sonst null (wie der Server)', () => {
    expect(sanitizeWarmup({ cardio: true, joints: 'yes', specific: 1, evil: 'x' })).toEqual({ cardio: true, joints: false, specific: false })
    for (const bad of [null, undefined, 'x', 3, [], true]) expect(sanitizeWarmup(bad)).toBeNull()
  })

  it('aktueller und nächster Schritt', () => {
    expect(currentWarmupStep(emptyWarmup())).toBe('cardio')
    expect(currentWarmupStep(null)).toBe('cardio')
    expect(currentWarmupStep({ cardio: true, joints: false, specific: false })).toBe('joints')
    expect(currentWarmupStep({ cardio: true, joints: true, specific: true })).toBeNull()
    expect(nextWarmupStep({ cardio: true, joints: false, specific: false }, 'cardio')).toBe('joints')
    expect(nextWarmupStep({ cardio: true, joints: true, specific: false }, 'joints')).toBe('specific')
    expect(nextWarmupStep({ cardio: true, joints: true, specific: true }, 'specific')).toBeNull()
  })

  it('komplett nur mit allen drei Schritten', () => {
    expect(isWarmupComplete({ cardio: true, joints: true, specific: true })).toBe(true)
    expect(isWarmupComplete({ cardio: true, joints: true, specific: false })).toBe(false)
    expect(isWarmupComplete(null)).toBe(false)
  })

  it('Gelenk-Hinweis je Trainingstyp, Unbekanntes wie Full Body', () => {
    expect(jointsTypeFor('push')).toBe('push')
    expect(jointsTypeFor('LEGS')).toBe('legs')
    expect(jointsTypeFor('xyz')).toBe('fullbody')
    expect(jointsTypeFor(undefined)).toBe('fullbody')
  })
})

describe('Einfache Warm-up-Übung zur ersten Hauptübung', () => {
  it('Zielmuskel entscheidet', () => {
    expect(warmupExerciseKey({ name_en: 'bench press barbell', target: 'pectorals' })).toBe('push')
    expect(warmupExerciseKey({ name_en: 'barbell shoulder press', target: 'delts' })).toBe('push')
    expect(warmupExerciseKey({ name_en: 'lat pulldown', target: 'lats' })).toBe('pull')
    expect(warmupExerciseKey({ name_en: 'barbell squat', target: 'quads' })).toBe('squat')
    expect(warmupExerciseKey({ name_en: 'hip abduction', target: 'abductors' })).toBe('hinge')
  })

  it('Kreuzheben-Muster geht nach dem Namen vor (Ziel wäre z. B. Rücken)', () => {
    expect(warmupExerciseKey({ name_en: 'barbell deadlift', target: 'spine' })).toBe('hinge')
    expect(warmupExerciseKey({ name: 'Kreuzheben', target: 'upper back' })).toBe('hinge')
    expect(warmupExerciseKey({ name_en: 'barbell good morning', target: 'hamstrings' })).toBe('hinge')
  })

  it('keine passende Übung (Isolation, Core, eigene Übung ohne Katalogdaten): null', () => {
    expect(warmupExerciseKey({ name_en: 'barbell curl', target: 'biceps' })).toBe('pull') // Bizeps zieht -> Rücken-Übung
    expect(warmupExerciseKey({ name_en: 'crunch', target: 'abs' })).toBeNull()
    expect(warmupExerciseKey({ name: 'Meine Übung' })).toBeNull()
    expect(pickWarmupExercise({})).toBeNull()
  })

  it('pickWarmupExercise liefert Katalog-ID und Namen', () => {
    expect(pickWarmupExercise({ name_en: 'x', target: 'pectorals' })).toEqual({ key: 'push', catalogId: 'ex_0659', name: 'push-up (wall)' })
  })

  it('alle vier Warm-up-Übungen stehen im Katalog, sind Körpergewicht/Anfänger und haben ein Video', () => {
    const catalog = JSON.parse(readFileSync(resolve(publicDir, 'data/default-exercises.json'), 'utf8'))
    const videos = readdirSync(resolve(publicDir, 'exercises/mp4/360'))
    for (const entry of Object.values(WARMUP_EXERCISES)) {
      const found = catalog.find((e) => e._id === entry.catalogId)
      expect(found, `${entry.catalogId} fehlt im Katalog`).toBeTruthy()
      expect(String(found.name_en).toLowerCase()).toBe(entry.name)
      expect(String(found.equipment_en || found.equipment).toLowerCase()).toContain('body weight')
      expect(found.difficulty).toBe('beginner')
      expect(videos.some((f) => f.startsWith(`${found.id}.`)), `${entry.name}: Video fehlt`).toBe(true)
    }
  })

  it('Zielmuskel-Zuordnung deckt die Kategorien der Katalog-Zielmuskeln ab (kein Tippfehler in den Listen)', () => {
    const catalog = JSON.parse(readFileSync(resolve(publicDir, 'data/default-exercises.json'), 'utf8'))
    const targets = new Set(catalog.map((e) => String(e.target || '').toLowerCase()))
    for (const t of ['pectorals', 'delts', 'triceps', 'lats', 'upper back', 'traps', 'biceps', 'quads', 'calves', 'glutes', 'hamstrings', 'adductors', 'abductors', 'spine']) {
      expect(targets.has(t), `Zielmuskel "${t}" kommt im Katalog nicht vor`).toBe(true)
    }
  })
})
