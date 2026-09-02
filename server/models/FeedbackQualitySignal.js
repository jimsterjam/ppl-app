import mongoose from "mongoose";

// ---------------------------------------------------------------------------
// FeedbackQualitySignal - anonymisiertes, aggregierbares Qualitätssignal zu einer
// KI-Feedback-Bewertung. KEINE personenbezogenen oder indirekt identifizierenden Felder
// (siehe Prompt "Datenmodell und Datenschutz" - explizite Verbotsliste: User-ID, Name,
// E-Mail, Körpergewicht, vollständige Workouts, persönliche Notizen, Gesundheitsdaten,
// Freitext, andere identifizierende Informationen).
//
// Bewusst APPEND-ONLY und nicht mit FeedbackRating verknüpfbar (kein feedbackId/userId hier):
// Löscht oder ändert ein Nutzer seine persönliche Bewertung später, bleiben bereits
// geschriebene, anonymisierte Signale hier unverändert stehen - das ist eine akzeptierte,
// bewusste Konsequenz echter Anonymisierung (nicht nachträglich zurückverfolgbar, siehe
// feedbackRatingService.js). "Aktuelle Statistiken nur aus aktiven Bewertungen" (Prompt-
// Vorgabe) bezieht sich auf Auswertungen über FeedbackRating direkt, nicht auf diese
// bereits anonymisierte Historie.
//
// reportedStatementCategory/exerciseCategory (siehe Prompt-Beispiel-JSON) sind absichtlich
// noch NICHT befüllt: das würde voraussetzen, dass eine Bewertung einer einzelnen,
// getaggten Aussage im KI-Feedback zugeordnet werden kann (Aussage-Markierung). Diese
// Funktion ist laut Absprache vorerst zurückgestellt, da das Feedback aktuell als reiner
// Fließtext ohne Aussage-Struktur vorliegt (siehe OpenAIProvider.js). Sobald eine
// strukturierte Feedback-Ausgabe existiert, können beide Felder hier ergänzt werden, ohne
// bestehende Signale zu invalidieren (beide bleiben bis dahin einfach null).
const feedbackQualitySignalSchema = new mongoose.Schema({
  feedbackVersion: {
    type: String,
    required: true
  },
  rating: {
    type: String,
    enum: ['helpful', 'not_helpful'],
    required: true
  },
  reasonCodes: {
    type: [String],
    default: []
  },
  // Absichtlich vorerst immer null - siehe Kommentar oben.
  reportedStatementCategory: {
    type: String,
    default: null
  },
  exerciseCategory: {
    type: String,
    default: null
  }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

feedbackQualitySignalSchema.index({ feedbackVersion: 1 });
feedbackQualitySignalSchema.index({ createdAt: -1 });

const FeedbackQualitySignal = mongoose.models.FeedbackQualitySignal
  || mongoose.model("FeedbackQualitySignal", feedbackQualitySignalSchema);
export default FeedbackQualitySignal;
