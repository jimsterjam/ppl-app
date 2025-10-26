import mongoose from "mongoose";

// Hilfsfunktion zur Kanonisierung des Workout-Typs
function normalizeType(input, name, firstExerciseCategory) {
  const src = [input, name, firstExerciseCategory]
    .map(v => (v ?? '').toString().toLowerCase())
    .find(s => s && s.trim().length > 0) || '';

  if (src.includes('push')) return 'push';
  if (src.includes('pull')) return 'pull';
  if (src.includes('leg')) return 'legs';
  // Mappe eventuelle Kategorien von Exercises
  if (src.includes('brust') || src.includes('schulter') || src.includes('trizeps')) return 'push';
  if (src.includes('rücken') || src.includes('bizeps')) return 'pull';
  if (src.includes('bein') || src.includes('quadrizeps') || src.includes('hamstrings') || src.includes('waden')) return 'legs';
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
  // Kanonischer Workout-Typ (push|pull|legs)
  type: {
    type: String,
    enum: ['push', 'pull', 'legs'],
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
    name: String,
    sets: Number,
    reps: Number,
    weight: Number,
    // optional zur Ableitung
    category: String,
    // Detaillierte Set-Informationen (modernes Format)
    setDetails: [{
      reps: Number,
      weight: Number,
      restTime: Number, // in Sekunden
      notes: String
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
  notes: String
}, {
  timestamps: true
});

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