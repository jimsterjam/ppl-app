import mongoose from "mongoose";

const exerciseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
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
      'Rücken', 'Bizeps', 
      'Quadrizeps', 'Hamstrings', 'Gesäß', 'Waden',
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
  tips: String
}, {
  timestamps: true
});

// Medien-Felder (Optional): Pfade/URLs zu Bild und Thumbnail
exerciseSchema.add({
  imageUrl: { type: String },
  thumbnailUrl: { type: String }
});

const Exercise = mongoose.model("Exercise", exerciseSchema);

export default Exercise;