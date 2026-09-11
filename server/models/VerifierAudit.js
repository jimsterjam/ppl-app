import mongoose from "mongoose";

// ---------------------------------------------------------------------------
// VerifierAudit - anonymisiertes, aggregierbares Protokoll des Feedback-Qualitäts-Loops
// (Phase 1: Shadow-Modus, siehe feedbackVerificationService.js). Analog zu
// FeedbackQualitySignal.js: KEINE personenbezogenen oder indirekt identifizierenden Felder
// (kein userId, kein feedbackId, keine Trainingsdaten, kein Feedback-Text, keine Notizen) -
// nur, WELCHE Regeln wie oft ausgelöst haben und ob eine Korrektur nötig/erfolgreich war.
//
// Bewusst APPEND-ONLY, nicht mit einem Workout/User verknüpfbar - dient ausschließlich der
// Admin-Auswertung "welche Regeln schlagen wie oft an", um spätere Priorisierung (z.B.
// Einschränkung der geprüften Regelliste) datenbasiert zu ermöglichen.
const verifierAuditSchema = new mongoose.Schema({
  // 'shadow': Verstöße werden nur protokolliert, Nutzer sieht weiterhin den ursprünglichen
  // Entwurf. 'active': Revision wird bei einem Verstoß tatsächlich ausgelöst (spätere Phase).
  mode: {
    type: String,
    enum: ['shadow', 'active'],
    required: true
  },
  // true, wenn die kostenlose deterministische Zahlen-/Wortbudget-Prüfung einen Verstoß fand.
  deterministicViolation: {
    type: Boolean,
    default: false
  },
  // true, wenn der zweite KI-Prüfaufruf einen Verstoß meldete. null, wenn der KI-Prüfschritt
  // in diesem Durchlauf nicht ausgeführt wurde (z.B. Fehler beim Aufruf selbst).
  aiViolation: {
    type: Boolean,
    default: null
  },
  // Regel-Nummern (aus dem Coach-System-Prompt, siehe OpenAIProvider.js), die in diesem
  // Durchlauf beanstandet wurden - Basis für die Admin-Auswertung "Regel X wurde Y-mal
  // beanstandet".
  triggeredRules: {
    type: [Number],
    default: []
  },
  // Phase 1 (Shadow) setzt dies nie auf true - reserviert für Phase 2 (aktive Revision).
  revisionAttempted: {
    type: Boolean,
    default: false
  },
  revisionSucceeded: {
    type: Boolean,
    default: null
  },
  // Fehler beim KI-Prüfaufruf selbst (z.B. Timeout, ungültiges JSON) - getrennt von
  // aiViolation, damit "AI hat geprüft und nichts gefunden" nicht mit "AI-Prüfung ist
  // fehlgeschlagen" verwechselt wird.
  aiCheckFailed: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

verifierAuditSchema.index({ createdAt: -1 });
verifierAuditSchema.index({ mode: 1 });

const VerifierAudit = mongoose.models.VerifierAudit
  || mongoose.model("VerifierAudit", verifierAuditSchema);
export default VerifierAudit;
