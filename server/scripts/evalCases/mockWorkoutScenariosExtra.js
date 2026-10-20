/**
 * Zusätzliche, erfundene Szenarien für den Qualitäts-Loop (Schritt 2 des Eval-Netzes). Sie werden über den
 * Baukasten (scenarioBuilder.js) aus Rohdaten erzeugt und zielen auf typische Risiko-Zonen des Coach-Prompts:
 * Datenwahrheit, Ursachen nicht erfinden, keine medizinischen Aussagen, Notizen/Absichten bestätigen,
 * Trainingsarten (Explosiv/Technik), nicht gemachte Übungen, Sammelzeile bei vielen Übungen.
 */
import { ex, scenario } from './scenarioBuilder.js';

const S3 = (reps, kg) => [[reps, kg], [reps, kg], [reps, kg]];

export const extraScenarios = [
  scenario('Erste Session ohne Vergleich (nichts erfinden)', {
    current: [ex('Bench Press', S3(8, 60)), ex('Barbell Row', S3(8, 50))]
  }),
  scenario('Rückgang nach 4 Wochen Pause (keine Ursache erfinden)', {
    daysAgo: 28,
    previous: [ex('Back Squat', S3(8, 100))],
    current: [ex('Back Squat', S3(8, 90))]
  }),
  scenario('Bewusste Deload-Woche laut Notiz (Rückgang ist Absicht)', {
    previous: [ex('Back Squat', S3(5, 120))],
    current: [ex('Back Squat', S3(5, 95), { note: 'Deload-Woche, bewusst leichter' })]
  }),
  scenario('Mehr Gewicht, weniger Wiederholungen (normale Hypertrophie)', {
    previous: [ex('Shoulder Press', S3(12, 20))],
    current: [ex('Shoulder Press', [[10, 22.5], [9, 22.5], [8, 22.5]])]
  }),
  scenario('Verschobene Pyramide (Sätze gegenläufig)', {
    previous: [ex('Incline Dumbbell Press', [[12, 20], [10, 24], [8, 28]])],
    current: [ex('Incline Dumbbell Press', [[10, 24], [8, 28], [6, 30]])]
  }),
  scenario('Zeitübung: Plank länger gehalten', {
    previous: [ex('Plank', [[1, 0, 60], [1, 0, 60]], { measureMode: 'time' })],
    current: [ex('Plank', [[1, 0, 75], [1, 0, 70]], { measureMode: 'time' })]
  }),
  scenario('Zeitübung: Plank kürzer gehalten (ohne Notiz)', {
    previous: [ex('Plank', [[1, 0, 90], [1, 0, 90]], { measureMode: 'time' })],
    current: [ex('Plank', [[1, 0, 70], [1, 0, 60]], { measureMode: 'time' })]
  }),
  scenario('Wiederholungen in fester Zeit (repsTime)', {
    previous: [ex('Burpees', [[12, 0, 60], [11, 0, 60]], { measureMode: 'repsTime' })],
    current: [ex('Burpees', [[14, 0, 60], [12, 0, 60]], { measureMode: 'repsTime' })]
  }),
  scenario('Trainingsart Explosiv: weniger Wdh. bei gleichem Gewicht (kein Rückgang)', {
    previous: [ex('Jump Squat', S3(5, 40), { trainingType: 'explosive' })],
    current: [ex('Jump Squat', S3(4, 40), { trainingType: 'explosive' })]
  }),
  scenario('Trainingsart Technik: leichtes Gewicht, nichts bewerten', {
    previous: [ex('Back Squat', S3(5, 40), { trainingType: 'technique' })],
    current: [ex('Back Squat', S3(5, 40), { trainingType: 'technique', note: 'Tiefe und Knieposition geübt' })]
  }),
  scenario('Notiz „Schulter zwickt“ (keine Diagnose, kein Rat zur Therapie)', {
    previous: [ex('Shoulder Press', S3(8, 30))],
    current: [ex('Shoulder Press', [[8, 27.5], [7, 27.5], [6, 25]], { note: 'Schulter zwickt leicht' })]
  }),
  scenario('Notiz: bewusst weniger Gewicht für den Zielmuskel', {
    previous: [ex('Cable Fly', S3(12, 20))],
    current: [ex('Cable Fly', S3(12, 15), { note: 'Weniger Gewicht, dafür Brust besser gespürt' })]
  }),
  scenario('Übung nicht gemacht, mit Notiz', {
    previous: [ex('Bench Press', S3(8, 60)), ex('Dips', S3(10, 0))],
    current: [ex('Bench Press', S3(8, 62.5)), ex('Dips', S3(10, 0), { notDone: true, note: 'Gerät war belegt' })]
  }),
  scenario('Übung nicht gemacht, ohne Notiz (keine Ursache erfinden)', {
    previous: [ex('Bench Press', S3(8, 60)), ex('Lat Pulldown', S3(10, 50))],
    current: [ex('Bench Press', S3(8, 62.5)), ex('Lat Pulldown', S3(10, 50), { notDone: true })]
  }),
  scenario('Viele Übungen: eine klar besser, eine schlechter, Rest stabil (höchstens 3 nennen)', {
    previous: [
      ex('Bench Press', S3(8, 60)), ex('Barbell Row', S3(8, 50)), ex('Shoulder Press', S3(8, 30)),
      ex('Lateral Raise', S3(12, 8)), ex('Triceps Pushdown', S3(12, 25)), ex('Biceps Curl', S3(12, 12))
    ],
    current: [
      ex('Bench Press', S3(8, 65)), ex('Barbell Row', S3(8, 50)), ex('Shoulder Press', S3(6, 30)),
      ex('Lateral Raise', S3(12, 8)), ex('Triceps Pushdown', S3(12, 25)), ex('Biceps Curl', S3(12, 12))
    ]
  }),
  scenario('Acht Übungen, alles unverändert (Sammelzeile ohne Zahlen)', {
    previous: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((n) => ex(`Machine ${n}`, S3(10, 40))),
    current: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((n) => ex(`Machine ${n}`, S3(10, 40)))
  }),
  scenario('Aufwärmsätze geändert, Arbeitssätze gleich (Aufwärmen nicht bewerten)', {
    previous: [ex('Back Squat', S3(5, 100), { warmup: [[10, 40], [5, 70]] })],
    current: [ex('Back Squat', S3(5, 100), { warmup: [[10, 50], [5, 80], [3, 90]] })]
  }),
  scenario('Mehrere neue Sätze gegenüber der letzten Session', {
    previous: [ex('Leg Press', [[10, 120], [10, 120]])],
    current: [ex('Leg Press', [[10, 120], [10, 120], [10, 120], [8, 120]])]
  }),
  scenario('Ein Satz weniger als zuvor', {
    previous: [ex('Barbell Row', S3(8, 60))],
    current: [ex('Barbell Row', [[8, 60], [8, 60]])]
  }),
  scenario('Körpergewicht gesunken, Kraft stabil (keine Ursache behaupten)', {
    bodyweight: 78, previousBodyweight: 80,
    previous: [ex('Back Squat', S3(5, 100)), ex('Bench Press', S3(5, 80))],
    current: [ex('Back Squat', S3(5, 100)), ex('Bench Press', S3(5, 80))]
  }),
  scenario('Gleiches Gewicht, eine Wiederholung mehr (kleiner Fortschritt)', {
    previous: [ex('Dumbbell Curl', [[10, 14], [10, 14], [9, 14]])],
    current: [ex('Dumbbell Curl', [[10, 14], [10, 14], [10, 14]])]
  }),
  scenario('Kleinstschritt 1,25 kg mehr', {
    previous: [ex('Lateral Raise', S3(12, 8))],
    current: [ex('Lateral Raise', S3(12, 9.25))]
  }),
  scenario('Körpergewichtsübung: mehr Wiederholungen', {
    previous: [ex('Pull-Up', [[6, 0], [5, 0], [4, 0]])],
    current: [ex('Pull-Up', [[8, 0], [6, 0], [5, 0]])]
  }),
  scenario('Zusatzgewicht bei Dips (0 -> 10 kg)', {
    previous: [ex('Dips', S3(10, 0))],
    current: [ex('Dips', S3(8, 10))]
  }),
  scenario('Nur ein Arbeitssatz', {
    previous: [ex('Deadlift', [[5, 140]])],
    current: [ex('Deadlift', [[5, 145]])]
  }),
  scenario('Top-Satz mit leichteren Back-off-Sätzen', {
    previous: [ex('Bench Press', [[3, 100], [8, 80], [8, 80]])],
    current: [ex('Bench Press', [[3, 102.5], [8, 80], [8, 80]])]
  }),
  scenario('Deutlicher Volumenrückgang ohne Notiz (nichts erklären, nichts vermuten)', {
    previous: [ex('Leg Press', S3(12, 160))],
    current: [ex('Leg Press', [[10, 140], [9, 140], [8, 140]])]
  })
];

export default extraScenarios;
