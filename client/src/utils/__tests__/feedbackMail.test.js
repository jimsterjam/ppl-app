import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@capacitor/app', () => ({ App: { getInfo: vi.fn().mockRejectedValue(new Error('web')) } }))

import { buildFeedbackMailto, buildFeedbackBody, sendFeedbackMail, FEEDBACK_EMAIL } from '../feedbackMail.js'

const t = (key, params) => ({
  'appFeedback.mailSubject': 'FBE Feedback',
  'appFeedback.mailIntro': 'Hallo,\n\nmein Feedback zu FBE:',
  'appFeedback.mailDetailsHint': 'Diese Angaben helfen. Du kannst sie löschen:',
  'appFeedback.mailAppVersion': 'App-Version',
  'appFeedback.mailOs': 'iOS',
  'appFeedback.mailDevice': 'Gerät',
  'appFeedback.mailFailed': `Mail nicht geöffnet. ${params?.email}`
}[key] || key)

describe('Feedback per E-Mail', () => {
  it('Adresse ist die Kontaktadresse aus dem Impressum', () => {
    expect(FEEDBACK_EMAIL).toBe('support@formbeatsego.de')
  })

  it('mailto: kodiert Betreff und Text, Zeilenumbrüche als %0D%0A', () => {
    const url = buildFeedbackMailto({ subject: 'FBE Feedback & Idee', body: 'Hallo\nÄ ü?' })
    expect(url.startsWith('mailto:support@formbeatsego.de?subject=')).toBe(true)
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

  it('Mail-Programm öffnet sich: keine Meldung', async () => {
    const toast = { show: vi.fn() }
    const openUrl = vi.fn().mockResolvedValue(true)
    const result = await sendFeedbackMail({
      t, toast, deps: { collectDetails: async () => ({ appVersion: '1.0 (12)', osVersion: '26.1', deviceModel: 'iPhone17,1' }), openUrl }
    })
    expect(result).toBe('opened')
    expect(openUrl.mock.calls[0][0]).toContain('App-Version%3A%201.0%20(12)')
    expect(toast.show).not.toHaveBeenCalled()
  })

  it('Fehler beim Öffnen: Meldung mit der Adresse, ohne Kopierbestätigung', async () => {
    const toast = { show: vi.fn() }
    const result = await sendFeedbackMail({
      t, toast, deps: { collectDetails: async () => ({}), openUrl: async () => { throw new Error('boom') } }
    })
    expect(result).toBe('failed')
    expect(toast.show.mock.calls[0][0]).toContain('support@formbeatsego.de')
    expect(toast.show.mock.calls[0][0]).not.toMatch(/kopiert|copied/i)
  })

  describe('echter Öffnungsweg (ohne deps.openUrl)', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('setzt window.location.href auf die mailto:-Adresse (Capacitor reicht fremde URLs an iOS weiter)', async () => {
      const location = { href: '' }
      vi.stubGlobal('window', { location })
      const toast = { show: vi.fn() }
      const result = await sendFeedbackMail({ t, toast, deps: { collectDetails: async () => ({ osVersion: '26.1' }) } })
      expect(result).toBe('opened')
      expect(location.href.startsWith('mailto:support@formbeatsego.de?subject=FBE%20Feedback&body=')).toBe(true)
      expect(location.href).toContain('iOS%3A%2026.1')
      expect(toast.show).not.toHaveBeenCalled()
    })

    it('wirft das Setzen der Adresse, kommt die Meldung', async () => {
      vi.stubGlobal('window', { location: { set href(_v) { throw new Error('blockiert') } } })
      const toast = { show: vi.fn() }
      const result = await sendFeedbackMail({ t, toast, deps: { collectDetails: async () => ({}) } })
      expect(result).toBe('failed')
      expect(toast.show).toHaveBeenCalled()
    })
  })
})
