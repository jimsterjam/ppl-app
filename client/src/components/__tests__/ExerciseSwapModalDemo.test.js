// @vitest-environment happy-dom
// Tauschen-Fenster: Vorschau einer Übung ohne Foto/Video zeigt die Strichfiguren-Demo, Übung mit Video wie bisher.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'

const PLANK = { _id: 'ex_9019', id: '9019', name: 'Plank', name_en: 'plank', category: 'Core', muscleGroup: 'Bauch', equipment: 'Körpergewicht', imageUrl: '', thumbnailUrl: '' }
const BENCH = { _id: 'ex_0025', id: '0025', name: 'Bankdrücken', name_en: 'bench press', category: 'Push', muscleGroup: 'Brust', equipment: 'Langhantel', imageUrl: '/exercises/static/180/0025.jpg', thumbnailUrl: '' }

vi.mock('@/utils/firebaseAuth', () => ({ useFirebaseAuth: () => ({ getIdToken: async () => null, user: { value: null } }), getCurrentUser: () => null, getIdToken: async () => null }))
vi.mock('@/utils/defaultExercisesLoader', () => ({ loadDefaultExercises: async () => [PLANK, BENCH], getCachedDefaultExercises: () => [PLANK, BENCH] }))
vi.mock('@/utils/assetResolver', async (importOriginal) => ({
  ...(await importOriginal()),
  resolveExerciseMedia: vi.fn(() => Promise.resolve())
}))
vi.mock('@/utils/exerciseSwaps', () => ({
  getSwapSuggestions: () => [{ entry: PLANK, kind: 'similar' }, { entry: BENCH, kind: 'similar' }]
}))

import ExerciseSwapModal from '../ExerciseSwapModal.vue'
import { createI18nInstance } from '@/i18n'
import { resolveExerciseMedia } from '@/utils/assetResolver'

let wrapper
async function openPreview(index) {
  const i18n = createI18nInstance(); i18n.global.locale.value = 'de'
  wrapper = mount(ExerciseSwapModal, {
    props: { modelValue: false, exercise: { name: 'Push-Up', exerciseId: 'x' }, excludeNames: [], allExercises: [] },
    global: { plugins: [createPinia(), i18n] },
    attachTo: document.body
  })
  await wrapper.setProps({ modelValue: true })
  await flushPromises()
  await new Promise((r) => setTimeout(r, 20))
  await flushPromises()
  document.querySelectorAll('.swap-thumb-btn')[index].click()
  await flushPromises()
  return i18n
}

beforeEach(() => {
  resolveExerciseMedia.mockClear()
  vi.stubGlobal('requestAnimationFrame', () => 1)
  vi.stubGlobal('cancelAnimationFrame', () => {})
})
afterEach(() => { wrapper?.unmount(); vi.unstubAllGlobals() })

describe('ExerciseSwapModal: Vorschau', () => {
  it('Übung ohne Foto/Video: Demo statt Bild, mit dem bestehenden Hinweistext', async () => {
    const i18n = await openPreview(0)
    const preview = document.querySelector('.swap-preview')
    expect(preview).toBeTruthy()
    expect(preview.querySelector('svg.exercise-demo')).toBeTruthy()
    expect(preview.querySelector('img.swap-preview-media')).toBeNull()
    expect(preview.querySelector('video')).toBeNull()
    expect(preview.querySelector('.swap-hint').textContent).toBe(i18n.global.t('workoutDetail.mediaDisclaimer'))
  })

  it('Gegenprobe: Übung mit Foto/Video zeigt keine Demo', async () => {
    await openPreview(1)
    const preview = document.querySelector('.swap-preview')
    expect(preview).toBeTruthy()
    expect(preview.querySelector('svg.exercise-demo')).toBeNull()
    expect(preview.querySelector('img.swap-preview-media, video.swap-preview-media')).toBeTruthy()
  })

  it('Review 28.11.: Beschriftung der Grafik ist der angezeigte Name wie in der Überschrift', async () => {
    await openPreview(0)
    const preview = document.querySelector('.swap-preview')
    const label = preview.querySelector('svg.exercise-demo').getAttribute('aria-label')
    expect(label).toBe(preview.querySelector('strong').textContent)
    expect(label).not.toBe('plank')
  })

  it('Review 28.11.: für Demo-Übungen werden keine Medien nachgeladen, für Übungen mit Video schon', async () => {
    await openPreview(0)
    expect(resolveExerciseMedia).not.toHaveBeenCalled()
    wrapper.unmount()
    await openPreview(1)
    expect(resolveExerciseMedia).toHaveBeenCalledTimes(1)
  })

  it('Schließen entfernt die Vorschau (und damit die Animation)', async () => {
    await openPreview(0)
    document.querySelector('.swap-preview-close').click()
    await flushPromises()
    expect(document.querySelector('.swap-preview')).toBeNull()
  })
})
