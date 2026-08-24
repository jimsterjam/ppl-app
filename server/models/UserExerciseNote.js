import mongoose from "mongoose";

// ---------------------------------------------------------------------------
// UserExerciseNote (KI-Coach Konzept-PDF, Kap. 25 "Notiz-System & Prioritätsreihenfolge")
// ---------------------------------------------------------------------------
// Persistente, ÜBUNGSGEBUNDENE Notiz/Einschränkung eines einzelnen Nutzers zu seiner
// persönlichen Variante einer Übung - gilt session-übergreifend, bis der Nutzer sie ändert
// oder löscht ("exerciseNote", Rang 1-2 der Prioritätsreihenfolge aus Kap. 25.1).
//
// Abgrenzung zu bestehenden Feldern:
// - Workout.exercises[].note ist die bisherige, bereits vorhandene "sessionNote" - gilt
//   nur für EIN Workout und bleibt unverändert bestehen.
// - Exercise.metricProfile ist das globale, fachlich geprüfte Übungsprofil (Rang 3) - wird
//   nur verwendet, wenn hier keine bestätigte Nutzer-Notiz vorliegt.
//
// Prioritätsreihenfolge (Kap. 25.1), von der Regel-Engine (Phase 2) zu berücksichtigen:
//   Rang 1: explizite, vom Nutzer BESTÄTIGTE Notiz zu genau dieser Übung (isConfirmed=true)
//   Rang 2: unbestätigtes Nutzerprofil (isConfirmed=false) - schwächere Priorität
//   Rang 3: Exercise.metricProfile (global, fachlich geprüft)
//   Rang 4: generische Regel (Fallback in der bestehenden Analyse-Logik)
//   Rang 5: unklar -> needs_context (erst ab Phase 2 relevant, hier nur als Kontext notiert)
//
// Additiv: komplett neue Collection, keine bestehenden Schemas/Daten betroffen.
const userExerciseNoteSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  // Freitext-Name der Übung (wie in Workout.exercises[].name/Exercise.name geführt -
  // bewusst kein harter exerciseId-Fremdschlüssel, da Nutzer auch zu CustomExercises und
  // frei getippten Übungsnamen Notizen hinterlegen können sollen).
  exerciseName: {
    type: String,
    required: true
  },
  // Die eigentliche, persistente Notiz/Einschränkung, z.B. "Knieprobleme - keine tiefen
  // Kniebeugen", "Trainiere diese Übung bewusst nur mit Teilwiederholungen".
  noteText: {
    type: String,
    required: true,
    maxlength: 500
  },
  // Vom Nutzer bestätigt (z.B. über einen "Ja, das stimmt weiterhin"-Dialog) vs. nur
  // übernommen/vermutet. Steuert Rang 1 vs. Rang 2 in der Prioritätsreihenfolge.
  isConfirmed: {
    type: Boolean,
    default: false
  },
  // Optionale strukturierte Override-Constraints, die diese Notiz für die Regel-Engine
  // ausdrückt (additiv, alle optional - Phase 2 entscheidet, welche davon ausgewertet werden).
  overrides: {
    exerciseType: {
      type: String,
      enum: ['strength', 'hypertrophy', 'power', 'technique', 'endurance', null],
      default: null
    },
    externalLoadRelevant: { type: Boolean, default: null },
    targetRepRange: {
      min: { type: Number, default: null },
      max: { type: Number, default: null }
    }
  },
  // Woher die Notiz stammt (für spätere Nachvollziehbarkeit/Debugging)
  source: {
    type: String,
    enum: ['user_input', 'ai_suggested', 'imported'],
    default: 'user_input'
  }
}, {
  timestamps: true
});

// Pro Nutzer + Übungsname genau eine aktive Notiz
userExerciseNoteSchema.index({ userId: 1, exerciseName: 1 }, { unique: true });

const UserExerciseNote = mongoose.models.UserExerciseNote || mongoose.model("UserExerciseNote", userExerciseNoteSchema);
export default UserExerciseNote;
