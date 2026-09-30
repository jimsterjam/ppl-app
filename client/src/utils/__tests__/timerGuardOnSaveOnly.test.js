import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const VIEW_PATH = join(__dirname, '../../views/WorkoutDetailView.vue')

// Tripwire-Test statt echtem Verhaltenstest: WorkoutDetailView.vue ist eine sehr große
// Single-File-Component (>4000 Zeilen), deren Hooks praxisnah nur über einen vollständigen
// Component-Mount inkl. echtem vue-router-Setup testbar wären. Dieser Test prüft direkt am
// Quelltext die Absprache vom 30.09.: Das Timer-Fenster erscheint nur noch beim Speichern.
// Beim Verlassen der Route (z.B. Tab-Wechsel) läuft der Timer einfach weiter, ohne Rückfrage.
function sliceFunction(source, signature) {
  const start = source.indexOf(signature)
  if (start === -1) return null
  const end = source.indexOf('\n}', start)
  return source.slice(start, end === -1 ? undefined : end)
}

describe('WorkoutDetailView Timer-Guard', () => {
  const source = readFileSync(VIEW_PATH, 'utf-8')

  it('fragt beim Speichern nach dem laufenden Timer', () => {
    const body = sliceFunction(source, 'async function saveWorkout(')
    expect(body, 'saveWorkout nicht gefunden - hat sich die Struktur der Datei geändert?').not.toBeNull()

    expect(body).toMatch(/^\s*if \(!isFavoriteAdjustMode\.value && timerStore\.isRunningLike\) \{/m)
    expect(body).toMatch(/pendingTimerAction\.value = \{ kind: 'save'/)
    expect(body).toMatch(/showTimerActionModal\.value = true/)
  })

  it('öffnet beim Verlassen der Route kein Timer-Fenster', () => {
    const body = sliceFunction(source, 'onBeforeRouteLeave(async (to) => {')
    expect(body, 'onBeforeRouteLeave-Hook nicht gefunden - hat sich die Struktur der Datei geändert?').not.toBeNull()

    expect(body).not.toMatch(/^\s*if \(timerStore\.isRunningLike\)/m)
    expect(body).not.toMatch(/kind: 'route-leave'/)
    expect(body).not.toMatch(/showTimerActionModal\.value = true/)
  })
})
