// Regression (Web-Version ohne Firebase-Konfiguration): useFirebaseAuth() wirft dann einen Fehler. Der Router-Guard brach
// dadurch jede Navigation ab, auch die zu den öffentlichen Seiten Datenschutz und Impressum (leere Seite).
import { describe, it, expect, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// Kein Browser in der Testumgebung: Router mit Speicher-Verlauf statt Browser-Verlauf.
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, createWebHistory: () => actual.createMemoryHistory() }
})

vi.mock('@/utils/firebaseAuth', () => ({
  useFirebaseAuth: () => { throw new Error('Firebase not initialized') },
  isEffectivelyEmailVerified: () => false
}))

describe('Router ohne Firebase', () => {
  it('öffentliche Seiten sind erreichbar', async () => {
    setActivePinia(createPinia())
    const { default: router } = await import('../index.js')
    for (const [path, name] of [['/privacy', 'privacy'], ['/legal', 'legal']]) {
      await router.push(path)
      expect(router.currentRoute.value.name).toBe(name)
    }
  })
})
