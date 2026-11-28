import { describe, it, expect } from 'vitest'
import { onMediaImageError, MEDIA_PLACEHOLDER } from '../mediaFallback'

describe('mediaFallback: defektes Großbild -> Platzhalter', () => {
  it('wechselt einmal auf den Platzhalter', () => {
    const img = { src: 'http://localhost/exercises/static/180/9025.jpg' }
    onMediaImageError({ target: img })
    expect(img.src).toBe(MEDIA_PLACEHOLDER)
  })

  it('Gegenprobe: der Platzhalter selbst wird nicht erneut ersetzt (keine Schleife), leere Ereignisse stören nicht', () => {
    const img = { src: 'http://localhost/exercises/play.svg' }
    onMediaImageError({ target: img })
    expect(img.src).toBe('http://localhost/exercises/play.svg')
    expect(() => onMediaImageError(undefined)).not.toThrow()
    expect(() => onMediaImageError({})).not.toThrow()
  })
})
