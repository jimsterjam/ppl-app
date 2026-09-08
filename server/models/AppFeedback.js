import mongoose from "mongoose";

// ---------------------------------------------------------------------------
// AppFeedback - allgemeines Nutzer-Feedback zur App (Fehler/Idee/Unklarheit), erreichbar über
// Einstellungen -> "Feedback geben". BEWUSST ein eigenständiges Model, komplett getrennt von
// FeedbackRating.js (das ist die Bewertung EINES einzelnen KI-Feedback-Texts, unverändert und
// nicht Teil dieser Funktion - siehe Kommentar dort). Name absichtlich "AppFeedback" statt
// "Feedback*", um jede Verwechslung mit FeedbackRating/FeedbackQualitySignal zu vermeiden.
//
// Datenschutz (siehe Onboarding-Auftrag "Workoutdaten, Übungsnotizen, KI-Feedbackinhalte,
// Screenshots ... dürfen nicht automatisch mitgesendet werden"): context enthält NUR die vier
// explizit vorgesehenen, rein technischen Felder - niemals Trainingsdaten. Wird serverseitig
// nicht validiert gegen einen fixen Schlüsselsatz (siehe routes/account.js), aber der Client
// baut context ausschließlich aus appVersion/platform/osVersion/deviceModel/screenContext.
const appFeedbackSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['bug', 'idea', 'unclear'],
    required: true
  },
  // Freiwilliger Freitext ("Beschreibe kurz, was passiert ist...") - optional, da der Nutzer
  // laut Vorgabe allein durch Kategorie-Auswahl schon Feedback geben können soll.
  text: {
    type: String,
    default: null,
    maxlength: 2000
  },
  // Nur gesetzt, wenn der Nutzer der Übertragung technischer Kontextdaten explizit zugestimmt
  // hat (siehe consentGiven) - sonst bleibt context null. Rein technisch, keine Trainings-
  // /Personendaten.
  context: {
    appVersion: { type: String, default: null },
    platform: { type: String, default: null },
    osVersion: { type: String, default: null },
    deviceModel: { type: String, default: null },
    screenContext: { type: String, default: null }
  },
  consentGiven: {
    type: Boolean,
    default: false
  },
  // Für spätere Triage (z.B. "gesehen"/"erledigt") - aktuell nur 'new', kein UI dafür vorgesehen,
  // additiv für den Fall, dass später ein Admin-Review-Flow dazukommt.
  status: {
    type: String,
    enum: ['new', 'reviewed', 'resolved'],
    default: 'new'
  }
}, {
  timestamps: true
});

appFeedbackSchema.index({ userId: 1, createdAt: -1 });

const AppFeedback = mongoose.models.AppFeedback || mongoose.model("AppFeedback", appFeedbackSchema);
export default AppFeedback;
