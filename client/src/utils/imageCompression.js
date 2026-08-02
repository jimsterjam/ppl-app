// Client-seitige Bildkompression vor dem Upload.
// Skaliert proportional auf eine maximale Kantenlänge und exportiert als JPEG,
// analog zum Crop-Export in SettingsView.vue (applyAvatarCrop), aber ohne
// interaktiven Zuschnitt — reine Verkleinerung + Kompression.

const MAX_EDGE_DEFAULT = 480
const JPEG_QUALITY_DEFAULT = 0.86

/**
 * Lädt eine Bilddatei in ein <img>-Element (für Canvas-Zeichnung).
 * @param {File|Blob} file
 * @returns {Promise<HTMLImageElement>}
 */
function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Bild konnte nicht geladen werden'))
    }
    img.src = url
  })
}

/**
 * Komprimiert eine Bilddatei: skaliert proportional auf maxEdge, exportiert als JPEG.
 * @param {File} file - Original-Bilddatei (z.B. aus <input type="file">)
 * @param {Object} [options]
 * @param {number} [options.maxEdge=480] - maximale Kantenlänge in Pixel
 * @param {number} [options.quality=0.86] - JPEG-Qualität (0-1)
 * @returns {Promise<File>} komprimierte Bilddatei (immer JPEG)
 */
export async function compressImageFile(file, options = {}) {
  const maxEdge = options.maxEdge || MAX_EDGE_DEFAULT
  const quality = options.quality || JPEG_QUALITY_DEFAULT

  const img = await loadImageFromFile(file)
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height

  // Proportional skalieren, nie vergrößern
  const scale = Math.min(1, maxEdge / Math.max(w, h))
  const outW = Math.round(w * scale)
  const outH = Math.round(h * scale)

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas wird nicht unterstützt')

  // Weißer Hintergrund, falls das Quellbild Transparenz hat (JPEG kennt keine Transparenz)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, outW, outH)
  ctx.drawImage(img, 0, 0, outW, outH)

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Bildkomprimierung fehlgeschlagen'))),
      'image/jpeg',
      quality
    )
  })

  return new File([blob], 'exercise.jpg', { type: 'image/jpeg' })
}