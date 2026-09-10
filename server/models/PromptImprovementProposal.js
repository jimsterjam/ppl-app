import mongoose from "mongoose";

// ---------------------------------------------------------------------------
// PromptImprovementProposal - KI-generierter Verbesserungsvorschlag für den System-Prompt
// der KI-Trainingsanalyse (OpenAIProvider.js getSystemPrompt()), abgeleitet aus negativ
// bewerteten/korrigierten FeedbackRating-Einträgen (siehe feedbackInsightService.js).
//
// Bewusst NUR ein Vorschlag, kein automatischer Patch: Der eigentliche System-Prompt wird
// NIE automatisch verändert. Ein Admin sichtet den Vorschlag hier, setzt ihn auf 'approved'
// oder 'rejected' - die tatsächliche Umsetzung im Prompt-Text bleibt ein bewusster, separater
// manueller Schritt (siehe Auftrag: "der KI-generierte Feedbacks in Loops greift und
// optimiert" - Freigabe-Gate vor jeder Änderung).
//
// Datenschutz-Hinweis: sourceRatingIds referenziert die FeedbackRating-Dokumente, aus denen
// dieser Vorschlag abgeleitet wurde (für Nachvollziehbarkeit), NICHT die userId dahinter -
// der generierte proposalText selbst enthält bewusst keine Nutzer-Identifikatoren, da diese
// nie an OpenAI übergeben werden (siehe buildInsightPrompt in feedbackInsightService.js).
const promptImprovementProposalSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  summary: {
    type: String,
    required: true,
    maxlength: 200
  },
  proposalText: {
    type: String,
    required: true,
    maxlength: 4000
  },
  // searchText/replaceText: strukturierter Such-Ersetzen-Vorschlag für den System-Prompt-Text
  // (OpenAIProvider.getCoachSystemPromptText()) - searchText soll ein wortgenaues Zitat aus dem
  // Prompt sein, replaceText der vorgeschlagene Ersatz dafür. Bewusst NUR als Kopiervorlage für
  // den Admin gedacht (siehe AiInsightsPanel.vue) - kein automatischer Patch/PR, der Admin
  // wendet die Änderung selbst lokal an. Optional/nullable, da ältere, vor diesem Feature
  // erstellte Proposals diese Felder nicht haben.
  searchText: {
    type: String,
    default: null,
    maxlength: 4000
  },
  replaceText: {
    type: String,
    default: null,
    maxlength: 4000
  },
  sourceRatingCount: {
    type: Number,
    required: true,
    default: 0
  },
  sourceRatingIds: {
    type: [String],
    default: []
  },
  // Hält zusätzlich fest, in welchem Bearbeitungsstand (updatedAt) jedes Rating zum
  // Analysezeitpunkt einbezogen wurde - ermöglicht findUnanalyzedRatings() in
  // adminFeedbackInsights.js zu erkennen, wenn ein Rating NACH dieser Analyse noch einmal
  // bearbeitet wurde, und es dann erneut (statt fälschlich als "schon analysiert") für die
  // nächste Analyse vorzuschlagen. Ältere Proposals ohne dieses Feld nutzen ersatzweise
  // createdAt des Proposals als Näherung (siehe findUnanalyzedRatings()).
  sourceRatingSnapshots: {
    type: [{
      _id: false,
      ratingId: { type: String, required: true },
      updatedAt: { type: Date, required: true }
    }],
    default: []
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  reviewNote: {
    type: String,
    default: null,
    maxlength: 1000
  }
}, {
  timestamps: true
});

promptImprovementProposalSchema.index({ status: 1, createdAt: -1 });

const PromptImprovementProposal = mongoose.models.PromptImprovementProposal
  || mongoose.model("PromptImprovementProposal", promptImprovementProposalSchema);

export default PromptImprovementProposal;
