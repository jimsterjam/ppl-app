import { describe, it, expect, vi } from 'vitest'

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }))
vi.mock('@capacitor/app', () => ({ App: { getInfo: vi.fn(), openUrl: vi.fn() } }))

import { buildFeedbackMailto, buildFeedbackBody, sendFeedbackMail, FEEDBACK_EMAIL } from '../feedbackMail.js'

const t = (key, params) => ({
  'appFeedback.mailSubject': 'FBE Feedback',
  'appFeedback.mailIntro': 'Hallo,\n\nmein Feedback zu FBE:',
  'appFeedback.mailDetailsHint': 'Diese Angaben helfen. Du kannst sie löschen:',
  'appFeedback.mailAppVersion': 'App-Version',
  'appFeedback.mailOs': 'iOS',
  'appFeedback.mailDevice': 'Gerät',
  'appFeedback.noMailApp': `Kein Mail-Programm. ${params?.email}`
}[key] || key)

describe('Feedback per E-Mail', () => {
  it('Adresse ist die Kontaktadresse aus dem Impressum', () => {
    expect(FEEDBACK_EMAIL).toBe('admin@push-pull-legs.de')
  })

  it('mailto: kodiert Betreff und Text, Zeilenumbrüche als %0D%0A', () => {
    const url = buildFeedbackMailto({ subject: 'FBE Feedback & Idee', body: 'Hallo\nÄ ü?' })
    expect(url.startsWith('mailto:admin@push-pull-legs.de?subject=')).toBe(true)
    expect(url).toContain('FBE%20Feedback%20%26%20Idee')
    expect(url).toContain('Hallo%0D%0A')
    expect(url).not.toMatch(/ |\n/)
  })

  it('Mailtext: Anliegen oben, Angaben unten, leere Angaben entfallen', () => {
    const body = buildFeedbackBody({
      intro: 'Hallo', hint: 'Angaben:', details: [{ label: 'iOS', value: '26.1' }, { label: 'Gerät', value: '' }]
    })
    expect(body).toBe('Hallo\n\n\n\n---\nAngaben:\niOS: 26.1')
  })

  it('Mail-Programm öffnet sich: keine Meldung, keine Zwischenablage', async () => {
    const toast = { show: vi.fn() }
    const openUrl = vi.fn().mockResolvedValue(true)
    const copy = vi.fn()
    const result = await sendFeedbackMail({
      t, toast, deps: { collectDetails: async () => ({ appVersion: '1.0 (12)', osVersion: '26.1', deviceModel: 'iPhone17,1' }), openUrl, copy }
    })
    expect(result).toBe('opened')
    expect(openUrl.mock.calls[0][0]).toContain('App-Version%3A%201.0%20(12)')
    expect(toast.show).not.toHaveBeenCalled()
    expect(copy).not.toHaveBeenCalled()
  })

  it('kein Mail-Programm (Öffnen schlägt fehl): Adresse kopieren und Meldung zeigen', async () => {
    const toast = { show: vi.fn() }
    const copy = vi.fn().mockResolvedValue(true)
    const result = await sendFeedbackMail({
      t, toast, deps: { collectDetails: async () => ({}), openUrl: async () => false, copy }
    })
    expect(result).toBe('fallback')
    expect(copy).toHaveBeenCalledWith('admin@push-pull-legs.de')
    expect(toast.show.mock.calls[0][0]).toContain('admin@push-pull-legs.de')
  })

  it('Fehler beim Öffnen wird abgefangen und führt zur Meldung', async () => {
    const toast = { show: vi.fn() }
    const result = await sendFeedbackMail({
      t, toast, deps: { collectDetails: async () => ({}), openUrl: async () => { throw new Error('boom') }, copy: async () => true }
    })
    expect(result).toBe('fallback')
    expect(toast.show).toHaveBeenCalled()
  })
})
