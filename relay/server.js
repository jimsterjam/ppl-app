/**
 * bro-split-ai-relay - Einstiegspunkt
 *
 * Geschützter Relay zwischen server/ (bro-split-app) und der echten OpenAI-API.
 *
 * Zweck: der echte OPENAI_API_KEY liegt NUR in diesem eigenständigen Deployment - der
 * Haupt-Server (server/services/OpenAIProvider.js, server/services/feedbackVerificationService.js
 * über server/utils/aiClientFactory.js) kennt den echten Key gar nicht, sondern nur ein
 * separates, geteiltes Secret (RELAY_SHARED_SECRET), mit dem er sich hier authentifiziert.
 * Dieser Relay prüft das Secret (siehe app.js) und hängt DANACH erst den echten Key an die
 * Weiterleitung an OpenAI an.
 *
 * Die eigentliche Express-App steht in app.js (dort auch der Architektur-Kommentar zu
 * Allowlist/Auth) - hier nur: ENV laden, fail-fast validieren, App bauen, Port binden.
 *
 * Deployment: siehe DEPLOYMENT.md in diesem Ordner. Dieses Skript selbst führt KEIN Deployment
 * durch und lädt keinen echten Key nach - es erwartet OPENAI_API_KEY und RELAY_SHARED_SECRET
 * bereits als Umgebungsvariablen der Laufzeitumgebung (z.B. Render Environment Variables).
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { createApp } from './app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const PORT = process.env.PORT || 8787;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const RELAY_SHARED_SECRET = process.env.RELAY_SHARED_SECRET;

// Fail-fast statt stillschweigend im "kaputten" Zustand zu laufen - ein Relay ohne echten Key
// oder ohne Secret wäre entweder nutzlos oder (schlimmer) ein ungeschütztes offenes Tor.
if (!OPENAI_API_KEY) {
  console.error('FATAL: OPENAI_API_KEY ist nicht gesetzt. Relay startet nicht ohne echten Key.');
  process.exit(1);
}
if (!RELAY_SHARED_SECRET) {
  console.error('FATAL: RELAY_SHARED_SECRET ist nicht gesetzt. Relay startet nicht ungeschützt.');
  process.exit(1);
}
if (RELAY_SHARED_SECRET.length < 20) {
  console.error('FATAL: RELAY_SHARED_SECRET ist zu kurz (< 20 Zeichen) - bitte ein zufälliges Secret verwenden, z.B. `openssl rand -hex 32`.');
  process.exit(1);
}

const app = createApp({ openaiApiKey: OPENAI_API_KEY, relaySharedSecret: RELAY_SHARED_SECRET });

app.listen(PORT, () => {
  console.log(`✅ AI-Relay läuft auf Port ${PORT}`);
});
