
import { logger } from "./utils/logger.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import { validateEnv } from "./utils/validateEnv.js";
import { initializeAIService } from "./services/aiService.js";
import OpenAIProvider from "./services/OpenAIProvider.js";
import OllamaProvider from "./services/OllamaProvider.js";

// Lade .env mit absolutem Pfad
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

// Validiert kritische ENV-Variablen (u.a. MONGO_URI inkl. Format) direkt nach dem Laden
// der .env-Datei und BEVOR irgendein Service (AI-Provider, Mongo-Connect) sie liest.
// Beendet den Prozess mit exit(1) bei fehlenden/ungültigen Pflicht-Variablen - siehe
// server/utils/validateEnv.js. Ersetzt den vorherigen, weniger strengen Inline-Check
// weiter unten (nur "gesetzt?", kein Format-Check).
validateEnv();

const { default: app } = await import("./app.js");

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "0.0.0.0";
const MONGO_URI = process.env.MONGO_URI;
const AI_PROVIDER = String(process.env.AI_PROVIDER || 'openai').toLowerCase();

// Initialize AI Service with selected provider
try {
  let aiProvider;
  if (AI_PROVIDER === 'ollama') {
    logger.info('🔧 AI Provider: Ollama (local development)');
    aiProvider = new OllamaProvider();
  } else {
    logger.info('🔧 AI Provider: OpenAI (production)');
    aiProvider = new OpenAIProvider();
  }
  initializeAIService(aiProvider);
} catch (error) {
  logger.error('❌ Failed to initialize AI Service:', error.message);
  process.exit(1);
}

// Optional: Firebase Admin Logging
try {
  const { admin } = await import("./utils/firebaseAdmin.js");
  if (admin?.app) {
    logger.info("Firebase Admin initialisiert");
  }
} catch (e) {
  logger.info("Firebase Admin nicht initialisiert (optional):", e?.message);
}

// Server SOFORT binden, unabhängig vom Mongo-Verbindungsstatus.
//
// Vorher: app.listen() lief erst im .then() von mongoose.connect() - der Prozess hörte also
// gar nicht auf $PORT, solange die Mongo-Atlas-Verbindung nicht stand. Render prüft beim
// Deploy aber genau das (Bind auf $PORT) innerhalb eines Zeitfensters. Direkt nach einem
// `git push` war die Erstverbindung zu Atlas (kalter Cluster/Container, frischer DNS/TLS-
// Handshake) öfter langsam genug, um dieses Fenster zu verpassen - der Prozess landete dann
// im .catch() unten, rief process.exit(1) auf, und der Deploy wurde als fehlgeschlagen
// markiert. Ein manueller Redeploy kurz danach lief über einen bereits "warmen" Netzwerkpfad
// und schaffte es meist rechtzeitig - reines Timing-Problem, kein Bug in den Deploy-Daten
// selbst (daher: gleicher Code, unterschiedliches Ergebnis push vs. manueller Redeploy).
app.listen(PORT, HOST, () => {
  logger.info(`Server läuft auf http://${HOST}:${PORT}`);
});

// MongoDB läuft jetzt komplett im Hintergrund, mit explizitem Verbindungs-Timeout (statt
// Mongoose' Default) und automatischem Wiederholungsversuch bei einer fehlgeschlagenen
// ERSTverbindung - vorher beendete ein einziger Fehlschlag sofort den ganzen Prozess
// (process.exit(1)), was serverseitig denselben Health-Check-Race nur nach dem Listen
// reproduziert hätte. Requests, die währenddessen die DB brauchen, laufen bis zur ersten
// erfolgreichen Verbindung in den üblichen Mongoose-Timeout statt dass die App abstürzt.
// MONGO_URI ist an dieser Stelle durch validateEnv() oben bereits als gesetzt und
// formatgültig garantiert.
const MONGO_CONNECT_RETRY_MS = 5000;

function connectMongoWithRetry() {
  mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 10000
  }).then(() => {
    logger.info("MongoDB verbunden");
  }).catch((err) => {
    logger.error(
      `MongoDB-Verbindung fehlgeschlagen, erneuter Versuch in ${MONGO_CONNECT_RETRY_MS / 1000}s:`,
      err?.message || err
    );
    setTimeout(connectMongoWithRetry, MONGO_CONNECT_RETRY_MS);
  });
}

connectMongoWithRetry();

mongoose.connection.on("disconnected", () => {
  logger.warn("MongoDB-Verbindung getrennt - Mongoose versucht automatisch, erneut zu verbinden");
});