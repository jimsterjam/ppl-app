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


const Exercise = mongoose.models.Exercise || mongoose.model("Exercise", exerciseSchema);
export default Exercise;
