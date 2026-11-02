// Feedback per E-Mail (Absprache Paul 02.11.): statt eines Formulars öffnet die App eine vorbereitete Mail an die
// Kontaktadresse aus dem Impressum. Technische Angaben stehen sichtbar im Mailtext, der Nutzer kann sie löschen.
// Nie Trainingsdaten, Notizen oder KI-Texte.
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { LEGAL_OWNER } from '@/config/legalOwner'
import { logger } from '@/utils/logger'

export const FEEDBACK_EMAIL = LEGAL_OWNER.email

/** mailto:-Adresse mit Betreff und Text (korrekt kodiert, Zeilenumbrüche als %0D%0A). */
export function buildFeedbackMailto({ email = FEEDBACK_EMAIL, subject = '', body = '' } = {}) {
  const enc = (value) => encodeURIComponent(String(value ?? '')).replace(/%0A/g, '%0D%0A')
  return `mailto:${email}?subject=${enc(subject)}&body=${enc(body)}`
}

/** Mailtext: Anrede, Platz für das Anliegen, darunter die technischen Angaben (Zeilen ohne Wert entfallen). */
export function buildFeedbackBody({ intro, hint, details = [] }) {
  const lines = details.filter((d) => d && d.value).map((d) => `${d.label}: ${d.value}`)
  return [intro, '', '', '', '---', hint, ...lines].join('\n')
}

// Defensiv: im Browser/Entwicklungsumgebung sind die Capacitor-Plugins teils nicht verfügbar.
export async function collectFeedbackDetails() {
  const result = { appVersion: '', osVersion: '', deviceModel: '' }
  try {
    const info = await CapacitorApp.getInfo()
    result.appVersion = [info?.version, info?.build ? `(${info.build})` : ''].filter(Boolean).join(' ')
  } catch {}
  try {
    const { Device } = await import('@capacitor/device')
    const info = await Device.getInfo()
    result.osVersion = String(info?.osVersion || '')
    result.deviceModel = String(info?.model || '')
  } catch {}
  return result
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * Mail-Programm mit vorbereiteter Mail öffnen. Klappt das nicht (kein Mail-Konto eingerichtet), wird die Adresse
 * kopiert und eine Meldung gezeigt.
 * @param {{ t: Function, toast: { show: Function }, deps?: object }} ctx - deps nur für Tests
 * @returns {Promise<'opened'|'fallback'>}
 */
export async function sendFeedbackMail({ t, toast, deps = {} }) {
  const collect = deps.collectDetails || collectFeedbackDetails
  const open = deps.openUrl || (async (url) => {
    if (Capacitor.isNativePlatform()) {
      const res = await CapacitorApp.openUrl({ url })
      return res?.completed !== false
    }
    window.location.href = url
    return true
  })
  const copy = deps.copy || copyText

  const d = await collect()
  const url = buildFeedbackMailto({
    subject: t('appFeedback.mailSubject'),
    body: buildFeedbackBody({
      intro: t('appFeedback.mailIntro'),
      hint: t('appFeedback.mailDetailsHint'),
      details: [
        { label: t('appFeedback.mailAppVersion'), value: d.appVersion },
        { label: t('appFeedback.mailOs'), value: d.osVersion },
        { label: t('appFeedback.mailDevice'), value: d.deviceModel }
      ]
    })
  })

  try {
    if (await open(url)) return 'opened'
  } catch (error) {
    logger.warn('[feedbackMail] Mail-Programm konnte nicht geöffnet werden:', error?.message || error)
  }
  await copy(FEEDBACK_EMAIL)
  toast.show(t('appFeedback.noMailApp', { email: FEEDBACK_EMAIL }), { type: 'info', duration: 5000 })
  return 'fallback'
}
