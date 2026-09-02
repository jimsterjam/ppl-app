import mongoose from "mongoose";

// ---------------------------------------------------------------------------
// FeedbackRating - persönliche Bewertung eines einzelnen KI-Feedbacks durch den Nutzer,
// der es erhalten hat ("War dieses Feedback hilfreich?", Prompt "Bewertungsfunktion für
// KI-Workout-Feedback").
//
// WICHTIG (Datenschutz-Trennung, siehe Prompt Punkt "Datenmodell und Datenschutz"): Dieses
// Dokument ist PERSONENBEZOGEN (userId + freier Korrekturtext) und wird NIEMALS direkt für
// globale Auswertungen gelesen. Für aggregierte, anonymisierte Qualitätssignale existiert
// separat FeedbackQualitySignal.js - beim Anlegen/Ändern einer Bewertung wird dort zusätzlich
// ein abstrahierter Eintrag ohne userId/feedbackId/Freitext geschrieben (siehe
// feedbackRatingService.js -> buildQualitySignal()).
//
// feedbackId ist bewusst die bestehende Workout-_id (jedes Workout hat höchstens ein aktives
// ai_feedback zur Zeit) statt eines neuen UUID-Feldes - so bleibt es stabil referenzierbar,
// ohne das Workout-Modell weiter aufzublähen. feedbackVersion unterscheidet, WELCHE
// Feedback-Generierung bewertet wurde (ai_generated_at + Modell), falls ein Feedback später
// per Refresh neu erzeugt wird.
const feedbackRatingSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  feedbackId: {
    type: String,
    required: true
  },
  feedbackVersion: {
    type: String,
    required: true
  },
  rating: {
    type: String,
    enum: ['helpful', 'not_helpful'],
    required: true
  },
  // Feste Codes statt Freitext (siehe Prompt "Verwende feste Reason-Codes statt nur
  // Freitext") - gültige Werte werden in feedbackRatingService.js validiert, nicht hier im
  // Schema erzwungen, damit neue Codes ohne Migration ergänzt werden können.
  reasonCodes: {
    type: [String],
    default: []
  },
  // Freiwilliger Korrekturtext ("Was wäre richtig gewesen?") - rein personenbezogen, darf
  // laut Prompt niemals in globale Auswertungen übernommen werden.
  correctionText: {
    type: String,
    default: null,
    maxlength: 1000
  },
  // aktiv = aktuell gültig (neu oder unverändert), geändert = aktiv, aber schon mindestens
  // einmal bearbeitet, gelöscht = vom Nutzer entfernt (Soft-Delete, zählt nicht mehr in
  // Statistiken - siehe feedbackRatingService.js/isCountedStatus()).
  status: {
    type: String,
    enum: ['active', 'edited', 'deleted'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Pro Nutzer + Feedback höchstens eine aktive Bewertung (Prompt-Vorgabe: "Eine erneute
// Bewertung aktualisiert den bestehenden Eintrag, statt einen neuen aktiven Eintrag
// anzulegen") - technisch als EIN Dokument pro (userId, feedbackId) gelöst, per Upsert
// aktualisiert statt neu angelegt (auch im Soft-Delete-Fall bleibt es dasselbe Dokument).
feedbackRatingSchema.index({ userId: 1, feedbackId: 1 }, { unique: true });

const FeedbackRating = mongoose.models.FeedbackRating || mongoose.model("FeedbackRating", feedbackRatingSchema);
export default FeedbackRating;
