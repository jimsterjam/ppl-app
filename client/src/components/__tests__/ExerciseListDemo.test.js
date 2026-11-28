// @vitest-environment happy-dom
// Medien-Fenster der Übungsliste: Übung ohne Foto/Video zeigt die Strichfiguren-Demo, Übung mit Video wie bisher.
// Das Fenster hängt am body (Teleport), sperrt das Scrollen des Hintergrunds und lädt für Demo-Übungen keine Medien nach.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'

vi.mock('@/utils/firebaseAuth', () => ({ useFirebaseAuth: () => ({ getIdToken: async () => null, user: { value: null } }), getCurrentUser: () => null, getIdToken: async () => null }))
vi.mock('@/utils/assetResolver', async (importOriginal) => ({
  ...(await importOriginal()),
  resolveExerciseMedia: vi.fn(() => Promise.resolve())
}))

import ExerciseList from '../ExerciseList.vue'
import { createI18nInstance } from '@/i18n'
import { resolveExerciseMedia } from '@/utils/assetResolver'
import { __resetScrollLockForTests } from '@/composables/useScrollLock'

const PLANK = { _id: 'ex_9019', id: '9019', name: 'Plank', name_en: 'plank', category: 'Core', muscleGroup: 'Bauch', equipment: 'Körpergewicht', description: 'd', description_en: 'd', imageUrl: '', thumbnailUrl: '' }
const BENCH = { _id: 'ex_0025', id: '0025', name: 'Bankdrücken', name_en: 'bench press', category: 'Push', muscleGroup: 'Brust', equipment: 'Langhantel', description: 'd', description_en: 'd', imageUrl: '/exercises/static/180/0025.jpg', thumbnailUrl: '' }

let wrapper
async function open(items, index) {
  const i18n = createI18nInstance(); i18n.global.locale.value = 'de'
  wrapper = mount(ExerciseList, { props: { showTitle: false, showControls: false, items, selectable: false, selectedIds: [] }, global: { plugins: [createPinia(), i18n] } })
  await flushPromises(); await new Promise((r) => setTimeout(r, 30)); await flushPromises()
  await wrapper.findAll('img.thumb')[index].trigger('click')
  await flushPromises()
  return { w: wrapper, i18n }
}
const overlay = () => document.body.querySelector('.media-overlay')

beforeEach(() => {
  __resetScrollLockForTests()
  document.body.style.overflow = ''
  resolveExerciseMedia.mockClear()
  vi.stubGlobal('requestAnimationFrame', () => 1)
  vi.stubGlobal('cancelAnimationFrame', () => {})
})
afterEach(() => { wrapper?.unmount(); wrapper = null; __resetScrollLockForTests(); vi.unstubAllGlobals() })

describe('ExerciseList: Medien-Fenster', () => {
  it('Übung ohne Foto/Video: Demo statt Bild, mit dem bestehenden Hinweistext', async () => {
    const { i18n } = await open([PLANK, BENCH], 0)
    const o = overlay()
    expect(o).toBeTruthy()
    expect(o.querySelector('svg.exercise-demo')).toBeTruthy()
    expect(o.querySelector('img.media-image')).toBeNull()
    expect(o.querySelector('video')).toBeNull()
    expect(o.querySelector('.media-disclaimer').textContent).toBe(i18n.global.t('exercises.mediaDisclaimer'))
    expect(o.querySelector('.media-disclaimer').textContent).toMatch(/nur zur Orientierung/)
  })

  it('Gegenprobe: Übung mit Foto/Video zeigt keine Demo', async () => {
    await open([PLANK, BENCH], 1)
    const o = overlay()
    expect(o).toBeTruthy()
    expect(o.querySelector('svg.exercise-demo')).toBeNull()
    expect(o.querySelector('img.media-image, video')).toBeTruthy()
  })

  it('Review 28.11.: Beschriftung der Grafik ist der angezeigte Name, nicht der Katalogschlüssel', async () => {
    await open([PLANK, BENCH], 0)
    const label = overlay().querySelector('svg.exercise-demo').getAttribute('aria-label')
    expect(label).toBe('Plank')
    expect(label).not.toBe('plank')
  })

  it('Review 28.11.: das Fenster hängt am body, nicht im Listen-Baustein', async () => {
    const { w } = await open([PLANK, BENCH], 0)
    expect(overlay().parentElement).toBe(document.body)
    expect(w.find('.media-overlay').exists()).toBe(false)
  })

  it('Review 28.11.: solange die Großansicht offen ist, ist das Scrollen des Hintergrunds gesperrt; danach wieder frei', async () => {
    const { w } = await open([PLANK, BENCH], 0)
    expect(document.body.style.overflow).toBe('hidden')
    overlay().querySelector('.close-btn').click()
    await flushPromises()
    expect(overlay()).toBeNull()
    expect(document.body.style.overflow).not.toBe('hidden')
    w.unmount(); wrapper = null
  })

  it('Review 28.11.: wird die Liste bei offener Großansicht entfernt, ist die Sperre trotzdem weg', async () => {
    const { w } = await open([PLANK, BENCH], 0)
    expect(document.body.style.overflow).toBe('hidden')
    w.unmount(); wrapper = null
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  it('Review 28.11.: für Demo-Übungen werden keine Medien nachgeladen, für Übungen mit Video schon', async () => {
    await open([PLANK, BENCH], 0)
    expect(resolveExerciseMedia).not.toHaveBeenCalled()
    wrapper.unmount()
    await open([PLANK, BENCH], 1)
    expect(resolveExerciseMedia).toHaveBeenCalledTimes(1)
  })
})
