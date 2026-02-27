


import app from "./app.js";
import { logger } from "./utils/logger.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "0.0.0.0";
const MONGO_URI = process.env.MONGO_URI;

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

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  logger.info("MongoDB verbunden");
  app.listen(PORT, HOST, () => {
    logger.info(`Server läuft auf http://${HOST}:${PORT}`);
  });
}).catch((err) => {
  logger.error("MongoDB-Verbindung fehlgeschlagen", err);
  process.exit(1);
});