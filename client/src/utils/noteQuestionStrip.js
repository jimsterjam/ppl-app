// Fragen in Notizen sollen nur für das Workout gelten, in dem sie stehen (Absprache Jimmy 16.11.): Wer einer Übung eine Frage
// in die Notiz schreibt ("Kann es sein, dass ...?"), bekommt dazu unter dem Feedback eine Antwort. Wird die Notiz mit einem
// Favoriten gespeichert, würde die Frage bei jedem Start erneut beantwortet. Deshalb nimmt der Favorit nur die Aussagen der
// Notiz mit ("Knie vorsichtig", "Schulter eng greifen"), nicht die Fragesätze.
//
// Hier wird gelöscht, nicht nur erkannt: Deshalb ist die Regel bewusst STRENGER als die Erkennung auf dem Server
// (server/utils/noteQuestions.js, isQuestionSentence). Entfernt wird nur ein Satz mit Fragezeichen oder ein Satz, der mit einer
// typischen Fragewendung BEGINNT. Aussagen wie "Nächstes Mal sollte ich langsamer absenken" oder "Schauen, ob die Hüfte
// mitmacht" bleiben erhalten. Dafür bleibt eine Frage ohne Fragezeichen, deren Wendung mitten im Satz steht, im Favoriten
// (selten; der Server beantwortet sie dann weiter). Per Server-Test gilt: Was hier entfernt wird, erkennt der Server auch als
// Frage. Bewusst ohne Imports, damit auch dieser Test die Datei laden kann.

const QUESTION_CUES = [
  'kann es sein', 'könnte es', 'koennte es', 'liegt es', 'liegt das', 'woran liegt', 'warum', 'wieso', 'weshalb',
  'wie kommt', 'soll ich', 'sollte ich', 'ist es normal', 'ich frage mich', 'ob es', 'ob das', 'ob die', 'ob der',
  'is it possible', 'could it be', 'could this be', 'why', 'how come', 'should i', 'is it normal', 'i wonder',
  'do you think'
]

// Trennt Sätze (nach . ! ?), Zeilen und die Aufzählung " • " aus der Zusammenfassung der Workout-Notizen; die Trenner bleiben
// erhalten (Klammer = Trenner im Ergebnis), damit nur die entfernten Sätze verschwinden und nichts umformatiert wird.
const SEPARATOR = /(\s*•\s*|\r?\n|(?<=[.!?])\s+)/

function cleanText(value) {
  return String(value ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim()
}

/**
 * Soll dieser Satz aus der Notiz des Favoriten entfernt werden? Fragezeichen oder Satzanfang mit einer Fragewendung.
 * (Strenger als die Erkennung auf dem Server, siehe Kopfkommentar.)
 */
export function isQuestionToRemove(sentence) {
  const text = cleanText(sentence)
  if (!text) return false
  if (text.includes('?')) return true
  const lower = text.toLowerCase()
  return QUESTION_CUES.some((cue) => lower === cue || lower.startsWith(`${cue} `) || lower.startsWith(`${cue},`))
}

/**
 * Notiz ohne Fragesätze. Enthält sie keine Frage, kommt sie unverändert zurück (kein Umformatieren). Sonst verschwinden nur die
 * Fragesätze samt dem folgenden Trenner; eine Notiz, die nur aus Fragen besteht, wird leer.
 * @param {*} note
 * @returns {string}
 */
export function stripQuestionsFromNote(note) {
  if (typeof note !== 'string') return ''
  if (!note.trim()) return note
  const parts = note.split(SEPARATOR)
  const out = []
  let removed = false
  for (let i = 0; i < parts.length; i += 2) {
    const sentence = parts[i]
    const separator = parts[i + 1] ?? ''
    if (isQuestionToRemove(sentence)) {
      removed = true
      continue
    }
    out.push(sentence, separator)
  }
  if (!removed) return note
  return out.join('').replace(/^[\s•]+|[\s•]+$/g, '')
}
