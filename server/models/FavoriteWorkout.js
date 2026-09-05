import mongoose from "mongoose";

// Server-seitige Sicherung der Favoriten-Workouts (siehe client/src/utils/workoutFavorites.js).
// Favoriten wurden bisher AUSSCHLIESSLICH in localStorage gehalten - bei Geräteverlust,
// Neuinstallation oder einem Identitätswechsel (z.B. Login über einen anderen Firebase-
// Provider mit neuer UID, siehe Apple-Sign-In-Fall) gingen sie unwiederbringlich verloren.
// Dieses Modell spiegelt lediglich, was lokal ohnehin schon existiert - keine neue fachliche
// Logik, reine Sicherung/Sync.
//
// `clientId` ist bewusst die bereits lokal vergebene ID (z.B. "fav_push_..."), damit Client
// und Server dasselbe Identifikationsmerkmal teilen und Sync ohne ID-Remapping funktioniert.
const favoriteWorkoutSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  clientId: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['push', 'pull', 'legs', 'fullbody'],
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 60
  },
  // Struktur entspricht buildFavoriteWorkoutPayload() im Client (type, workoutName, notes,
  // exercises[]) - bewusst als Mixed statt eigenem Sub-Schema, da der Client die Form bereits
  // validiert/normalisiert und dies eine reine Sicherungskopie ist, keine eigenständige
  // Geschäftslogik-Quelle.
  workout: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  }
}, {
  timestamps: true
});

// Ein Favorit pro (User, clientId) - erlaubt Upsert ohne Duplikate bei wiederholtem Sync.
favoriteWorkoutSchema.index({ userId: 1, clientId: 1 }, { unique: true });
favoriteWorkoutSchema.index({ userId: 1, type: 1 });

const FavoriteWorkout = mongoose.model("FavoriteWorkout", favoriteWorkoutSchema);
export default FavoriteWorkout;
