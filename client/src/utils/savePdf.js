// PDF speichern bzw. teilen. Auf dem iPhone: Datei in den App-Cache schreiben und das Teilen-Menü von iOS
// öffnen (dort: "In Dateien sichern", AirDrop, Mail ...). Im Browser: normaler Download.
import { Capacitor } from '@capacitor/core'
import { logger } from '@/utils/logger'

function toBase64(bytes) {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/**
 * @param {Uint8Array} bytes
 * @param {string} fileName
 * @param {{ title?: string }} [options]
 * @returns {Promise<'shared'|'downloaded'|'cancelled'>}
 */
export async function savePdf(bytes, fileName, { title = '' } = {}) {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')
    const written = await Filesystem.writeFile({ path: fileName, data: toBase64(bytes), directory: Directory.Cache })
    try {
      await Share.share({ title, url: written.uri, dialogTitle: title })
      return 'shared'
    } catch (error) {
      // Nutzer hat das Teilen-Menü geschlossen: kein Fehler.
      if (/cancel/i.test(String(error?.message || error))) return 'cancelled'
      logger.warn('[savePdf] Teilen fehlgeschlagen', { message: error?.message })
      throw error
    }
  }

  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
  return 'downloaded'
}
