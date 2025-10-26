import express from "express";

import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import workoutRoutes from "./routes/workouts.js";
import exerciseRoutes from "./routes/exercises.js";
import { clerkMiddleware } from './middleware/clerkAuth.js';


// .env zuverlässig relativ zu dieser Datei laden (unabhängig vom CWD)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();

app.use(clerkMiddleware());

// CORS konfigurieren
// CORS: erlaube Vite-Dev-Server Ports 5173/5174 (Proxy) und fehlende Origin (Server-zu-Server)
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

// JSON-Parsing
app.use(express.json());

// MongoDB verbinden (nur wenn MONGO_URI gesetzt ist)
if (process.env.MONGO_URI) {
  // Verbindungsaufbau mit defensiven Timeouts
  mongoose
    .connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10
    })
    .then(() => console.log("MongoDB verbunden"))
    .catch(err => console.error("DB Fehler:", err));

  // Connection Event-Logging & Reconnect-Monitoring
  const conn = mongoose.connection;
  conn.on('connected', () => console.log('🟢 MongoDB connected'));
  conn.on('disconnected', () => console.warn('🟠 MongoDB disconnected'));
  // 'reconnected' wird vom Treiber emittiert
  conn.on('reconnected', () => console.log('🟢 MongoDB reconnected'));
  conn.on('error', (err) => console.error('🔴 MongoDB error:', err));
} else {
  console.warn("Hinweis: MONGO_URI ist nicht gesetzt – DB-Verbindung wird übersprungen.");
}

// Test-Route
app.get("/api/test", (req, res) => {
  res.json({ 
    message: "API funktioniert!", 
    timestamp: new Date().toISOString(),
    endpoints: {
      "GET /api/workouts": "Alle Workouts abrufen (Auth erforderlich)",
      "GET /api/workouts/:id": "Einzelnes Workout abrufen (Auth erforderlich)", 
      "POST /api/workouts": "Neues Workout erstellen (Auth erforderlich)",
      "PUT /api/workouts/:id": "Workout aktualisieren (Auth erforderlich)",
      "DELETE /api/workouts/:id": "Workout löschen (Auth erforderlich)",
      "GET /api/workouts/stats/overview": "Workout-Statistiken (Auth erforderlich)",
      "GET /api/exercises": "Alle Übungen abrufen",
      "GET /api/exercises/category/:category": "Übungen nach Kategorie abrufen",
      "GET /api/exercises/:id": "Einzelne Übung abrufen"
    }
  });
});

// Routen einbinden: Workouts-Router enthält bereits requireAuth pro Route
app.use("/api/workouts", workoutRoutes);
app.use("/api/exercises", exerciseRoutes);

// Health Endpoint: erleichtert Diagnose (Client/Monitoring)
app.get('/api/health', (req, res) => {
  const state = mongoose.connection?.readyState; // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  const map = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  res.json({
    status: 'ok',
    db: map[state] ?? 'unknown',
    readyState: state
  });
});

// Generischer Error-Handler (Clerk-Unauthenticated → 401 JSON; sonst 500)
app.use((err, req, res, _next) => {
  if (err && (err.message === "Unauthenticated" || err.status === 401 || err.code === "unauthenticated")) {
    return res.status(401).json({ error: "Unauthenticated" });
  }
  if (err) {
    console.error("Unhandled error:", err);
  }
  res.status(500).json({ error: "Internal Server Error" });
});

// Server starten
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));