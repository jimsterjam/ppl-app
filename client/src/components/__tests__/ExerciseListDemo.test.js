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
// ältere Übung ohne Foto/Video und ohne Demo (Snatch, ID 9009)
const CROW = { _id: 'ex_9009', id: '9009', name: 'Snatch', name_en: 'snatch', category: 'Legs', muscleGroup: 'Quadrizeps', equipment: 'Langhantel', description: 'd', description_en: 'd', imageUrl: '/exercises/static/180/9009.jpg', thumbnailUrl: '' }
const BENCH = { _id: 'ex_0025', id: '0025', name: 'Bankdrücken', name_en: 'bench press', category: 'Push', muscleGroup: 'Brust', equipment: 'Langhantel', description: 'd', description_en: 'd', imageUrl: '/exercises/static/180/0025.jpg', thumbnailUrl: '' }

let wrapper
// Die Liste ist alphabetisch sortiert: die Karte wird über den Namen gesucht, nicht über die Position
async function open(items, exercise) {
  const i18n = createI18nInstance(); i18n.global.locale.value = 'de'
  wrapper = mount(ExerciseList, { props: { showTitle: false, showControls: false, items, selectable: false, selectedIds: [] }, global: { plugins: [createPinia(), i18n] } })
  await flushPromises(); await new Promise((r) => setTimeout(r, 30)); await flushPromises()
  const titles = wrapper.findAll('.exercise-card .title').map((t) => t.text().trim().toLowerCase())
  const index = titles.findIndex((t) => t.includes(exercise.name.toLowerCase()) || t.includes(exercise.name_en))
  expect(index, `Karte für ${exercise.name} gefunden`).toBeGreaterThanOrEqual(0)
  await wrapper.findAll('.thumb')[index].trigger('click')
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
    const { i18n } = await open([PLANK, BENCH], PLANK)
    const o = overlay()
    expect(o).toBeTruthy()
    expect(o.querySelector('svg.exercise-demo')).toBeTruthy()
    expect(o.querySelector('img.media-image')).toBeNull()
    expect(o.querySelector('video')).toBeNull()
    expect(o.querySelector('.media-disclaimer').textContent).toBe(i18n.global.t('exercises.mediaDisclaimer'))
    expect(o.querySelector('.media-disclaimer').textContent).toMatch(/nur zur Orientierung/)
  })

  it('Gegenprobe: Übung mit Foto/Video zeigt keine Demo', async () => {
    await open([PLANK, BENCH], BENCH)
    const o = overlay()
    expect(o).toBeTruthy()
    expect(o.querySelector('svg.exercise-demo')).toBeNull()
    expect(o.querySelector('img.media-image, video')).toBeTruthy()
  })

  it('Review 28.11.: Beschriftung der Grafik ist der angezeigte Name, nicht der Katalogschlüssel', async () => {
    await open([PLANK, BENCH], PLANK)
    const label = overlay().querySelector('svg.exercise-demo').getAttribute('aria-label')
    expect(label).toBe('Plank')
    expect(label).not.toBe('plank')
  })

  it('Review 28.11.: das Fenster hängt am body, nicht im Listen-Baustein', async () => {
    const { w } = await open([PLANK, BENCH], PLANK)
    expect(overlay().parentElement).toBe(document.body)
    expect(w.find('.media-overlay').exists()).toBe(false)
  })

  it('Review 28.11.: solange die Großansicht offen ist, ist das Scrollen des Hintergrunds gesperrt; danach wieder frei', async () => {
    const { w } = await open([PLANK, BENCH], PLANK)
    expect(document.body.style.overflow).toBe('hidden')
    overlay().querySelector('.close-btn').click()
    await flushPromises()
    expect(overlay()).toBeNull()
    expect(document.body.style.overflow).not.toBe('hidden')
    w.unmount(); wrapper = null
  })

  it('Review 28.11.: wird die Liste bei offener Großansicht entfernt, ist die Sperre trotzdem weg', async () => {
    const { w } = await open([PLANK, BENCH], PLANK)
    expect(document.body.style.overflow).toBe('hidden')
    w.unmount(); wrapper = null
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  it('Review 28.11.: für Demo-Übungen werden keine Medien nachgeladen, für Übungen mit Video schon', async () => {
    await open([PLANK, BENCH], PLANK)
    expect(resolveExerciseMedia).not.toHaveBeenCalled()
    wrapper.unmount()
    await open([PLANK, BENCH], BENCH)
    expect(resolveExerciseMedia).toHaveBeenCalledTimes(1)
  })

  it('Kleine Vorschau: Übung mit Demo zeigt ein Standbild statt des Platzhalters, Tippen öffnet die Animation', async () => {
    const { w } = await open([PLANK, BENCH], PLANK)
    // geöffnet über das Standbild
    expect(overlay().querySelector('svg.exercise-demo:not(.is-still)')).toBeTruthy()
    overlay().querySelector('.close-btn').click()
    await flushPromises()
    const btn = w.find('button.thumb--demo')
    const still = btn.find('svg.exercise-demo.is-still')
    expect(still.exists()).toBe(true)
    // der Knopf trägt den Namen, das Bild darin ist dekorativ (sonst liest VoiceOver den Namen doppelt)
    expect(btn.attributes('aria-label')).toBe('Plank')
    expect(still.attributes('aria-hidden')).toBe('true')
    expect(still.attributes('role')).toBeUndefined()
    // das Standbild bewegt sich nicht und hat weder Leuchten noch Gelenkpunkte
    expect(btn.find('.ed-halo').exists()).toBe(false)
    expect(btn.find('.joint').exists()).toBe(false)
    const vb = still.attributes('viewBox').split(' ').map(Number)
    expect(vb[2]).toBe(vb[3]) // quadratischer Ausschnitt
  })

  it('Gegenprobe: Übung mit Foto/Video behält ihr Vorschaubild', async () => {
    const { w } = await open([PLANK, BENCH], BENCH)
    const cards = w.findAll('.exercise-card')
    const byTitle = (name) => cards.find((c) => c.find('.title').text().toLowerCase().includes(name))
    expect(byTitle('plank').find('.thumb').element.tagName).toBe('BUTTON')
    expect(byTitle('bank').find('.thumb').element.tagName).toBe('IMG')
    expect(w.findAll('.is-still')).toHaveLength(1)
  })

  it('Fund 28.11.: Übung ohne Demo und ohne Medien zeigt in der Großansicht den Platzhalter statt eines defekten Bildes', async () => {
    await open([PLANK, CROW], CROW)
    const o = overlay()
    expect(o.querySelector('svg.exercise-demo')).toBeNull()
    // erst Video (nicht vorhanden) -> Foto (nicht vorhanden) -> Platzhalter
    const video = o.querySelector('video')
    if (video) { video.dispatchEvent(new Event('error')); await flushPromises() }
    const img = overlay().querySelector('img.media-image')
    expect(img).toBeTruthy()
    img.dispatchEvent(new Event('error'))
    await flushPromises()
    expect(overlay().querySelector('img.media-image').getAttribute('src')).toBe('/exercises/play.svg')
    // und keine Endlosschleife: der Platzhalter selbst löst nichts mehr aus
    overlay().querySelector('img.media-image').dispatchEvent(new Event('error'))
    await flushPromises()
    expect(overlay().querySelector('img.media-image').getAttribute('src')).toBe('/exercises/play.svg')
  })
})
