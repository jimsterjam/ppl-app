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

// Selbstprüfung 13.11.: Bei der Favorit-Frage ist "Nein" eine Antwort (trotzdem speichern), ✕/daneben/Escape heißt zurück.
describe('AppModal: dismissSeparately', () => {
  const mountModal = (props) =>
    mount(AppModal, { props: { modelValue: true, title: 'T', ...props }, global: { plugins: [createI18nInstance()], stubs: { teleport: true } } })

  it('✕, Tippen daneben und Escape melden dismiss, der Abbrechen-Knopf cancel', async () => {
    const w = mountModal({ dismissSeparately: true })
    await nextTick()
    await w.find('button.close').trigger('click')
    await w.find('.modal-overlay').trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('dismiss')).toHaveLength(3)
    expect(w.emitted('cancel')).toBeUndefined()
    await w.find('button.btn.secondary').trigger('click')
    expect(w.emitted('cancel')).toHaveLength(1)
    w.unmount()
  })

  it('Gegenprobe: ohne die Angabe bleibt alles cancel (bestehende Fenster)', async () => {
    const w = mountModal({})
    await nextTick()
    await w.find('button.close').trigger('click')
    expect(w.emitted('cancel')).toHaveLength(1)
    expect(w.emitted('dismiss')).toBeUndefined()
    w.unmount()
  })
})

// "Kurz prüfen" mit offenen Sätzen (Absprache Jimmy 13.11.): Knöpfe untereinander, Hauptknopf oben, nicht als Link
describe('AppModal: stackedActions', () => {
  const mountModal = (props) =>
    mount(AppModal, { props: { modelValue: true, title: 'T', confirmText: 'Alle abhaken', cancelText: 'So speichern', ...props }, global: { plugins: [createI18nInstance()], stubs: { teleport: true } } })

  it('setzt die Klasse für die gestapelte Anordnung; Bestätigen steht im DOM nach Abbrechen (column-reverse = oben)', async () => {
    const w = mountModal({ stackedActions: true })
    const actions = w.find('.modal-actions')
    expect(actions.classes()).toContain('actions-stacked')
    const buttons = actions.findAll('button')
    expect(buttons.map((b) => b.text())).toEqual(['So speichern', 'Alle abhaken'])
    w.unmount()
  })

  it('Gegenprobe: ohne die Angabe nebeneinander wie bisher', async () => {
    const w = mountModal({})
    expect(w.find('.modal-actions').classes()).not.toContain('actions-stacked')
    w.unmount()
  })
})
