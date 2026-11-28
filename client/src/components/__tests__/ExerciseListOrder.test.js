// @vitest-environment happy-dom
// Fund 28.11.: Im Übungen-Tab (Liste ohne items) standen die neuen Übungen (IDs 9xxx) am Ende statt alphabetisch einsortiert,
// weil der Katalog in ID-Reihenfolge geliefert wurde.
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'

const mk = (id, name, extra = {}) => ({ _id: `ex_${id}`, id, name, name_en: name.toLowerCase(), category: 'Push', muscleGroup: 'Brust', equipment: 'Körpergewicht', description: 'd', description_en: 'd', imageUrl: '', thumbnailUrl: '', ...extra })
// Katalogreihenfolge = ID-Reihenfolge: neue Übungen mit hoher ID zuletzt
const CATALOG = [mk('0025', 'Bench Press'), mk('0100', 'Row'), mk('0662', 'Push-Up'), mk('0900', 'Zercher Squat'), mk('9019', 'Plank'), mk('9022', 'Dead Hang'), mk('9025', 'Crow Pose')]

vi.mock('@/utils/firebaseAuth', () => ({ useFirebaseAuth: () => ({ getIdToken: async () => null, user: { value: null } }), getCurrentUser: () => null, getIdToken: async () => null }))
vi.mock('@/utils/defaultExercisesLoader', () => ({ loadDefaultExercises: async () => CATALOG, getCachedDefaultExercises: () => CATALOG }))

import ExerciseList from '../ExerciseList.vue'
import { createI18nInstance } from '@/i18n'

async function titles(props) {
  const i18n = createI18nInstance(); i18n.global.locale.value = 'en'
  const w = mount(ExerciseList, { props: { showTitle: false, showControls: true, ...props }, global: { plugins: [createPinia(), i18n] } })
  await flushPromises(); await new Promise((r) => setTimeout(r, 30)); await flushPromises()
  const out = w.findAll('.exercise-card .title').map((t) => t.text().trim())
  w.unmount()
  return out
}

describe('ExerciseList: Reihenfolge', () => {
  it('Übungen-Tab (ohne items): alphabetisch, neue Übungen stehen nicht am Ende', async () => {
    const list = await titles({})
    expect(list).toEqual(['Bench Press', 'Crow Pose', 'Dead Hang', 'Plank', 'Push-Up', 'Row', 'Zercher Squat'])
  })

  it('Gegenprobe: eine mitgegebene Liste (Builder) wird ebenfalls alphabetisch angezeigt, nichts geht verloren', async () => {
    const list = await titles({ items: [CATALOG[6], CATALOG[0], CATALOG[4]] })
    expect(list).toEqual(['Bench Press', 'Crow Pose', 'Plank'])
  })
})
