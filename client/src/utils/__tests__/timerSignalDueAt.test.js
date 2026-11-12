import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Ursache statt Einzelfix (Copilot PR 181, zwei Runden mit derselben Fehlerart): Jeder Timer-Ton aus einem Store muss
// seinen geplanten Zeitpunkt (dueAt) mitgeben, sonst kann emitTimerSignal einen verspäteten Ton nach der Rückkehr aus
// dem Hintergrund nicht erkennen und spielt ihn sofort.
const storesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../stores')

describe('Timer-Töne: jeder Aufruf von emitTimerSignal in den Stores gibt dueAt mit', () => {
  it('alle Aufrufe enthalten dueAt', () => {
    const missing = []
    let total = 0
    for (const file of readdirSync(storesDir).filter((f) => f.endsWith('.js'))) {
      const source = readFileSync(resolve(storesDir, file), 'utf8')
      for (const match of source.matchAll(/emitTimerSignal\(\{([\s\S]*?)\}\)/g)) {
        total += 1
        if (!/\bdueAt\b/.test(match[1])) missing.push(`${file}: ${match[1].replace(/\s+/g, ' ').slice(0, 80)}`)
      }
    }
    expect(total).toBeGreaterThan(10)
    expect(missing).toEqual([])
  })
})
