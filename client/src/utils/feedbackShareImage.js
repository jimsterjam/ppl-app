// Rendert ein KI-Feedback als teilbares Bild (Canvas -> PNG), damit es beim Teilen (siehe
// AIFeedbackHistory.vue -> shareFeedback()) zusätzlich zum Text an Share.share({ files: [...] })
// übergeben werden kann. @capacitor/share unterstützt files bereits (file://-URIs) - damit
// erscheint z.B. Instagram als normales Ziel im nativen Share-Sheet ("Stufe 1" der
// Instagram-Anbindung; ein direkter instagram-stories://-Deep-Link wäre "Stufe 2" und bräuchte
// zusätzlichen nativen Code, ist hier bewusst nicht enthalten).
//
// Bewusst reine Rendering-Funktion ohne i18n-Abhängigkeit: alle sprachabhängigen Texte
// (Datum, Footer) werden vom Aufrufer bereits fertig formatiert übergeben.
//
// Wichtig: wirft nie - jeder Fehler (Canvas nicht verfügbar, Font-Load fehlgeschlagen,
// Dateisystem-Fehler) führt zu null, der Aufrufer fällt dann auf den bisherigen
// Text-Only-Share zurück.

import { logger } from '@/utils/logger'

const CARD_WIDTH = 1080
const CARD_HEIGHT = 1920

// Feste Dark-Theme-Werte aus style.css (Canvas kann keine CSS-Variablen lesen) - das
// Share-Bild nutzt bewusst immer das dunkle Farbschema, unabhängig vom aktuell im
// App-Theme-Store gewählten Theme, damit die Marke auf Instagram konsistent aussieht.
const COLORS = {
  bg: '#111214',
  bgPanel: '#0c0d10',
  fg: '#f4f6fb',
  fgStrong: '#ffffff',
  muted: '#c7cde3',
  accent: '#d7ff1f',
  info: '#58b8ff',
  infoBg: 'rgba(88, 184, 255, 0.20)',
  warning: '#ff9e3d',
  warningBg: 'rgba(255, 158, 61, 0.20)'
}

let brandFontLoadPromise = null

// Comfortaa ist bereits als self-hosted Variable-Font fürs Heading-Styling im Rest der App
// eingebunden (siehe style.css @font-face). Fürs Canvas-Rendering wird sie hier separat per
// FontFace-API geladen, damit das Share-Bild optisch zur App passt. Mit Timeout + Fallback,
// damit ein fehlgeschlagener/langsamer Font-Load nie das Erzeugen des Bildes blockiert.
async function ensureBrandFontLoaded() {
  if (brandFontLoadPromise) return brandFontLoadPromise
  brandFontLoadPromise = (async () => {
    try {
      if (typeof FontFace === 'undefined' || typeof document === 'undefined') return false
      const font = new FontFace('Comfortaa Share', "url('/fonts/Comfortaa-Variable.woff2')", { weight: '300 700' })
      const loaded = await Promise.race([
        font.load(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('font-load-timeout')), 2000))
      ])
      document.fonts.add(loaded)
      return true
    } catch (err) {
      logger.debug('[feedbackShareImage] Brand-Font-Load fehlgeschlagen, nutze Fallback', err?.message)
      return false
    }
  })()
  return brandFontLoadPromise
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  const lines = []
  let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + width, y, x + width, y + height, radius)
  ctx.arcTo(x + width, y + height, x, y + height, radius)
  ctx.arcTo(x, y + height, x, y, radius)
  ctx.arcTo(x, y, x + width, y, radius)
  ctx.closePath()
}

function formatSigned(value) {
  const rounded = Math.round(value * 10) / 10
  if (rounded > 0) return `+${rounded}`
  return `${rounded}`
}

/**
 * @param {Object} item - Eintrag aus dem Feedback-Verlauf (name, ai_feedback, ai_analysis_snapshot, ...)
 * @param {Object} [options]
 * @param {string} [options.dateLabel] - bereits formatiertes Datum
 * @param {string} [options.footerText] - Marken-/Footer-Text
 * @param {string} [options.brandLabel] - kleiner Marken-Schriftzug oben
 * @returns {Promise<string|null>} file://-URI des erzeugten PNGs, oder null bei Fehler
 */
