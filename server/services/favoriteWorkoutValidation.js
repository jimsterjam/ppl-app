// Reine Validierungs-/Limit-Logik für Favoriten-Workouts, bewusst aus der Route
// herausgezogen, damit sie ohne Express/MongoDB/Firebase-Admin testbar ist
// (gleiches Muster wie server/middleware/firebaseAuth.js -> isEmailVerifiedFromToken).

export const FAVORITE_TYPES = ['push', 'pull', 'legs', 'fullbody'];
export const MAX_FAVORITES_PER_TYPE = 10;
export const MAX_NAME_LENGTH = 60;

export function normalizeFavoriteType(type) {
  const value = String(type || '').toLowerCase().trim();
  return FAVORITE_TYPES.includes(value) ? value : null;
}

// Validiert das eingehende Favoriten-Payload aus POST/PUT. Gibt einen Fehlertext zurück
// (String) oder null, wenn alles in Ordnung ist.
export function validateFavoritePayload({ clientId, type, name, workout } = {}) {
  if (!clientId || typeof clientId !== 'string' || !clientId.trim()) {
    return 'clientId ist erforderlich';
  }
  if (!normalizeFavoriteType(type)) {
    return `type muss einer von ${FAVORITE_TYPES.join(', ')} sein`;
  }
  const trimmedName = String(name || '').trim();
  if (!trimmedName) {
    return 'name ist erforderlich';
  }
  if (trimmedName.length > MAX_NAME_LENGTH) {
    return `name darf maximal ${MAX_NAME_LENGTH} Zeichen lang sein`;
  }
  if (!workout || typeof workout !== 'object' || Array.isArray(workout)) {
    return 'workout ist erforderlich und muss ein Objekt sein';
  }
  if (!Array.isArray(workout.exercises)) {
    return 'workout.exercises muss ein Array sein';
  }
  return null;
}

// Prüft das Pro-Typ-Limit (max. 10 Favoriten). `existingCount` ist die Anzahl bereits
// vorhandener Favoriten dieses Typs für den User, OHNE den aktuell zu schreibenden Eintrag
// (bei einem Update auf einen bereits existierenden clientId also existingCount - 1, das
// übernimmt der Aufrufer).
export function isFavoriteLimitExceeded(existingCount) {
  return Number(existingCount || 0) >= MAX_FAVORITES_PER_TYPE;
}
