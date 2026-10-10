import mongoose from 'mongoose';

// Monatsbericht (Pro): einmal pro Zeitraum vom Server berechnet und gespeichert, damit er auch
// nach Neuinstallation noch abrufbar ist (siehe utils/monthlyReport.js, routes/monthlyReports.js).
//
// `facts` baut ausschließlich der Server aus den Workouts des Nutzers (kein Freitext, nie der
// Request-Body). Bewusst Mixed: reine Berechnungsergebnisse (Zahlen, Datumsangaben, Übungsnamen,
// Stillstand-Einträge), die der Client nur anzeigt - eine Quelle der Wahrheit ist die Funktion
// buildMonthlyReport. Zusätzlich `facts.version`, damit spätere Änderungen alte Berichte erkennen.
const monthlyReportSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  // Tag der Erzeugung (YYYY-MM-DD, UTC). Zusammen mit userId eindeutig: zwei gleichzeitige
  // Anfragen (z.B. zwei Geräte) erzeugen so nie zwei Berichte.
  periodKey: { type: String, required: true },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  facts: { type: mongoose.Schema.Types.Mixed, required: true },
  generatedAt: { type: Date, default: Date.now },
  // Erstes Öffnen im Client; null = "neu" (Dashboard-Zeile).
  seenAt: { type: Date, default: null }
});

monthlyReportSchema.index({ userId: 1, periodKey: 1 }, { unique: true });
monthlyReportSchema.index({ userId: 1, periodEnd: -1 });

export default mongoose.models.MonthlyReport || mongoose.model('MonthlyReport', monthlyReportSchema);
