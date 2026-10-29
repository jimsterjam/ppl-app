// "Erste Einordnung" (Absprache Paul 29.10.): Solange es weniger als FIRST_LOOK_COMPARISON_MIN gleiche Workouts gibt,
// fehlt die Vergleichsbasis. Die KI ordnet dann nur diese eine Einheit ein; der Ausblick darunter ist FESTER Text der
// App (nicht von der KI): Er beschreibt, wie die App-Empfehlungen aussehen werden, und erinnert daran, dass die
// Ausführung in Eigenverantwortung liegt - die App kann sie nicht prüfen.

// Ab dieser Anzahl gleicher Workouts (inkl. des aktuellen) gibt es das vergleichende Feedback.
export const FIRST_LOOK_COMPARISON_MIN = 4;

const OUTLOOK = {
  de: [
    'So geht es weiter: Machst du dieselben Übungen das nächste Mal wieder, gibt dir die App Empfehlungen – etwa erst die Wiederholungen zu steigern (z. B. von 3×10 auf 3×11, bis 3×12 geschafft sind) und danach das Gewicht leicht zu erhöhen. Ab dem 4. gleichen Workout vergleicht sie deine Einheiten miteinander.',
    'Achte dabei immer auf saubere Ausführung und darauf, nicht zu schummeln. Die App kann das nicht prüfen – das liegt in deiner Verantwortung.'
  ],
  en: [
    'What comes next: if you do the same exercises again next time, the app gives you recommendations – for example first adding reps (e.g. from 3×10 to 3×11 until you reach 3×12) and then raising the weight slightly. From the 4th identical workout on, it compares your sessions.',
    'Always keep your form clean and do not cheat on reps. The app cannot check that – it is your own responsibility.'
  ]
};

/** @param {'de'|'en'} language */
export function buildFirstLookOutlook(language = 'de') {
  return (OUTLOOK[language === 'en' ? 'en' : 'de']).join('\n\n');
}

/** Hängt den Ausblick an den Feedback-Text (nach der „Nächstes Mal“-Zeile). */
export function applyFirstLookOutlook(text, language = 'de') {
  const outlook = buildFirstLookOutlook(language);
  const base = String(text || '').trim();
  return base ? `${base}\n\n${outlook}` : outlook;
}

/** Erste Einordnung, solange weniger als FIRST_LOOK_COMPARISON_MIN gleiche Workouts vorliegen. */
export function isFirstLook(matchingCount, min = FIRST_LOOK_COMPARISON_MIN) {
  return Number(matchingCount) < min;
}
