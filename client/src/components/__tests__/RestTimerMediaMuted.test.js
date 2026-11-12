// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/utils/timerAudio', () => ({ emitTimerSignal: vi.fn(), ensureAudioUnlocked: vi.fn(), clearSignalHistory: vi.fn() }))
vi.mock('@/utils/restEndSignal', () => ({
  buildRestNotification: vi.fn(),
  NOTIFICATION_DELAY_MS: 0,
  scheduleRestEndSignal: vi.fn().mockResolvedValue(undefined),
  cancelRestEndSignal: vi.fn().mockResolvedValue(undefined)
}))
vi.mock('@/utils/nativeTimerSound', () => ({
  isNativeTimerSoundReady: () => false,
  probeNativeTimerSound: () => Promise.resolve(false),
  scheduleNativeTimerSounds: () => Promise.resolve(false),
  cancelNativeTimerSounds: () => Promise.resolve(),
  getMediaVolume: () => Promise.resolve(null),
  onMediaVolumeChange: () => () => {}
}))

import RestTimerBar from '../timer/RestTimerBar.vue'
import { createI18nInstance } from '@/i18n'
import { useRestTimerStore } from '@/stores/restTimerStore'

const DE = 'Medienlautstärke ist aus'

function mountBar(pinia) {
  const i18n = createI18nInstance()
  i18n.global.locale.value = 'de'
  return mount(RestTimerBar, { global: { plugins: [pinia, i18n], stubs: { teleport: true } } })
}

// Absprache Jimmy 12.11.: Hinweis, wenn die Medienlautstärke auf 0 steht (Gong und 3-2-1 wären nicht zu hören).
describe('Pausentimer: Hinweis Medienlautstärke', () => {
  let pinia
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  it('Lautstärke 0: Hinweis in der großen Anzeige und in der Leiste', async () => {
    const rest = useRestTimerStore()
    rest.start({ seconds: 60 })
    rest.mediaVolume = 0
    const w = mountBar(pinia)
    await w.vm.$nextTick()
    expect(w.find('.ro-muted').text()).toContain(DE)
    rest.minimize()
    await w.vm.$nextTick()
    expect(w.find('.rest-muted').text()).toContain(DE)
    rest.clear()
  })

  it('Gegenprobe: Lautstärke > 0 oder unbekannt -> kein Hinweis', async () => {
    const rest = useRestTimerStore()
    rest.start({ seconds: 60 })
    const w = mountBar(pinia)
    for (const volume of [0.3, null]) {
      rest.mediaVolume = volume
      await w.vm.$nextTick()
      expect(w.text()).not.toContain(DE)
    }
    rest.clear()
  })
})
