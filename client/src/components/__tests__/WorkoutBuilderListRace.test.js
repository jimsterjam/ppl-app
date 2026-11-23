// @vitest-environment happy-dom
// Regression (23.11.): Full Body zeigte im Builder nur Push-Übungen. Beim Öffnen startete ein Ladevorgang
// (z.B. durch die Anmeldung) noch mit der Standard-Tagesart "push"; kam er NACH dem Full-Body-Laden an,
// überschrieb er die Liste.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'

const ALL = [{ _id: 'a', name: 'Bench', category: 'Push' }, { _id: 'b', name: 'Tuck Planche', category: 'Core' }]
const PUSH = [ALL[0]]
let pushResolve = null
const mergedMock = vi.fn(({ category }) => {
  if (category === 'Push') return new Promise((res) => { pushResolve = () => res(PUSH) }) // langsam
  return Promise.resolve(ALL)
})

vi.mock('@/utils/exerciseList', () => ({ getMergedSortedExercises: (p) => mergedMock(p) }))
vi.mock('@/utils/defaultExercisesLoader', () => ({ loadDefaultExercises: () => Promise.resolve([]), getCachedDefaultExercises: () => [] }))
vi.mock('@/utils/offlineStorage', () => ({ saveWorkoutOffline: vi.fn() }))
vi.mock('@/utils/firebaseAuth', () => ({
  useFirebaseAuth: () => ({
    auth: {}, getIdToken: async () => null, getCurrentUser: () => null,
    onAuthStateChanged: (cb) => { Promise.resolve().then(() => cb({ uid: 'u1', email: 'a@b.c' })); return () => {} }
  })
}))
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal()),
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ query: { type: 'fullbody' } })
}))
vi.mock('@/components/BottomNav.vue', () => ({ default: { render: () => null } }))

import WorkoutBuilder from '../WorkoutBuilder.vue'
import { createI18nInstance } from '@/i18n'

const ListStub = defineComponent({ props: ['items'], setup(p) { return () => h('div', { class: 'list-stub', 'data-n': String(p.items?.length ?? -1) }) } })

describe('WorkoutBuilder: veralteter Ladevorgang darf die Liste nicht überschreiben', () => {
  beforeEach(() => { setActivePinia(createPinia()); pushResolve = null; mergedMock.mockClear() })

  it('Full Body bleibt Full Body, auch wenn ein früher Push-Aufruf zuletzt fertig wird', async () => {
    const w = mount(WorkoutBuilder, { global: { plugins: [createPinia(), createI18nInstance()], stubs: { ExerciseList: ListStub, StepIndicator: true, AppModal: true } } })
    await flushPromises()
    if (pushResolve) pushResolve() // der langsame Aufruf kommt zuletzt an
    await flushPromises()
    const n = w.find('.list-stub')?.attributes('data-n')
    expect(n).toBe(String(ALL.length))
  })
})
