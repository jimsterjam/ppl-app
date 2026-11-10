// 1RM-Rechner (Epley), läuft im Browser ohne Server und ohne Cookies.
// Dieselbe Formel wie in der App (server/utils/stagnationDiagnosis.js estimateOneRepMax); ein Test vergleicht beide.

export const MAX_REPS = 12
export const MAX_WEIGHT = 1000

/** Geschätztes 1RM nach Epley: Gewicht × (1 + Wiederholungen ÷ 30); bei einer Wiederholung das Gewicht selbst. */
export function estimateOneRepMax(weight, reps) {
  const w = Number(weight) || 0
  const r = Number(reps) || 0
  if (w <= 0 || r <= 0) return 0
  return r === 1 ? w : w * (1 + r / 30)
}

/** Gewicht für r Wiederholungen bei gegebenem 1RM (Umkehrung); bei einer Wiederholung das 1RM selbst. */
export function weightForReps(oneRm, reps) {
  const r = Number(reps) || 0
  if (!(oneRm > 0) || r <= 0) return 0
  return r === 1 ? oneRm : oneRm / (1 + r / 30)
}

/** Tabelle für 1 bis MAX_REPS Wiederholungen. */
export function buildTable(oneRm) {
  return Array.from({ length: MAX_REPS }, (_, i) => {
    const reps = i + 1
    const weight = weightForReps(oneRm, reps)
    return { reps, weight, share: oneRm > 0 ? weight / oneRm : 0 }
  })
}

/** Zahl aus einer Eingabe ("82,5" oder "82.5"); NaN bei Ungültigem. */
export function parseNumber(text) {
  const clean = String(text ?? '').trim().replace(',', '.')
  return /^\d+(\.\d+)?$/.test(clean) ? Number(clean) : NaN
}

export function validate(weightText, repsText) {
  const weight = parseNumber(weightText)
  const reps = parseNumber(repsText)
  if (!(weight > 0) || weight > MAX_WEIGHT) return null
  if (!Number.isInteger(reps) || reps < 1 || reps > MAX_REPS) return null
  return { weight, reps }
}

function init() {
  const form = document.getElementById('rm-form')
  if (!form) return
  const lang = document.documentElement.lang === 'en' ? 'en-US' : 'de-DE'
  const one = new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const pct = new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: 0 })
  const out = document.getElementById('rm-result')
  const value = document.getElementById('rm-value')
  const error = document.getElementById('rm-error')
  const body = document.getElementById('rm-table-body')
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const input = validate(form.elements.weight.value, form.elements.reps.value)
    if (!input) {
      error.hidden = false
      out.hidden = true
      return
    }
    error.hidden = true
    const oneRm = estimateOneRepMax(input.weight, input.reps)
    value.textContent = `${one.format(oneRm)} kg`
    body.replaceChildren(...buildTable(oneRm).map((row) => {
      const tr = document.createElement('tr')
      for (const text of [String(row.reps), one.format(row.weight), pct.format(row.share)]) {
        const td = document.createElement('td')
        td.textContent = text
        tr.append(td)
      }
      if (row.reps === input.reps) tr.className = 'is-input'
      return tr
    }))
    out.hidden = false
  })
}

if (typeof document !== 'undefined') init()
