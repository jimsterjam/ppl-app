// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ExerciseDemo from '../ExerciseDemo.vue'
import { EXERCISE_DEMOS } from '@/utils/exerciseDemo/demos'

const plank = EXERCISE_DEMOS.find((d) => d.id === '9019')
const tuck = EXERCISE_DEMOS.find((d) => d.id === '9013')
const hang = EXERCISE_DEMOS.find((d) => d.id === '9022')

let rafCallbacks
let nextRafId
let cancelSpy

function setReducedMotion(on) {
  vi.stubGlobal('matchMedia', (q) => ({ matches: on && /reduce/.test(q), media: q, addEventListener() {}, removeEventListener() {} }))
  window.matchMedia = globalThis.matchMedia
}

// Zeit von Hand vorrücken: ruft den zuletzt registrierten Rückruf mit der gewünschten Zeit auf
async function advanceTo(ms) {
  const entries = [...rafCallbacks.entries()]
  rafCallbacks.clear()
  for (const [, cb] of entries) cb(ms)
  await nextTick()
}

beforeEach(() => {
  rafCallbacks = new Map()
  nextRafId = 1
  cancelSpy = vi.fn((id) => rafCallbacks.delete(id))
  vi.stubGlobal('requestAnimationFrame', (cb) => { const id = nextRafId++; rafCallbacks.set(id, cb); return id })
  vi.stubGlobal('cancelAnimationFrame', cancelSpy)
  window.requestAnimationFrame = globalThis.requestAnimationFrame
  window.cancelAnimationFrame = globalThis.cancelAnimationFrame
  setReducedMotion(false)
})
afterEach(() => { vi.unstubAllGlobals() })

describe('ExerciseDemo', () => {
  it('zeichnet eine Grafik mit Übungsnamen als zugänglichem Namen', () => {
    const w = mount(ExerciseDemo, { props: { demo: plank, title: 'plank' } })
    const svg = w.find('svg')
    expect(svg.exists()).toBe(true)
    expect(svg.attributes('role')).toBe('img')
    expect(svg.attributes('aria-label')).toBe('plank')
    expect(w.findAll('line.limb').length).toBeGreaterThanOrEqual(10) // 5 hintere + 6 vordere Segmente
    expect(w.find('circle.head').exists()).toBe(true)
    // Hinweistext kommt vom umgebenden Dialog, nicht von der Komponente
    expect(w.text()).toBe('')
  })

  it('statische Übung: keine Animation, Leuchten dauerhaft', async () => {
    const w = mount(ExerciseDemo, { props: { demo: plank, title: 'plank' } })
    await nextTick()
    expect(rafCallbacks.size).toBe(0)
    expect(w.find('.ed-halo').classes()).toContain('on')
  })

  it('animierte Übung: bewegt sich, Leuchten nur in der Haltephase', async () => {
    const w = mount(ExerciseDemo, { props: { demo: tuck, title: 'tuck planche' } })
    expect(rafCallbacks.size).toBe(1)
    await advanceTo(1000)                    // Beginn (Zeit 0), Start ruht
    const startLine = w.findAll('line.limb:not(.far)')[1].attributes('x2') // Hüfte -> Knie
    expect(w.find('.ed-halo').classes()).not.toContain('on')
    await advanceTo(1000 + 1000 + 1500 + 1000) // mitten in der Haltephase (1,0 + 1,5 + 1,0 s)
    expect(w.find('.ed-halo').classes()).toContain('on')
    const holdLine = w.findAll('line.limb:not(.far)')[1].attributes('x2')
    expect(holdLine).not.toBe(startLine)      // Figur hat sich bewegt
    await advanceTo(1000 + 5600)              // Rückweg (5,3..6,6 s): nicht mehr halten
    expect(w.find('.ed-halo').classes()).not.toContain('on')
  })

  it('läuft weiter (nächstes Bild angefordert), solange die Komponente da ist', async () => {
    mount(ExerciseDemo, { props: { demo: hang, title: 'dead hang' } })
    await advanceTo(0)
    expect(rafCallbacks.size).toBe(1)
    await advanceTo(16)
    expect(rafCallbacks.size).toBe(1)
  })

  it('beim Entfernen wird die Animation gestoppt', async () => {
    const w = mount(ExerciseDemo, { props: { demo: tuck, title: 'tuck planche' } })
    await advanceTo(0)
    w.unmount()
    expect(cancelSpy).toHaveBeenCalled()
    expect(rafCallbacks.size).toBe(0)
  })

  it('Gegenprobe: "Bewegung reduzieren" zeigt nur das Ruhebild der Haltung, keine Animation', async () => {
    setReducedMotion(true)
    const w = mount(ExerciseDemo, { props: { demo: tuck, title: 'tuck planche' } })
    await nextTick()
    expect(rafCallbacks.size).toBe(0)
    expect(w.find('.ed-halo').classes()).toContain('on')
    const x = w.findAll('line.limb:not(.far)')[1].attributes('x2')
    await advanceTo(5000)
    expect(w.findAll('line.limb:not(.far)')[1].attributes('x2')).toBe(x)
  })

  it('erstes Bild einer animierten Übung ist der Start, nicht die Endhaltung (kein Sprung beim Öffnen)', () => {
    const w = mount(ExerciseDemo, { props: { demo: tuck, title: 'tuck planche' } })
    expect(w.find('.ed-halo').classes()).not.toContain('on')
  })

  it('Wechsel der Demo startet neu und zeigt die neue Übung', async () => {
    const w = mount(ExerciseDemo, { props: { demo: plank, title: 'plank' } })
    expect(w.find('.box').exists()).toBe(false)
    await w.setProps({ demo: hang, title: 'dead hang' })
    await nextTick()
    expect(w.find('.box').exists()).toBe(true) // Kiste nur beim Dead Hang
    expect(rafCallbacks.size).toBe(1)
  })
})
