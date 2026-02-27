
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import workoutRoutes from "./routes/workouts.js";
import exerciseRoutes from "./routes/exercises.js";
import subscriptionRoutes from "./routes/subscription.js";
import accountRoutes from "./routes/account.js";
import authRoutes from "./routes/auth.js";
import { logger } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// CORS (Schritt 3)
const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://localhost:5174",
  "capacitor://localhost",
  "http://localhost",
  "http://192.168.178.26",
  "http://192.168.178.26:3001"
]);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    // Erlaube alle lokalen Netzwerke und capacitor
    if (allowedOrigins.has(origin) || origin.startsWith("http://192.168.178.")) return cb(null, true);
    return cb(null, false);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true
}));

// JSON
app.use(express.json());

// Statische Dateien (Rollback: gesamtes public-Verzeichnis)
app.use(express.static(path.join(__dirname, 'public')));

// Routen einbinden
app.use("/api/workouts", workoutRoutes);
app.use("/api/exercises", exerciseRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/auth", authRoutes);

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Zentraler Error-Handler (Schritt 4)
app.use((err, req, res, _next) => {
  const isDev = process.env.NODE_ENV !== 'production';
  if (err && (err.message === "Unauthenticated" || err.status === 401 || err.code === "unauthenticated")) {
    logger.warn("401 Unauthenticated", { url: req.originalUrl, user: req.auth?.userId, error: err.message });
    return res.status(401).json({
      error: "Unauthenticated",
      ...(isDev && err.stack ? { stack: err.stack } : {})
    });
  }
  logger.error("500 Internal Server Error", {
    url: req.originalUrl,
    user: req.auth?.userId,
    error: err.message,
    stack: isDev ? err.stack : undefined
  });
  res.status(500).json({
    error: "Internal Server Error",
    ...(isDev && err.stack ? { stack: err.stack } : {})
  });
});

export default app;
