
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import workoutRoutes from "./routes/workouts.js";
import customExerciseRoutes from "./routes/customExercises.js";
import exerciseRoutes from "./routes/exercises.js";
import subscriptionRoutes from "./routes/subscription.js";
import accountRoutes from "./routes/account.js";
import authRoutes from "./routes/auth.js";
import favoriteWorkoutRoutes from "./routes/favoriteWorkouts.js";
import { logger } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const isProd = process.env.NODE_ENV === 'production'
const envOrigins = String(process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

// CORS
// Capacitor-App-Scheme aus client/capacitor.config.ts (ios.scheme)
const CAP_APP_SCHEMES = ['capacitor://localhost', 'com.pushpulllegs.com://localhost']

const allowedOrigins = new Set([
  ...CAP_APP_SCHEMES,
  ...(!isProd ? ['http://localhost:5173', 'http://localhost:5174', 'http://localhost'] : []),
  ...envOrigins
])

const allowLanInDev = !isProd && String(process.env.CORS_ALLOW_LAN || '1').trim() !== '0'

app.use(cors({
  origin: (origin, cb) => {
    // Kein Origin-Header (mobile/server-to-server) → erlaubt
    if (!origin) return cb(null, true);
    // String "null" (WKWebView Custom Scheme verhält sich wie file://) → erlaubt
    if (origin === 'null') { logger.info('[CORS] null-origin erlaubt (WKWebView custom scheme)'); return cb(null, true); }
    // Jeder Non-HTTP-Scheme (capacitor://, com.pushpulllegs.com://, ionic://, etc.) → erlaubt
    // Datenzugriff ist durch Firebase Auth Token gesichert, nicht durch CORS
    if (!origin.startsWith('http://') && !origin.startsWith('https://')) {
      logger.info('[CORS] custom-scheme erlaubt:', origin);
      return cb(null, true);
    }
    if (allowedOrigins.has(origin)) return cb(null, true);
    if (allowLanInDev && /^http:\/\/192\.168\.[0-9]{1,3}\.[0-9]{1,3}(?::\d+)?$/.test(origin)) {
      return cb(null, true)
    }
    logger.warn('[CORS] blockiert:', origin)
    return cb(null, false);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true
}));

// JSON
app.use(express.json());

// API-Antworten nie cachen: ohne expliziten Cache-Control-Header cacht der WKWebView
// (iOS-App) GET-Requests heuristisch selbst und liefert sie später aus dem Disk-Cache
// aus (Status 304, "Quelle: Speichercache" in den DevTools) — OHNE überhaupt eine
// Anfrage an den Server zu schicken. Dadurch sah die Übersicht ("Feedbacks") frisch
// generiertes AI-Feedback nicht, obwohl der Server es korrekt erzeugt und gespeichert
// hatte. Betrifft nur /api/*, nicht die statischen Assets darunter.
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Statische Dateien (Rollback: gesamtes public-Verzeichnis)
app.use(express.static(path.join(__dirname, 'public')));

// Routen einbinden
app.use("/api/workouts", workoutRoutes);
app.use("/api/custom-exercises", customExerciseRoutes);
app.use("/api/exercises", exerciseRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/favorite-workouts", favoriteWorkoutRoutes);

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Temporärer CORS-Diagnose-Endpunkt – kann nach Debugging entfernt werden
app.get('/api/debug/origin', (req, res) => {
  const origin = req.headers.origin || null;
  const ua = (req.headers['user-agent'] || '').slice(0, 120);
  logger.info('[debug/origin]', { origin, ua });
  res.json({ origin, ua });
});

// 404 Not Found - muss nach allen Routen stehen (Express v5)
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.originalUrl });
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
