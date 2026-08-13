# Ollama Integration - Schritt-für-Schritt Anleitung

Ziel: iPhone-App → Node.js Backend → Ollama/Qwen3 (lokal) → Progress Feedback

## ✅ Voraussetzungen (bereits erledigt)
- ✅ Ollama läuft auf `http://localhost:11434`
- ✅ Qwen3 1.7B ist heruntergeladen
- ✅ Node.js Backend-Dateien aktualisiert

## 🔧 Schritt 1: Backend lokal starten

```bash
cd server
npm run dev
```

Erwartet: Server läuft auf `http://localhost:3001`

## 🧪 Schritt 2: Ollama-Integration testen

In einem neuen Terminal:

```bash
cd server
node test-ollama-integration.mjs
```

Das Script testet:
1. Ist Ollama erreichbar? (Health Check)
2. Funktioniert direkte Ollama-Anfrage? (generateProgressFeedback)
3. Funktioniert der neue Endpunkt? (/api/workouts/ai-progress-feedback)

**Erwartet Output:**
```
✅ Ollama is healthy and accessible
✅ Feedback from Qwen3: "Dein Fortschritt ist solide..."
✅ Endpoint exists and responds
```

## 📊 Schritt 3: Manuelle API-Tests mit curl

Falls du lieber manuell testen möchtest:

### 3.1 Health Check
```bash
curl http://localhost:11434/api/tags
```

### 3.2 Test ohne Authentication (wird 401 geben)
```bash
curl -X POST http://localhost:3001/api/workouts/ai-progress-feedback \
  -H "Content-Type: application/json" \
  -d '{
    "exercise": "Bankdrücken",
    "period": "8 weeks",
    "weight_change": 5,
    "rep_change": 2,
    "volume_change": 15,
    "progression": "positive"
  }'
```

Expected: 401 (Unauthenticated) – das ist normal

## 📝 Schritt 4: iPhone-Integration vorbereiten

Dein Backend wartet jetzt auf POST zu `/api/workouts/ai-progress-feedback` mit:

```json
{
  "exercise": "Übungsname",
  "period": "8 weeks",
  "weight_change": 5,
  "rep_change": 1,
  "volume_change": 15,
  "progression": "positive"
}
```

Response:
```json
{
  "success": true,
  "exercise": "Übungsname",
  "feedback": "Kurzes ehrliches Feedback von Qwen3...",
  "metadata": {
    "requestId": "...",
    "timestamp": "...",
    "model": "qwen3:1.7b",
    "source": "ollama_local"
  }
}
```

## 🚀 Nächste Schritte

Nach erfolgreichem lokalen Test:

1. **iPhone-Datenbeschaffung**: Welche Trainingsdaten sendet die App?
2. **Mini-Datensatz Builder**: Backend-Funktion, die Rohdaten → `{ exercise, period, weight_change, ... }` konvertiert
3. **iPhone verbindet sich mit Mac**: LAN-basierter Test (iPhone auf selbe WiFi)

## 🐛 Troubleshooting

| Problem | Lösung |
|---------|--------|
| `ECONNREFUSED` auf Port 11434 | Ollama läuft nicht. Starten: `ollama serve` |
| `Empty response from Ollama` | Qwen3 nicht geladen. Versuchen: `ollama pull qwen3:1.7b` |
| Backend crasht | Logs anschauen in Terminal. Meist fehlende ENV-Variablen. |
| Tests sagen "Endpoint exists" aber 401 | ✅ Das ist gut! Auth ist aktiv. |

## 📌 Umgebungsvariablen (optional)

In `server/.env`:

```env
# Ollama (optional – nutzt defaults falls nicht gesetzt)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:1.7b
OLLAMA_TIMEOUT_MS=30000
```

## ✨ Was jetzt möglich ist

- ✅ Lokale KI-Texterstellung ohne Internet
- ✅ Schnelle Iteration (kein API-Quota)
- ✅ Private Daten (keine Übertragung zu OpenAI)
- ✅ Kostenlos nach Ollama-Download

---

**Status**: Schritt 1-2 erledigt. Nächste Milestones: iPhone-Datenflusss + Server-Deployment.
