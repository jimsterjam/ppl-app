
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

// MONGO_URI ist an dieser Stelle durch validateEnv() oben bereits als gesetzt und
// formatgültig garantiert (sonst hätte der Prozess dort schon beendet).
mongoose.connect(MONGO_URI).then(() => {
  logger.info("MongoDB verbunden");
  app.listen(PORT, HOST, () => {
    logger.info(`Server läuft auf http://${HOST}:${PORT}`);
  });
}).catch((err) => {
  logger.error("MongoDB-Verbindung fehlgeschlagen", err);
  process.exit(1);
});