import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Deine Routen und Middleware importieren
import workoutRoutes from "./routes/workouts.js";
import exerciseRoutes from "./routes/exercises.js";
import subscriptionRoutes from "./routes/subscription.js";
import accountRoutes from "./routes/account.js";
// Clerk-Import entfernt

// Utilities
import { validateEnv } from './utils/validateEnv.js';
import { logger } from './utils/logger.js';

// .env laden
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

// Validiere Env
validateEnv();

// Express App
const app = express();

// Clerk Middleware entfernt

// CORS
const allowedOrigins = new Set(["http://localhost:5173", "http://localhost:5174"]);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.has(origin)) return cb(null, true);
    return cb(null, false);
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

// JSON
app.use(express.json());

// Statische Dateien
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// ... (alle Routen / Upload-Logik / GridFS etc. unverändert hier rein kopieren) ...

// Routen einbinden
app.use("/api/workouts", workoutRoutes);
app.use("/api/exercises", exerciseRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/account", accountRoutes);

// Healthcheck
app.get('/api/health', (req, res) => {
  const state = mongoose.connection?.readyState;
  const map = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  res.json({ status: 'ok', db: map[state] ?? 'unknown', readyState: state });
});

// Error Handler
app.use((err, req, res, _next) => {
  if (err && (err.message === "Unauthenticated" || err.status === 401 || err.code === "unauthenticated")) {
    return res.status(401).json({ error: "Unauthenticated" });
  }
  if (err) logger.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

export default app;
