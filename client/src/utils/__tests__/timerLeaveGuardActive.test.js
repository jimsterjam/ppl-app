import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const VIEW_PATH = join(__dirname, '../../views/WorkoutDetailView.vue')

// Tripwire-Test statt echtem Verhaltenstest: WorkoutDetailView.vue ist eine sehr große
// Single-File-Component (>4000 Zeilen), deren onBeforeRouteLeave-Hook praxisnah nur über einen
// vollständigen Component-Mount inkl. echtem vue-router-Setup testbar wäre - unverhältnismäßiger
// Aufwand allein für diesen einen Guard. Der eigentliche Bug war aber simpel: der Guard-Block
// war komplett auskommentiert (siehe Git-Historie), wodurch das Verlassen der Route bei
// laufendem Timer stillschweigend ohne Rückfrage durchging. Dieser Test prüft direkt am
// Quelltext, dass der Block wieder aktiv ist - er würde fehlschlagen, falls jemand ihn (z.B.
// beim Debuggen eines anderen Problems) erneut auskommentiert, ohne es rückgängig zu machen.
// Kein Ersatz für einen echten Verhaltenstest, aber eine kostengünstige Absicherung gegen
// exakt diese Regression.
describe('WorkoutDetailView Timer-Leave-Guard', () => {
  it('ist im onBeforeRouteLeave-Hook aktiv (nicht auskommentiert)', () => {
    const source = readFileSync(VIEW_PATH, 'utf-8')

    const hookStart = source.indexOf('onBeforeRouteLeave(async (to) => {')
    expect(hookStart, 'onBeforeRouteLeave-Hook nicht gefunden - hat sich die Struktur der Datei geändert?').toBeGreaterThan(-1)

    const hookEnd = source.indexOf('\n})', hookStart)
    const hookBody = source.slice(hookStart, hookEnd === -1 ? undefined : hookEnd)

    // Aktiver (nicht auskommentierter) Aufruf der Timer-Guard-Bedingung.
    expect(hookBody).toMatch(/^\s*if \(timerStore\.isRunningLike\) \{/m)
    // Zur Sicherheit: keine auskommentierte Kopie dieser Zeile mehr im Hook (Regressionsmuster).
    expect(hookBody).not.toMatch(/\/\/\s*if \(timerStore\.isRunningLike\)/)
  })
})
