// Antworten nach dem Training lokal am Workout vermerken (F16, Etappe 5b), damit der Kasten über den Sätzen im nächsten Workout sie
// sofort kennt. Vermerkt wird genau das, was der Server bestätigt hat (Antwort von POST /:id/athlete-answers, dort geprüft und
// begrenzt) - keine eigene, davon abweichende Prüfung. Beim nächsten Laden der Workout-Liste ersetzt die Fassung des Servers diese.

/** Nur die festen Felder eines vom Server bestätigten Eintrags, ungültige Einträge entfallen. */
export function pickConfirmedAnswers(list) {
  if (!Array.isArray(list)) return null
  const out = []
  for (const raw of list.slice(0, 2)) {
    if (!raw || typeof raw.topic !== 'string' || typeof raw.answer !== 'string' || typeof raw.exercise !== 'string' || !Number.isInteger(raw.exerciseIndex)) continue
    out.push({
      topic: raw.topic,
      exercise: raw.exercise.slice(0, 120),
      exerciseIndex: raw.exerciseIndex,
      answer: raw.answer,
      reason: typeof raw.reason === 'string' ? raw.reason : null,
      variant: typeof raw.variant === 'string' ? raw.variant : null
    })
  }
  return out
}

/**
 * Trägt die bestätigten Antworten in den lokalen Workout-Eintrag ein - nur dieses Feld, in einem Schritt (kein Zurückschreiben des
 * ganzen Workouts, das eine gleichzeitige Änderung überschreiben könnte). Probiert die Kennungen der Reihe nach (echte ID, dann
 * die vorläufige), weil der lokale Eintrag je nach Sync-Stand unter einer von beiden liegt. Wirft nie.
 * @param {string[]} ids
 * @param {Array|null} confirmed Antwortliste des Servers
 * @param {{patch:(id:string, changes:object)=>Promise<number>}} deps patch gibt die Zahl geänderter Einträge zurück
 * @returns {Promise<boolean>} true, wenn ein Eintrag aktualisiert wurde
 */
export async function noteAnswersLocally(ids, confirmed, { patch }) {
  const answers = pickConfirmedAnswers(confirmed)
  if (!answers) return false
  for (const id of [...new Set((ids || []).map((x) => String(x || '').trim()).filter(Boolean))]) {
    try {
      if ((await patch(id, { athlete_answers: answers })) > 0) return true
    } catch {
      // lokal nicht vermerkt ist kein Fehler: der Server hat die Antworten
    }
  }
  return false
}
