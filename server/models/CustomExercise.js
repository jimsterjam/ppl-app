import mongoose from "mongoose";
import { normalizeMuscleGroup } from "../utils/textLimits.js";

const customExerciseSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 60
  },
  // Bekannte Gruppe (chest, back, ...) oder bei "Sonstiges" eine eigene Kategorie als Freitext: Steuerzeichen raus,
  // < > raus, auf 24 Zeichen gekürzt (kürzen statt ablehnen, siehe utils/textLimits.js).
  muscleGroup: {
    type: String,
    default: 'other',
    trim: true,
    set: normalizeMuscleGroup
  },
  notes: {
    type: String,
    default: '',
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    default: '',
    trim: true,
    maxlength: 500
  },
  // Messart (Absprache Paul 15.10.): 'weight' = Wdh. + kg (Standard), 'time' = Zeit halten (Sek.),
  // 'repsTime' = Wiederholungen in einer festen Zeit. Unbekannte Werte -> 'weight'.
  measureMode: {
    type: String,
    enum: ['weight', 'time', 'repsTime'],
    default: 'weight',
    set: (value) => (['time', 'repsTime'].includes(value) ? value : 'weight')
  },
  imageUrl: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Häufigster Zugriffspfad: alle eigenen Übungen eines Users laden.
customExerciseSchema.index({ userId: 1, createdAt: -1 });

const CustomExercise = mongoose.model("CustomExercise", customExerciseSchema);
export default CustomExercise;
