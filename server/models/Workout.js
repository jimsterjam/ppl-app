import mongoose from "mongoose";

// Hilfsfunktion zur Kanonisierung des Workout-Typs
function normalizeType(input, name, firstExerciseCategory) {
  const src = [input, name, firstExerciseCategory]
    .map(v => (v ?? '').toString().toLowerCase())
    .find(s => s && s.trim().length > 0) || '';

  if (src.includes('full') || src.includes('ganz') || src.includes('freestyle')) return 'fullbody';
  if (src.includes('push')) return 'push';
  if (src.includes('pull')) return 'pull';
  if (src.includes('leg')) return 'legs';
  // Mappe eventuelle Kategorien von Exercises
  if (src.includes('brust') || src.includes('schulter') || src.includes('trizeps')) return 'push';
  if (src.includes('rücken') || src.includes('bizeps')) return 'pull';
  if (src.includes('bein') || src.includes('quadrizeps') || src.includes('hamstrings') || src.includes('waden')) return 'legs';
  if (src.includes('core') || src.includes('bauch') || src.includes('cardio')) return 'fullbody';
  return 'push';
}



const workoutSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    default: 'Neues Workout'
  },
  // Kanonischer Workout-Typ (push|pull|legs|fullbody)
  type: {
    type: String,
    enum: ['push', 'pull', 'legs', 'fullbody'],
    set: function(v) {
      // Versuche zusätzlich aus Name/Exercise-Kategorie abzuleiten
      const firstCat = Array.isArray(this.exercises) && this.exercises[0]?.category
        ? this.exercises[0].category
        : undefined;
      return normalizeType(v, this.name, firstCat);
    },
    default: function() {
      const firstCat = Array.isArray(this.exercises) && this.exercises[0]?.category
        ? this.exercises[0].category
        : undefined;
      return normalizeType(this.type, this.name, firstCat);
    }
  },
  exercises: [{
    exerciseId: { type: String },
    name: String,
    sets: Number,
    reps: Number,
    weight: Number,
    // optional zur Ableitung
    category: String,
    // Notiz pro Übung für DIESE Session (KI-Coach Konzept-PDF Kap. 25: "sessionNote" -
    // gilt nur für dieses eine Workout, im Gegensatz zur persistenten, übungsgebundenen
    // "exerciseNote" in models/UserExerciseNote.js. Feldname bewusst NICHT umbenannt,
    // um bestehende Clients/Daten nicht zu brechen - nur semantisch hier dokumentiert).
    note: String,
    // Tatsächlich bewegtes externes Gewicht für diese Übung in dieser Session (Kap. 24.2:
    // strikt getrennt von athleteBodyweightKg - z.B. Zusatzgewicht am Gürtel bei
    // Klimmzügen. Additiv/optional, null = nicht erfasst.)
    externalLoadKg: { type: Number, default: null },
    // Detaillierte Set-Informationen (modernes Format)
    setDetails: [{
      reps: Number,
      weight: Number,
      restTime: Number, // in Sekunden
      notes: String,
      isWarmup: { type: Boolean, default: false }
    }]
  }],
  date: {
    type: Date,
    default: Date.now
  },
  duration: {
    type: Number, // in Minuten
    default: 0
  },
  completed: {
    type: Boolean,
    default: false
  },
  notes: String
  ,
  // Optionales Workout-Coverbild
  imageUrl: { type: String },
  thumbnailUrl: { type: String },

  // Tatsächliches, gemessenes Körpergewicht des Nutzers zum Zeitpunkt dieser Session
  // (KI-Coach Konzept-PDF Kap. 24: "Null-Annahmen-Prinzip" - strikt getrennt von
  // loadType/exercises[].category = 'Körpergewicht' (Eigenschaft der ÜBUNG, nicht des
  // Körpergewichts des Nutzers). Darf NIEMALS aus loadType='bodyweight' abgeleitet werden.
  // Additiv/optional, null = nicht erfasst -> KI darf dann keine Aussage über Bodyweight treffen.
  athleteBodyweightKg: { type: Number, default: null },

  // KI-generiertes Trainings-Feedback (einmal generiert, danach wiederverwendet)
  ai_feedback: { type: String },
  ai_generated_at: { type: Date },
  ai_metadata: {
    provider: String,
    model: String
  }
}, {
  timestamps: true
});

// Feedback-Liste: userId + ai_generated_at DESC mit Limit
workoutSchema.index({ userId: 1, ai_generated_at: -1 })

// 🚀 Database Indexes für Performance-Optimierung
// Häufige Query-Patterns:
// 1. GET /workouts → Alle Workouts eines Users, sortiert nach Datum
// 2. Dashboard Stats → Aggregation nach userId + type
// 3. Recent Workouts → userId + date DESC mit Limit

workoutSchema.index({ userId: 1, date: -1 })       // User-Workouts sortiert nach Datum (neueste zuerst)
workoutSchema.index({ userId: 1, type: 1 })        // Filter nach Workout-Typ (Push/Pull/Legs)
workoutSchema.index({ userId: 1, createdAt: -1 })  // Alternative mit timestamps
workoutSchema.index({ date: 1 })                   // Globale Datumssuche (Admin)

// Pre-Save: sichere Kanonisierung vor dem Persistieren
workoutSchema.pre('save', function(next) {
  const firstCat = Array.isArray(this.exercises) && this.exercises[0]?.category
    ? this.exercises[0].category
    : undefined;
  this.type = normalizeType(this.type, this.name, firstCat);
  next();
});

// Pre-FindOneAndUpdate: Kanonisierung bei Updates
workoutSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate() || {};
  // Falls type explizit gesetzt oder ableitbar
  const name = update.name;
  const firstCat = Array.isArray(update.exercises) && update.exercises[0]?.category
    ? update.exercises[0].category
    : undefined;
  if (update.type !== undefined || name !== undefined || firstCat !== undefined) {
    const normalized = normalizeType(update.type, name, firstCat);
    // Stelle sicher, dass type gesetzt ist
    update.type = normalized;
    this.setUpdate(update);
  }
  next();
});

const Workout = mongoose.model("Workout", workoutSchema);

export default Workout;