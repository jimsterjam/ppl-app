import mongoose from "mongoose";

const exerciseSchema = new mongoose.Schema({
  // Primary name (deutsch für Hauptverwendung in der App)
  name: {
    type: String,
    required: true,
    unique: true
  },
  // Mehrsprachige Namen
  names: {
    de: { type: String, required: true }, // Sollte gleich 'name' sein
    en: { type: String, required: true }  // Englischer Name für AI-Mapping
  },
  category: {
    type: String,
    required: true,
    enum: [
      'Push', // Brust, Schultern, Trizeps
      'Pull', // Rücken, Bizeps
      'Legs', // Beine, Gesäß
      'Core', // Bauch, Core
      'Cardio' // Ausdauer
    ]
  },
  muscleGroups: [{
    type: String,
    enum: [
      'Brust', 'Schultern', 'Trizeps', 
      'Rücken', 'Bizeps', 'Trapez',
      'Quadrizeps', 'Hamstrings', 'Gesäß', 'Glutes', 'Waden',
      'Bauch', 'Core',
      'Cardio'
    ]
  }],
  equipment: {
    type: String,
    enum: [
      'Hanteln', 'Langhantel', 'Kurzhanteln', 
      'Kabelzug', 'Maschine', 'Körpergewicht', 
      'Kettlebell', 'Resistance Band', 'Cardio-Gerät'
    ]
  },
  difficulty: {
    type: String,
    enum: ['Anfänger', 'Fortgeschritten', 'Profi'],
    default: 'Anfänger'
  },
  instructions: String,
  tips: String,
  // Quelle der Übung für Tracking
  source: {
    type: String,
    enum: ['manual', 'ai_suggestion', 'user_created', 'imported', 'ai_generated', 'static_reset', 'static_fallback'],
    default: 'manual'
  },
  // Wann wurde die Übung hinzugefügt
  addedAt: {
    type: Date,
    default: Date.now
  },
  // Von welchem User hinzugefügt (bei user_created)
  addedBy: {
    type: String, // userId
    required: false
  }
}, {
  timestamps: true
});

// 🚀 Database Indexes für Performance-Optimierung
// Häufige Query-Patterns:
// 1. GET /exercises?category=Push → Index auf category
// 2. findOne({ name: "..." }) in validateAndMapExercises → Index auf name
// 3. Batch queries mit $in operator → Compound Index

exerciseSchema.index({ category: 1 })              // Filter nach Kategorie (Push/Pull/Legs)
exerciseSchema.index({ category: 1, name: 1 })     // Compound Index für gefilterte Suche
exerciseSchema.index({ 'names.en': 1 })            // AI-Mapping via englischer Name
exerciseSchema.index({ source: 1 })                // Filter nach Quelle (ai_generated, etc.)
exerciseSchema.index({ addedBy: 1 }, { sparse: true }) // User-spezifische Übungen

// Medien-Felder (Optional): Pfade/URLs zu Bild und Thumbnail
exerciseSchema.add({
  imageUrl: { type: String },
  thumbnailUrl: { type: String },
  imageFileId: { type: mongoose.Schema.Types.ObjectId },
  thumbFileId: { type: mongoose.Schema.Types.ObjectId }
});

// ---------------------------------------------------------------------------
// metricProfile (KI-Coach Konzept-PDF, Kap. 26 "Übungsspezifisches Bewertungsmodell")
// ---------------------------------------------------------------------------
// Fachlich geprüftes, GLOBALES Übungsprofil (Rang 3 in der Prioritätsreihenfolge aus
// Kap. 25.1 - wird nur verwendet, wenn kein persönlicher User-Override existiert, siehe
// models/UserExerciseNote.js für Rang 1/2). Legt fest, welche Fortschrittsmetriken für
// diese Übung überhaupt zulässig sind - z.B. darf eine reine Technikübung
// (exerciseType=technique) nicht über Gewicht bewertet werden, eine Schnellkraftübung
// (exerciseType=power) nicht über höhere Wiederholungszahl.
//
// Additiv und optional: bestehende Exercises ohne metricProfile funktionieren unverändert
// weiter (die Regel-Engine behandelt exerciseType=null als "kein Profil hinterlegt" und
// fällt auf die bisherige generische Gewicht/Volumen-Bewertung zurück statt eine Analyse zu
// blockieren - kein Breaking Change für den bestehenden Bestand).
const metricProfileSchema = new mongoose.Schema({
  exerciseType: {
    type: String,
    enum: ['strength', 'hypertrophy', 'power', 'technique', 'endurance'],
    default: null
  },
  exerciseGoal: { type: String, default: '' }, // z.B. "explosive_strength", "skill_acquisition"
  // Welche Metriken die KI für diese Übung überhaupt bewerten/empfehlen darf.
  allowedProgressMetrics: [{
    type: String,
    enum: [
      'external_load', 'reps_in_range', 'sets', 'rir_rpe',
      'estimated_1rm', 'volume', 'movement_velocity', 'execution_quality',
      'successful_attempts', 'assistance_level', 'technique_stage', 'quality_rating',
      'duration', 'distance', 'pace'
    ]
  }],
  targetRepRange: {
    min: { type: Number, default: null },
    max: { type: Number, default: null }
  },
  // false bei z.B. Speed Squats: mehr Wiederholungen sind dort KEIN Fortschritt (Kap. 26.1)
  higherRepsAreProgress: { type: Boolean, default: true },
  // false bei reinen Technikübungen (Kap. 26.2) - Gewicht darf dann nicht bewertet werden
  externalLoadRelevant: { type: Boolean, default: true },
  trainingVolumeRelevant: { type: Boolean, default: true },
  plateauEvaluationEnabled: { type: Boolean, default: true },
  // Fachliche Freigabe (Kap. 12 "Status für redaktionelle und fachliche Freigabe")
  reviewStatus: {
    type: String,
    enum: ['draft', 'coach-reviewed'],
    default: 'draft'
  },
  version: { type: Number, default: 1 }
}, { _id: false });

exerciseSchema.add({
  metricProfile: { type: metricProfileSchema, default: null }
});


const Exercise = mongoose.models.Exercise || mongoose.model("Exercise", exerciseSchema);
export default Exercise;
