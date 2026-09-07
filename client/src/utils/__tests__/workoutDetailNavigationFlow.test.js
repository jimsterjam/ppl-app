import { describe, it, expect, vi } from 'vitest'
import { applyPendingTimerAction, onTimerDecision } from '../workoutDetailNavigationFlow.js'

// Regressionstests für den Timer-Leave-Guard (WorkoutDetailView.vue's onBeforeRouteLeave-Hook
// ruft applyPendingTimerAction() mit kind:'route-leave' auf, sobald der Nutzer die Route bei
// laufendem Session-Timer verlassen will). Dieser Guard war zwischenzeitlich komplett
// auskommentiert - dadurch konnte man während eines laufenden Timers ohne jede Warnung aus
// einer aktiven Trainingssession navigieren. Die Infrastruktur hier (applyPendingTimerAction/
// onTimerDecision) war davon nicht betroffen, ist aber die Stelle, die den eigentlichen
// Übergang nach der Nutzer-Entscheidung ("weiterlaufen"/"pausieren"/"stoppen") umsetzt - diese
// Tests stellen sicher, dass diese Übergänge bei einer künftigen Änderung nicht unbemerkt
// kaputtgehen, auch wenn der Guard-Aufruf selbst (in der riesigen .vue-Datei) hier nicht
// mitgetestet wird.

function makeDeps(overrides = {}) {
  return {
    pendingTimerAction: { value: null },
    performSaveWorkout: vi.fn(),
    discardDraftAndLeave: vi.fn(),
    bypassTimerLeaveGuard: { value: false },
    router: { push: vi.fn() },
    ...overrides
  }
}

describe('applyPendingTimerAction', () => {
  it('tut nichts, wenn keine pendingTimerAction gesetzt ist', async () => {
    const deps = makeDeps()
    await applyPendingTimerAction(deps)
    expect(deps.performSaveWorkout).not.toHaveBeenCalled()
    expect(deps.discardDraftAndLeave).not.toHaveBeenCalled()
    expect(deps.router.push).not.toHaveBeenCalled()
  })

  it('kind "save": ruft performSaveWorkout mit updateFavorite/deferAiFeedback auf und leert pendingTimerAction', async () => {
    const deps = makeDeps({
      pendingTimerAction: { value: { kind: 'save', updateFavorite: true, deferAiFeedback: true } }
    })
    await applyPendingTimerAction(deps)
    expect(deps.performSaveWorkout).toHaveBeenCalledWith(true, { deferAiFeedback: true })
    expect(deps.pendingTimerAction.value).toBeNull()
  })

  it('kind "dashboard": ruft discardDraftAndLeave auf', async () => {
    const deps = makeDeps({ pendingTimerAction: { value: { kind: 'dashboard' } } })
    await applyPendingTimerAction(deps)
    expect(deps.discardDraftAndLeave).toHaveBeenCalledTimes(1)
  })

  it('kind "route-leave" mit targetPath: setzt bypassTimerLeaveGuard und navigiert dorthin', async () => {
    const deps = makeDeps({
      pendingTimerAction: { value: { kind: 'route-leave', targetPath: '/dashboard' } }
    })
    await applyPendingTimerAction(deps)
    expect(deps.bypassTimerLeaveGuard.value).toBe(true)
    expect(deps.router.push).toHaveBeenCalledWith('/dashboard')
  })

  it('kind "route-leave" ohne targetPath: navigiert NICHT (kein Ziel bekannt)', async () => {
    const deps = makeDeps({ pendingTimerAction: { value: { kind: 'route-leave' } } })
    await applyPendingTimerAction(deps)
    expect(deps.router.push).not.toHaveBeenCalled()
  })
})

describe('onTimerDecision', () => {
  function makeDecisionDeps(overrides = {}) {
    return {
      mode: 'continue',
      pendingTimerAction: { value: { kind: 'route-leave', targetPath: '/stats' } },
      showTimerActionModal: { value: true },
      timerStore: { isRunning: true, pause: vi.fn(), reset: vi.fn() },
      applyPendingTimerAction: vi.fn(),
      ...overrides
    }
  }

  it('mode "continue": verwirft die pending Action, schließt das Modal, navigiert NICHT weiter', async () => {
    const deps = makeDecisionDeps({ mode: 'continue' })
    await onTimerDecision(deps)
    expect(deps.pendingTimerAction.value).toBeNull()
    expect(deps.showTimerActionModal.value).toBe(false)
    expect(deps.applyPendingTimerAction).not.toHaveBeenCalled()
    expect(deps.timerStore.pause).not.toHaveBeenCalled()
  })

  it('mode "pause" bei laufendem Timer: pausiert den Timer und führt die pending Action anschließend aus', async () => {
    const deps = makeDecisionDeps({ mode: 'pause', timerStore: { isRunning: true, pause: vi.fn(), reset: vi.fn() } })
    await onTimerDecision(deps)
    expect(deps.timerStore.pause).toHaveBeenCalledTimes(1)
    expect(deps.timerStore.reset).not.toHaveBeenCalled()
    expect(deps.showTimerActionModal.value).toBe(false)
    expect(deps.applyPendingTimerAction).toHaveBeenCalledTimes(1)
  })

  it('mode "pause" bei bereits gestopptem Timer: ruft pause() nicht auf, führt die pending Action trotzdem aus', async () => {
    const deps = makeDecisionDeps({ mode: 'pause', timerStore: { isRunning: false, pause: vi.fn(), reset: vi.fn() } })
    await onTimerDecision(deps)
    expect(deps.timerStore.pause).not.toHaveBeenCalled()
    expect(deps.applyPendingTimerAction).toHaveBeenCalledTimes(1)
  })

  it('mode "stop": setzt den Timer zurück und führt die pending Action anschließend aus', async () => {
    const deps = makeDecisionDeps({ mode: 'stop' })
    await onTimerDecision(deps)
    expect(deps.timerStore.reset).toHaveBeenCalledTimes(1)
    expect(deps.applyPendingTimerAction).toHaveBeenCalledTimes(1)
  })
})