export async function generateFeedbackShareImage(item, options = {}) {
  const { dateLabel = '', footerText = 'ppl', brandLabel = 'ppl' } = options

  try {
    if (typeof document === 'undefined') return null

    const canvas = document.createElement('canvas')
    canvas.width = CARD_WIDTH
    canvas.height = CARD_HEIGHT
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    const fontLoaded = await ensureBrandFontLoaded()
    const headingFont = fontLoaded ? "'Comfortaa Share'" : "'Space Grotesk', sans-serif"

    // Hintergrund
    const gradient = ctx.createLinearGradient(0, 0, 0, CARD_HEIGHT)
    gradient.addColorStop(0, COLORS.bg)
    gradient.addColorStop(1, COLORS.bgPanel)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

    const marginX = 84
    let cursorY = 140
    ctx.textBaseline = 'alphabetic'

    // Branding
    ctx.fillStyle = COLORS.accent
    ctx.font = `700 56px ${headingFont}`
    ctx.fillText(brandLabel, marginX, cursorY)
    cursorY += 90

    // Workout-Name
    ctx.fillStyle = COLORS.fgStrong
    ctx.font = `700 64px ${headingFont}`
    const nameLines = wrapText(ctx, item?.name || 'Workout', CARD_WIDTH - marginX * 2)
    for (const line of nameLines.slice(0, 2)) {
      ctx.fillText(line, marginX, cursorY)
      cursorY += 76
    }

    // Datum
    if (dateLabel) {
      ctx.fillStyle = COLORS.muted
      ctx.font = "500 34px 'Inter', sans-serif"
      cursorY += 8
      ctx.fillText(dateLabel, marginX, cursorY)
    }
    cursorY += 70

    // Trennlinie
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(marginX, cursorY)
    ctx.lineTo(CARD_WIDTH - marginX, cursorY)
    ctx.stroke()
    cursorY += 70

    // Delta-Chips (bis zu 4, gleiche Blau=mehr/Orange=weniger-Konvention wie
    // AiFeedbackDeltaSummary.vue - siehe --info/--warning in style.css)
    const snapshot = Array.isArray(item?.ai_analysis_snapshot) ? item.ai_analysis_snapshot : []
    const chipRows = snapshot.filter((e) => e && e.exercise && !e.is_first_session).slice(0, 4)
    if (chipRows.length > 0) {
      ctx.font = "600 28px 'Inter', sans-serif"
      for (const row of chipRows) {
        const weightChange = Number(row.weight_change_kg) || 0
        const setsChange = Number(row.sets_change) || 0
        const repsChange = Number(row.reps_change) || 0
        const primaryChange = weightChange !== 0 ? weightChange : (setsChange !== 0 ? setsChange : repsChange)
        const isUp = primaryChange > 0
        const isDown = primaryChange < 0
        const chipColor = isUp ? COLORS.info : isDown ? COLORS.warning : COLORS.muted
        const chipBg = isUp ? COLORS.infoBg : isDown ? COLORS.warningBg : 'rgba(255,255,255,0.08)'

        const label = `${row.exercise} · ${formatSigned(setsChange)} Sätze · ${formatSigned(repsChange)} Wdh. · ${formatSigned(weightChange)} kg`
        const maxChipWidth = CARD_WIDTH - marginX * 2
        const textWidth = Math.min(ctx.measureText(label).width, maxChipWidth - 48)
        const chipHeight = 58
        const chipWidth = Math.min(textWidth + 48, maxChipWidth)

        ctx.fillStyle = chipBg
        drawRoundedRect(ctx, marginX, cursorY, chipWidth, chipHeight, 29)
        ctx.fill()

        ctx.fillStyle = chipColor
        ctx.save()
        ctx.beginPath()
        ctx.rect(marginX + 20, cursorY, chipWidth - 40, chipHeight)
        ctx.clip()
        ctx.fillText(label, marginX + 24, cursorY + 39)
        ctx.restore()

        cursorY += chipHeight + 20
      }
      cursorY += 30
    }

    // Feedback-Text
    ctx.fillStyle = COLORS.fg
    ctx.font = "400 36px 'Inter', sans-serif"
    const feedbackLines = wrapText(ctx, item?.ai_feedback || '', CARD_WIDTH - marginX * 2)
    const maxFeedbackLines = Math.max(0, Math.floor((CARD_HEIGHT - 180 - cursorY) / 52))
    const visibleLines = feedbackLines.slice(0, maxFeedbackLines)
    const truncated = feedbackLines.length > visibleLines.length
    visibleLines.forEach((line, idx) => {
      const isLast = truncated && idx === visibleLines.length - 1
      ctx.fillText(isLast ? `${line.replace(/\s+\S*$/, '')}…` : line, marginX, cursorY)
      cursorY += 52
    })

    // Footer
    ctx.fillStyle = COLORS.muted
    ctx.font = "500 30px 'Inter', sans-serif"
    ctx.fillText(footerText, marginX, CARD_HEIGHT - 100)

    const dataUrl = canvas.toDataURL('image/png')
    const base64 = dataUrl.split(',')[1]
    if (!base64) return null

    // Dynamischer Import statt Top-Level-Import (gleiche Konvention wie assetCache.js /
    // SettingsView.vue): @capacitor/filesystem soll nicht in den Chunk gebacken werden, der
    // diese Komponente lädt, sondern erst geladen werden, wenn tatsächlich geteilt wird.
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const fileName = `feedback-share-${Date.now()}.png`
    await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Cache,
      recursive: true
    })
    const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache })
    return uri || null
  } catch (err) {
    logger.warn('[feedbackShareImage] Erzeugung fehlgeschlagen', err?.message || err)
    return null
  }
}
