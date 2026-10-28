import mongoose from "mongoose";
import { PLAN_LIMITS } from "../utils/trainingPlanValidation.js";

// Server-Sicherung der Trainingspläne (client/src/utils/trainingPlanStorage.js). Wie bei den Favoriten ist der Client
// die primäre Quelle; der Server spiegelt nur (Restore nach Neuinstallation, Gerätewechsel). `clientId` ist die lokal
// vergebene Plan-ID. Die Tage verweisen auf Favoriten (FavoriteWorkout.clientId), enthalten aber keine Übungen.
const daySchema = new mongoose.Schema({
  id: { type: String, required: true, maxlength: PLAN_LIMITS.maxId },
  label: { type: String, default: "", maxlength: PLAN_LIMITS.maxLabel },
  favoriteId: { type: String, required: true, maxlength: PLAN_LIMITS.maxId },
  lastDoneAt: { type: Date, default: null }
}, { _id: false });

const trainingPlanSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  clientId: { type: String, required: true, maxlength: PLAN_LIMITS.maxId },
  name: { type: String, required: true, trim: true, maxlength: PLAN_LIMITS.maxName },
  days: { type: [daySchema], default: [] },
  activeDayIndex: { type: Number, default: 0, min: 0, max: PLAN_LIMITS.maxDays - 1 },
  active: { type: Boolean, default: false }
}, { timestamps: true });

// Ein Plan pro (User, clientId) - erlaubt Upsert ohne Duplikate bei wiederholtem Sync.
trainingPlanSchema.index({ userId: 1, clientId: 1 }, { unique: true });

const TrainingPlan = mongoose.models.TrainingPlan || mongoose.model("TrainingPlan", trainingPlanSchema);
export default TrainingPlan;
