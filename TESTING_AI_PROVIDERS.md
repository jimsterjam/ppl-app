# Testing AI Providers: OpenAI vs. Ollama

Nach der Refaktorierung können beide Providers lokal getestet werden.

## Setup

### Voraussetzung: AIService läuft
```bash
cd server
npm run dev
```

Der Server initializiert automatisch den AI-Provider basierend auf `AI_PROVIDER` in `.env`.

---

## Test 1: Mit Ollama/Qwen (lokal)

### 1. .env anpassen
```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:4b
OLLAMA_TIMEOUT_MS=120000
```

### 2. Ollama starten (Terminal 1)
```bash
ollama serve
```

### 3. Qwen-Modell sicherstellen
```bash
ollama pull qwen3:4b
```

### 4. Backend neu starten (Terminal 2)
```bash
cd server
npm run dev
```

**Expected Output:**
```
🔧 AI Provider: Ollama (local development)
✅ Ollama Provider initialized (model: qwen3:4b, url: http://localhost:11434)
```

### 5. Endpunkt testen
```bash
curl -X POST http://localhost:3001/api/workouts/ai-progress-feedback \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d '{
    "exercise": "Bankdrücken",
    "period": "2 weeks",
    "weight_change": 5,
    "rep_change": 0,
    "volume_change": 12,
    "progression": "positive"
  }'
```

**Expected:** Feedback von Qwen3.5 in ca. 30-60 Sekunden

---

## Test 2: Mit OpenAI (produktiv)

### 1. .env anpassen
```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o-mini
```

### 2. Backend neu starten
```bash
cd server
npm run dev
```

**Expected Output:**
```
🔧 AI Provider: OpenAI (production)
✅ OpenAI Provider initialized (model: gpt-4o-mini)
```

### 3. Denselben Request testen
```bash
curl -X POST http://localhost:3001/api/workouts/ai-progress-feedback \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d '{
    "exercise": "Bankdrücken",
    "period": "2 weeks",
    "weight_change": 5,
    "rep_change": 0,
    "volume_change": 12,
    "progression": "positive"
  }'
```

**Expected:** Feedback von OpenAI in ca. 1-3 Sekunden

---

## Vergleich: Ollama vs. OpenAI

### Qwen3.5 (Ollama - Lokal)
✅ Kostenlos  
✅ Privat (keine Daten zu Drittanbieter)  
✅ Offline möglich  
⏱️ Langsamer (~30-60 Sekunden)  
⚙️ Lokal zu konfigurieren  

### OpenAI (gpt-4o-mini - Cloud)
✅ Schnell (~1-3 Sekunden)  
✅ Höhere Qualität  
💰 Kostenpflichtig  
🌐 Internet erforderlich  
📊 API-Key nötig  

---

## Test 3: Komplettes Workout-Analysis (beide Provider)

### Mit Ollama:
```bash
# Zuerst ein Workout in der DB finden
curl http://localhost:3001/api/workouts \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"

# Dann analysieren (ersetze WORKOUT_ID)
curl -X POST http://localhost:3001/api/workouts/WORKOUT_ID/ai-analysis \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

**Response-Struktur:**
```json
{
  "success": true,
  "backend_analysis": {
    "total_exercises": 4,
    "progression_summary": {
      "positive": 2,
      "stable": 1,
      "negative": 1
    },
    "exercises": [...]
  },
  "ai_feedback": "Deine Entwicklung ist...",
  "ai_metadata": {
    "provider": "Ollama|OpenAI",
    "model": "qwen3:4b|gpt-4o-mini",
    "timestamp": "..."
  },
  "metadata": {
    "aiProvider": "Ollama|OpenAI",
    "aiModel": "qwen3:4b|gpt-4o-mini",
    "aiAvailable": true
  }
}
```

---

## Debugging

### Ollama antwortet nicht
```bash
# Check ob Ollama läuft
curl http://localhost:11434/api/tags

# Fehler? Ollama neu starten
ollama serve
```

### OpenAI-Fehler: 401 Unauthorized
```
OPENAI_API_KEY ist falsch oder nicht gesetzt
```

### AI-Service nicht initialisiert
```
Error: AI Service not initialized
```
→ Server neu starten nach .env Änderung

### Timeout bei Ollama
```
Erlaubt längere Timeouts für große Modelle:
OLLAMA_TIMEOUT_MS=180000  # 3 Minuten
```

---

## Wechsel zwischen Providern

Provider können jederzeit gewechselt werden:

1. `.env` ändern (`AI_PROVIDER=ollama` oder `AI_PROVIDER=openai`)
2. Server neu starten: `npm run dev`
3. Endpunkt testen

Die App passt sich automatisch an. Keine Code-Änderungen nötig.

---

## Kosten bei OpenAI

`gpt-4o-mini` ist kostengünstig:
- ~$0,00015 pro 1k input tokens
- ~$0,0006 pro 1k output tokens

Mit strukturierten Backend-Daten (kein Spam) sollte der Durchschnitt unter $0,01 pro Analyse liegen.

---

## Nächste Schritte

1. ✅ Mit Ollama lokal testen und iterieren
2. ✅ Mit OpenAI testen und Qualität prüfen
3. 📦 Beide Provider in Produktion verfügbar machen
4. 🔄 Optional: Fallback-Mechanismus (Ollama → OpenAI bei Fehler)
