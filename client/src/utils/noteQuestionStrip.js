// Fragen in Notizen sollen nur für das Workout gelten, in dem sie stehen (Absprache Jimmy 16.11.): Wer einer Übung eine Frage
// in die Notiz schreibt ("Kann es sein, dass ...?"), bekommt dazu unter dem Feedback eine Antwort. Wird die Notiz mit einem
// Favoriten gespeichert, würde die Frage bei jedem Start erneut beantwortet. Deshalb nimmt der Favorit nur die Aussagen der
// Notiz mit ("Knie vorsichtig", "Schulter eng greifen"), nicht die Fragesätze.
//
// Die Erkennung ist dieselbe wie auf dem Server (server/utils/noteQuestions.js, isQuestionSentence) und wird per Server-Test
// abgeglichen. Bewusst ohne Imports, damit auch dieser Test die Datei laden kann.

const QUESTION_CUES = [
  'kann es sein', 'könnte es', 'koennte es', 'liegt es', 'liegt das', 'woran liegt', 'warum', 'wieso', 'weshalb',
  'wie kommt', 'soll ich', 'sollte ich', 'ist es normal', 'ich frage mich', 'ob es', 'ob das', 'ob die', 'ob der',
  'is it possible', 'could it be', 'could this be', 'why ', 'how come', 'should i', 'is it normal', 'i wonder',
  'do you think'
]

function cleanText(value) {
  return String(value ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim()
}

/** Ist dieser Satz eine Frage (Fragezeichen oder typische Wendung)? Gleiche Regel wie auf dem Server. */
export function isQuestionSentence(sentence) {
  const text = cleanText(sentence)
  if (text.includes('?')) return true
  const lower = ` ${text.toLowerCase()} `
  return QUESTION_CUES.some((cue) => lower.includes(` ${cue}`))
}

/**
 * Notiz ohne Fragesätze. Aussagen und Zeilenumbrüche bleiben erhalten; eine Notiz, die nur aus Fragen besteht, wird leer.
 * @param {*} note
 * @returns {string}
 */
export function stripQuestionsFromNote(note) {
  if (typeof note !== 'string' || !note.trim()) return typeof note === 'string' ? note : ''
  const lines = note.split(/\r?\n/)
  const kept = []
  for (const line of lines) {
    const sentences = line.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
    const statements = sentences.filter((sentence) => !isQuestionSentence(sentence))
    if (statements.length) kept.push(statements.join(' '))
  }
  return kept.join('\n').trim()
}
