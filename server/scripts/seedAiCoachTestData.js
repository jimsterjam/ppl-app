/**
 * Manuelles Test-Setup für den KI-Coach (Phase 1-4)
 *
 * Legt EIN metricProfile auf einer bestehenden Übung an und EINE UserExerciseNote für einen
 * Test-User an, damit sich die neue Korrektheits-Regel-Engine (Kap. 24-26) auch tatsächlich
 * live in der App beobachten lässt - ohne das gäbe es aktuell keine Übung mit metricProfile
 * in der DB, und der neue Codepfad würde beim manuellen Testen nie durchlaufen.
 *
 * NICHT automatisch ausgeführt - bewusst ein separates, manuell zu startendes Skript, damit
 * niemand versehentlich Testdaten in eine Produktions-DB schreibt. Vor Ausführung prüfen,
 * gegen welche DB MONGODB_URI/.env aktuell zeigt.
 *
 * Verwendung:
 *   node server/scripts/seedAiCoachTestData.js --userId=<FIREBASE_UID> --exercise="Handstand-Progression"
 *
 * Ohne --exercise wird "Klimmzug" als Beispiel verwendet (muss in Exercise-Katalog existieren,
 * sonst wird sie neu mit source='manual' angelegt).
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Exercise from '../models/Exercise.js';
import UserExerciseNote from '../models/UserExerciseNote.js';

dotenv.config();

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) args[match[1]] = match[2];
  }
  return args;
}

async function main() {
  const { userId, exercise = 'Klimmzug' } = parseArgs();

  if (!userId) {
    console.error('❌ Bitte --userId=<FIREBASE_UID> angeben (die userId, mit der du in der App eingeloggt bist).');
    process.exitCode = 1;
    return;
  }

  // Achtung: Die Env-Variable heißt in diesem Projekt MONGO_URI (siehe server/server.js),
  // nicht MONGODB_URI - das lokale .env zeigt bereits auf denselben MongoDB Atlas Cluster,
  // gegen den vermutlich auch Render läuft (ein gemeinsamer Cluster für Dev+Prod, siehe
  // Hinweis unten - unbedingt vor dem Ausführen verifizieren, nicht einfach annehmen).
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌ MONGO_URI nicht gesetzt (.env prüfen).');
    process.exitCode = 1;
    return;
  }

  console.log(`🔌 Verbinde mit DB: ${mongoUri.replace(/\/\/[^@]+@/, '//<redacted>@')}`);
  await mongoose.connect(mongoUri);

  // 1. metricProfile auf einer Übung anlegen (Rang 3, global) - Beispiel: technique-Übung,
  // damit die Korrektur (keine Gewichtsbewertung) im Feedback sichtbar wird.
  let exerciseDoc = await Exercise.findOne({ name: exercise });
  if (!exerciseDoc) {
    console.log(`ℹ️ Übung "${exercise}" existiert noch nicht - lege sie testweise an.`);
    exerciseDoc = new Exercise({
      name: exercise,
      names: { de: exercise, en: exercise },
      category: 'Pull',
      source: 'manual'
    });
  }
  exerciseDoc.metricProfile = {
    exerciseType: 'technique',
    exerciseGoal: 'skill_acquisition',
    allowedProgressMetrics: ['execution_quality', 'reps_in_range'],
    targetRepRange: { min: 3, max: 8 },
    higherRepsAreProgress: true,
    externalLoadRelevant: false,
    trainingVolumeRelevant: false,
    plateauEvaluationEnabled: false,
    reviewStatus: 'draft',
    version: 1
  };
  await exerciseDoc.save();
  console.log(`✅ metricProfile gesetzt auf Exercise "${exercise}" (exerciseType=technique, externalLoadRelevant=false)`);

  // 2. Persistente, bestätigte UserExerciseNote (Rang 1) für diesen User + diese Übung.
  await UserExerciseNote.findOneAndUpdate(
    { userId, exerciseName: exercise },
    {
      userId,
      exerciseName: exercise,
      noteText: 'Testnotiz: leichtes Handgelenkproblem, bewusst ohne Zusatzgewicht trainiert.',
      isConfirmed: true,
      overrides: { exerciseType: 'technique', externalLoadRelevant: false },
      source: 'user_input'
    },
    { upsert: true, new: true }
  );
  console.log(`✅ UserExerciseNote (bestätigt) angelegt für userId=${userId}, Übung "${exercise}"`);

  console.log(`\nNächste Schritte zum manuellen Testen:
  1. In der App ein Workout mit der Übung "${exercise}" erfassen/abschließen (mind. 2 Sessions,
     idealerweise mit unterschiedlichem "Gewicht", da externalLoadRelevant=false den Effekt der
     Korrektur zeigt: eine Gewichtssteigerung darf im Feedback NICHT mehr als Fortschritt gelten).
  2. KI-Analyse für das Workout anfordern (POST /:id/ai-analysis, bzw. der entsprechende Button
     in der Post-Workout-Ansicht) - erfordert genug Wiederholungen/Historie wie gehabt
     (AI_FEEDBACK_MIN_REPETITIONS / AI_FEEDBACK_MIN_HISTORY_DAYS).
  3. Prüfen: Feedback bewertet "${exercise}" NICHT über das Gewicht, erwähnt die persönliche
     Notiz zum Handgelenk als Kontext, und erfindet kein Körpergewicht (da athleteBodyweightKg
     aktuell nirgends gesetzt wird).
  `);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('❌ Fehler:', err.message);
  process.exitCode = 1;
});
