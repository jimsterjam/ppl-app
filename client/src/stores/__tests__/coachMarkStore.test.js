import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCoachMarkStore } from '../coachMarkStore.js'

beforeEach(() => {
  const data = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k)
  })
  setActivePinia(createPinia())
})

describe('coachMarkStore', () => {
  it('Standard: eingeschaltet, nichts abgehakt', () => {
    const store = useCoachMarkStore()
    store.switchUser('u1')
    expect(store.enabled).toBe(true)
    expect(store.isDismissed('coach-week')).toBe(false)
  })

  it('„Verstanden“ wird gemerkt, überlebt Neuladen, gilt nur für dieses Konto', () => {
    const store = useCoachMarkStore()
    store.switchUser('u1')
    store.dismiss('coach-week')
    store.dismiss('coach-week')
    expect(store.dismissed).toEqual(['coach-week'])
    setActivePinia(createPinia())
    const fresh = useCoachMarkStore()
    fresh.switchUser('u1')
    expect(fresh.isDismissed('coach-week')).toBe(true)
    fresh.switchUser('u2')
    expect(fresh.isDismissed('coach-week')).toBe(false)
  })

  it('Ausschalten wird gemerkt; Zurücksetzen zeigt alles wieder und schaltet ein', () => {
    const store = useCoachMarkStore()
    store.switchUser('u1')
    store.dismiss('coach-week')
    store.setEnabled(false)
    store.switchUser('u1')
    expect(store.enabled).toBe(false)
    store.resetAll()
    expect(store.enabled).toBe(true)
    expect(store.dismissed).toEqual([])
    store.switchUser('u1')
    expect(store.isDismissed('coach-week')).toBe(false)
  })

  it('kaputter Speicher fällt auf den Standard zurück', () => {
    localStorage.setItem('coach-marks:u1', '{kaputt')
    const store = useCoachMarkStore()
    store.switchUser('u1')
    expect(store.enabled).toBe(true)
    expect(store.dismissed).toEqual([])
  })
})
