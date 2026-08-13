
import { logger } from "./utils/logger.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import { initializeAIService } from "./services/aiService.js";
import OpenAIProvider from "./services/OpenAIProvider.js";
import OllamaProvider from "./services/OllamaProvider.js";

// Lade .env mit absolutem Pfad
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

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

if (!MONGO_URI) {
  logger.error("MONGO_URI fehlt. Server wird beendet.");
  process.exit(1);
}

mongoose.connect(MONGO_URI).then(() => {
  logger.info("MongoDB verbunden");
  app.listen(PORT, HOST, () => {
    logger.info(`Server läuft auf http://${HOST}:${PORT}`);
  });
}).catch((err) => {
  logger.error("MongoDB-Verbindung fehlgeschlagen", err);
  process.exit(1);
});