// @vitest-environment happy-dom
// Medien-Fenster der Übungsliste: Übung ohne Foto/Video zeigt die Strichfiguren-Demo, Übung mit Video wie bisher.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'

vi.mock('@/utils/firebaseAuth', () => ({ useFirebaseAuth: () => ({ getIdToken: async () => null, user: { value: null } }), getCurrentUser: () => null, getIdToken: async () => null }))

import ExerciseList from '../ExerciseList.vue'
import { createI18nInstance } from '@/i18n'

const PLANK = { _id: 'ex_9019', id: '9019', name: 'Plank', name_en: 'plank', category: 'Core', muscleGroup: 'Bauch', equipment: 'Körpergewicht', description: 'd', description_en: 'd', imageUrl: '', thumbnailUrl: '' }
const BENCH = { _id: 'ex_0025', id: '0025', name: 'Bankdrücken', name_en: 'bench press', category: 'Push', muscleGroup: 'Brust', equipment: 'Langhantel', description: 'd', description_en: 'd', imageUrl: '/exercises/static/180/0025.jpg', thumbnailUrl: '' }

async function open(items, index) {
  const i18n = createI18nInstance(); i18n.global.locale.value = 'de'
  const w = mount(ExerciseList, { props: { showTitle: false, showControls: false, items, selectable: false, selectedIds: [] }, global: { plugins: [createPinia(), i18n] } })
  await flushPromises(); await new Promise((r) => setTimeout(r, 30)); await flushPromises()
  await w.findAll('img.thumb')[index].trigger('click')
  await flushPromises()
  return { w, i18n }
}

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 1)
  vi.stubGlobal('cancelAnimationFrame', () => {})
})

describe('ExerciseList: Medien-Fenster', () => {
  it('Übung ohne Foto/Video: Demo statt Bild, mit dem bestehenden Hinweistext', async () => {
    const { w, i18n } = await open([PLANK, BENCH], 0)
    const overlay = w.find('.media-overlay')
    expect(overlay.exists()).toBe(true)
    expect(overlay.find('svg.exercise-demo').exists()).toBe(true)
    expect(overlay.find('img.media-image').exists()).toBe(false)
    expect(overlay.find('video').exists()).toBe(false)
    expect(overlay.find('.media-disclaimer').text()).toBe(i18n.global.t('exercises.mediaDisclaimer'))
    expect(overlay.find('.media-disclaimer').text()).toMatch(/nur zur Orientierung/)
  })

  it('Gegenprobe: Übung mit Foto/Video zeigt keine Demo', async () => {
    const { w } = await open([PLANK, BENCH], 1)
    const overlay = w.find('.media-overlay')
    expect(overlay.exists()).toBe(true)
    expect(overlay.find('svg.exercise-demo').exists()).toBe(false)
    expect(overlay.find('img.media-image, video').exists()).toBe(true)
  })
})
