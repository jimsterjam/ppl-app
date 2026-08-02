import mongoose from "mongoose";

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
  muscleGroup: {
    type: String,
    default: 'other',
    trim: true
  },
  notes: {
    type: String,
    default: '',
    trim: true,
    maxlength: 200
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
