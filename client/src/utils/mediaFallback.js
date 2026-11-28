// Platzhalter für Übungsmedien: Ist weder Video noch Foto vorhanden (oder nicht ladbar), steht ein Platzhalter statt eines defekten Bildes.
export const MEDIA_PLACEHOLDER = '/exercises/play.svg'

/** @error-Handler für <img>: einmalig auf den Platzhalter wechseln (der Platzhalter selbst löst keine Schleife aus). */
export function onMediaImageError(evt) {
  const img = evt?.target
  if (!img || String(img.src).includes('play.svg')) return
  img.src = MEDIA_PLACEHOLDER
}
