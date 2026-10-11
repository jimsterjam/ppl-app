import { describe, it, expect } from 'vitest'
import { buildExerciseMediaUrl, buildExerciseCacheKey } from '../assetResolver.js'

// Absprache Paul 11.10.: Gibt es kein Video, zeigt die Großansicht das Foto. Eigene Übungen haben nie ein
// Video - vorher baute die App trotzdem eine Video-Adresse aus ihrer ID, und die Großansicht blieb leer.
describe('Video-Adressen nur für Katalog-Übungen', () => {
  it('Katalog-Übung (ex_0001 / 0001): Video-Adresse und Cache-Schlüssel', () => {
    expect(buildExerciseMediaUrl({ _id: 'ex_0001' })).toBe('/exercises/mp4/360/0001.v1.mp4')
    expect(buildExerciseMediaUrl({ id: '0123' })).toBe('/exercises/mp4/360/0123.v1.mp4')
    expect(buildExerciseCacheKey({ _id: 'ex_0001' })).toBe('exercises/360/0001.v1.mp4')
  })

  it('eigene Übung (Mongo-ObjectId oder custom_): keine Video-Adresse, kein Cache-Schlüssel', () => {
    const photo = '/uploads/exercises/abc.jpg'
    expect(buildExerciseMediaUrl({ _id: '65f0a1b2c3d4e5f6a7b8c9d0', imageUrl: photo })).toBeNull()
    expect(buildExerciseMediaUrl({ _id: 'custom_1728640000000', imageUrl: photo })).toBeNull()
    expect(buildExerciseCacheKey({ _id: '65f0a1b2c3d4e5f6a7b8c9d0' })).toBeNull()
    expect(buildExerciseCacheKey({ _id: 'custom_1728640000000' })).toBeNull()
  })

  it('eigene Übung mit ausdrücklicher mp4-Adresse behält sie', () => {
    expect(buildExerciseMediaUrl({ _id: 'custom_1', imageUrl: 'https://example.com/v.mp4' })).toBe('https://example.com/v.mp4')
  })

  it('Katalog-Übung nur mit altem .gif-Bild: abgeleitete Video-Adresse bleibt', () => {
    expect(buildExerciseMediaUrl({ imageUrl: '/exercises/360/0042.gif' })).toBe('/assets-cdn/exercises/mp4/360/0042.v1.mp4')
  })
})
