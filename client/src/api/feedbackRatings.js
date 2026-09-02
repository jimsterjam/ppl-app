import { createResourceApi } from "./http";
import { handleAPIError } from "./errorHandler";
import { logger } from "@/utils/logger";

// Nutzt denselben Basis-Pfad wie workouts.js (/api/workouts) - die Bewertungs-Routen hängen
// serverseitig unter /:id/feedback-rating (siehe server/routes/workouts.js).
const api = createResourceApi('workouts');

// Lädt die eigene Bewertung zu einem Feedback (null wenn noch nicht/nicht mehr bewertet).
export async function fetchFeedbackRating(workoutId, token = null) {
  try {
    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    const res = await api.get(`/${workoutId}/feedback-rating`, config);
    return res.data?.rating || null;
  } catch (error) {
    logger.warn('⚠️ FeedbackRatings API - fetchFeedbackRating failed:', error?.message);
    // Nicht-blockierend: fehlende Bewertung darf das Anzeigen des Feedbacks nie stören.
    return null;
  }
}

// Legt eine Bewertung an oder aktualisiert die bestehende (Upsert, serverseitig durchgesetzt).
export async function submitFeedbackRating(workoutId, { rating, reasonCodes = [], correctionText = null }, token = null) {
  try {
    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    const res = await api.post(`/${workoutId}/feedback-rating`, { rating, reasonCodes, correctionText }, config);
    return res.data?.rating || null;
  } catch (error) {
    logger.warn('⚠️ FeedbackRatings API - submitFeedbackRating failed:', error?.message);
    throw handleAPIError(error, 'Bewertung speichern', { showToast: false });
  }
}

// Entfernt die eigene Bewertung (Soft-Delete serverseitig).
export async function deleteFeedbackRating(workoutId, token = null) {
  try {
    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    const res = await api.delete(`/${workoutId}/feedback-rating`, config);
    return res.data;
  } catch (error) {
    logger.warn('⚠️ FeedbackRatings API - deleteFeedbackRating failed:', error?.message);
    throw handleAPIError(error, 'Bewertung entfernen', { showToast: false });
  }
}

// Übernimmt einen Korrekturtext erst NACH ausdrücklicher Nutzer-Bestätigung als persönliche,
// übungsgebundene Notiz (siehe server-seitige Route /exercise-notes/confirm). Wird NIE
// automatisch beim Absenden einer Bewertung aufgerufen.
export async function confirmExerciseNote(exerciseName, noteText, token = null) {
  try {
    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    const res = await api.post('/exercise-notes/confirm', { exerciseName, noteText }, config);
    return res.data?.note || null;
  } catch (error) {
    logger.warn('⚠️ FeedbackRatings API - confirmExerciseNote failed:', error?.message);
    throw handleAPIError(error, 'Notiz speichern', { showToast: false });
  }
}
