// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import AppModal from '../AppModal.vue'
import { createI18nInstance } from '@/i18n'
import { __resetScrollLockForTests } from '@/composables/useScrollLock'

// Fund 11.11.: AppModal sperrte nur, wenn es nach dem Einhängen geöffnet wurde - ein gleich offen eingehängtes
// Fenster ließ den Hintergrund scrollen.
describe('AppModal sperrt den Hintergrund', () => {
  beforeEach(() => {
    __resetScrollLockForTests()
    document.body.removeAttribute('style')
  })
  const mountModal = (modelValue) =>
    mount(AppModal, { props: { modelValue, title: 'T' }, global: { plugins: [createI18nInstance()], stubs: { teleport: true } } })

  it('auch wenn es gleich offen eingehängt wird', async () => {
    const w = mountModal(true)
    await nextTick()
    expect(document.body.style.overflow).toBe('hidden')
    w.unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('beim Öffnen sperren, beim Schließen freigeben', async () => {
    const w = mountModal(false)
    expect(document.body.style.overflow).toBe('')
    await w.setProps({ modelValue: true })
    expect(document.body.style.overflow).toBe('hidden')
    await w.setProps({ modelValue: false })
    expect(document.body.style.overflow).toBe('')
  })
})
