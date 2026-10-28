import mongoose from "mongoose";
import { PLAN_LIMITS, PLAN_LEVELS, PLAN_DAY_TYPES, PLAN_GOALS } from "../utils/trainingPlanValidation.js";

// Server-Sicherung der Trainingspläne (client/src/utils/trainingPlanStorage.js). Wie bei den Favoriten ist der Client
// die primäre Quelle; der Server spiegelt nur (Restore nach Neuinstallation, Gerätewechsel). `clientId` ist die lokal
// vergebene Plan-ID. Ein Tag enthält seine Übungen selbst (Vorlagen-Pläne); ältere Pläne verweisen stattdessen auf einen
// Favoriten (FavoriteWorkout.clientId).
const exerciseSchema = new mongoose.Schema({
  exerciseId: { type: String, required: true, maxlength: PLAN_LIMITS.maxId },
  name: { type: String, required: true, maxlength: PLAN_LIMITS.maxExerciseName },
  muscleGroup: { type: String, default: "", maxlength: PLAN_LIMITS.maxMuscleGroup },
  sets: { type: Number, default: 3, min: 1, max: PLAN_LIMITS.maxSets }
}, { _id: false });

const daySchema = new mongoose.Schema({
  id: { type: String, required: true, maxlength: PLAN_LIMITS.maxId },
  label: { type: String, default: "", maxlength: PLAN_LIMITS.maxLabel },
  favoriteId: { type: String, default: "", maxlength: PLAN_LIMITS.maxId },
  type: { type: String, enum: PLAN_DAY_TYPES, default: "fullbody" },
  goal: { type: String, enum: PLAN_GOALS, default: "hypertrophy" },
  exercises: { type: [exerciseSchema], default: [] },
  lastDoneAt: { type: Date, default: null }
}, { _id: false });

const trainingPlanSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  clientId: { type: String, required: true, maxlength: PLAN_LIMITS.maxId },
  name: { type: String, required: true, trim: true, maxlength: PLAN_LIMITS.maxName },
  days: { type: [daySchema], default: [] },
  // Stufe des Plans (Absprache Paul 28.10.): Anfänger ist der Standard.
  level: { type: String, enum: PLAN_LEVELS, default: "beginner" },
  // Vorlage, aus der der Plan stammt (z. B. "ppl3"); leer bei selbst gebauten Plänen.
  templateId: { type: String, default: "", maxlength: 24 },
  activeDayIndex: { type: Number, default: 0, min: 0, max: PLAN_LIMITS.maxDays - 1 },
  active: { type: Boolean, default: false }
}, { timestamps: true });

// Ein Plan pro (User, clientId) - erlaubt Upsert ohne Duplikate bei wiederholtem Sync.
trainingPlanSchema.index({ userId: 1, clientId: 1 }, { unique: true });

const TrainingPlan = mongoose.models.TrainingPlan || mongoose.model("TrainingPlan", trainingPlanSchema);
export default TrainingPlan;
