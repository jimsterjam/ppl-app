# Analyse: Bestehende Ollama-Integration

## 1. ÜBERSICHT DER AKTUELLEN OLLAMA-INTEGRATION

### Betroffene Dateien
- `server/utils/ollamaClient.js` – Ollama HTTP-Client (NEU, von uns hinzugefügt)
- `server/routes/workouts.js` – Zwei Endpunkte nutzen Ollama
- `server/.env` – Keine Ollama-Variablen (nutzt Defaults)

### Zeitliche Einordnung
- **ollamaClient.js**: Neu hinzugefügt in dieser Session
- **workouts.js Änderungen**: Zwei neue Endpunkte + Imports hinzugefügt
- Die Integration ist noch **nicht produktiv** – nur lokal für Entwicklung

---

## 2. AKTUELLES DESIGN

### A. ollamaClient.js – Ollama HTTP-Wrapper

**Funktionen:**
- `checkOllamaHealth()` – Health Check auf `http://localhost:11434`
- `generateWithOllama(prompt)` – Raw Ollama API Call
- `generateProgressFeedback(trainingData)` – spezialisierte Feedback-Funktion

**Konfiguration:**
```javascript
const OLLAMA_BASE_URL = 'http://localhost:11434'
const OLLAMA_MODEL = 'qwen3:4b'
const OLLAMA_TIMEOUT_MS = 120000 // 120 Sekunden
```

**Prompt-Struktur:**
```
Du bist ein sachlicher Fitness-Coach. Analysiere diese Trainingsdaten...
Übung: ${exercise}
Zeitraum: ${period}
Gewichtsveränderung: ${weight_change} kg
Wiederholungen-Veränderung: ${rep_change}
Volumenveränderung: ${volume_change}%
Trend: ${progression}
Kurzes, ehrliches Feedback auf Deutsch:
```

**Fehlerbehandlung:**
- Timeout nach 120 Sekunden
- AbortError wird gecatched
- Logger.error bei Fehlern

---

### B. workouts.js – Zwei AI-Endpunkte

#### Endpunkt 1: `POST /api/workouts/:id/ai-analysis`
**Zweck:** Trainingsanalyse mit historischem Vergleich

**Was es macht:**
1. Lädt aktuelles Workout + alle Workouts des Users
2. Für jede Übung im aktuellen Workout:
   - Findet vorherige Session der gleichen Übung
   - Berechnet: weight_change, rep_change, volume_change, progression
   - Ruft `generateProgressFeedback()` auf
3. Gibt strukturiertes Analysis-Objekt zurück

**Ausgabe:**
```json
{
  "success": true,
  "workoutId": "...",
  "exercises": [
    {
      "exercise": "Bankdrücken",
      "current": { "weight": 105, "reps": 8, "sets": 4, "volume": 3360 },
      "previous": { "weight": 100, "reps": 8, "sets": 4, "volume": 3200 },
      "changes": { "weight_change": 5, "rep_change": 0, "volume_change": 5 },
      "progression": "positive",
      "period": "7 days",
      "feedback": "Dein Fortschritt ist solide..."
    }
  ],
  "metadata": { "model": "qwen3:4b", "source": "ollama_local" }
}
```

#### Endpunkt 2: `POST /api/workouts/ai-progress-feedback`
**Zweck:** Einfaches Feedback zu einzelnen Übungsdaten (ohne Historie)

**Input:**
```json
{
  "exercise": "Bankdrücken",
  "period": "8 weeks",
  "weight_change": 5,
  "rep_change": 2,
  "volume_change": 15,
  "progression": "positive"
}
```

**Ausgabe:**
```json
{
  "success": true,
  "exercise": "Bankdrücken",
  "feedback": "...",
  "metadata": { "model": "qwen3:1.7b", "source": "ollama_local" }
}
```

---

## 3. PROBLEME & LIMITATIONS DER AKTUELLEN OLLAMA-IMPLEMENTIERUNG

### Problem 1: Rohdaten an LLM
- Backend sendet nur `weight_change, rep_change, volume_change, progression`
- Kein strukturiertes Verständnis für das LLM
- LLM macht eigene (möglicherweise falsche) Interpretationen

### Problem 2: Keine Validierung der LLM-Ausgabe
- Das LLM könnte Zahlen verändern (sollte es nicht)
- Keine Prüfung auf halluzinierte Ursachen
- Keine Prüfung auf medizinische Diagnosen

### Problem 3: Anforderungen aus der bestehenden Anwendung

Wenn man schaut, sind die **einzigen AI-Aufrufe diese zwei Endpunkte**:
1. `/api/workouts/:id/ai-analysis`
2. `/api/workouts/ai-progress-feedback`

**Diese sind noch nicht mit der iPhone-App verbunden!**

---

## 4. WIEDERVERWENDBARE KOMPONENTEN

### ✅ Behalte: Berechnungslogik in `/api/workouts/:id/ai-analysis`

Diese Funktion ist sehr wertvoll:
```javascript
function calculateExerciseStats(exercise)
// ↓
// Berechnungen:
// - Gewichtsveränderung
// - Wiederholungsveränderung
// - Volumenveränderung
// - Trend-Erkennung
```

**Diese Berechnungen sind deterministisch und sollten bleiben.**

Aber: Sie müssen in eine separate Datei extrahiert werden, damit sie nicht Ollama-abhängig sind.

### ✅ Behalte: Fehlerbehandlung aus ollamaClient.js

```javascript
- Timeout-Handling
- AbortError-Catching
- Robustes Logging
```

Diese können in einen `AIService` extrahiert werden.

### ✅ Behalte: Prompt-Struktur und Regeln

Der Prompt ist gut, aber muss:
- In einen zentralen Service extrahiert werden
- Regeln hinzufügen für: Keine Halluzinationen, Keine medizinischen Aussagen, etc.
- Deutsch standardisieren

---

## 5. NICHT WIEDERVERWENDBAR / ZU LÖSCHEN

### ❌ ollamaClient.js – wird durch AIService ersetzt
- Zu Ollama-spezifisch
- Keine Provider-Abstraktion

### ❌ Health Check für Ollama
- Nur für Ollama relevant
- Im produktiven OpenAI-Setup nicht nötig

### ❌ Hardcoded "qwen3:4b" / "qwen3:1.7b" Modellnamen
- Werden durch ENV-Variable ersetzt

---

## 6. STRUKTUR FÜR DIE REFAKTORIERUNG

Nach der Umstrukturierung sollte die Architektur so aussehen:

```
server/
├── services/
│   ├── aiService.js              [NEU] Zentrale AI-Service
│   │   ├── AIProvider.js         [NEU] Interface/Base-Klasse
│   │   ├── OpenAIProvider.js     [NEU] OpenAI-Implementierung
│   │   └── OllamaProvider.js     [NEU] Ollama-Implementierung (optional)
│   └── trainingAnalysisService.js [NEU] Reine Backend-Berechnungen
├── utils/
│   ├── ollamaClient.js           [LÖSCH] wird nicht mehr genutzt
│   └── aiPrompts.js              [NEU] Zentrale Prompts
├── routes/
│   └── workouts.js               [MODIFIZIER] Nur noch OpenAI
└── middleware/
    └── aiValidation.js           [NEU] Output-Validierung
```

---

## 7. ZUSAMMENFASSUNG AUSWIRKUNGEN

### Dateien die **gelöscht** werden:
- `server/utils/ollamaClient.js`
- `server/test-ollama-integration.mjs`
- `server/test-workout-analyzer.mjs`

### Dateien die **erstellt** werden:
- `server/services/aiService.js`
- `server/services/trainingAnalysisService.js`
- `server/services/OpenAIProvider.js`
- `server/services/OllamaProvider.js` (optional, für lokale Tests)
- `server/utils/aiPrompts.js`
- `server/middleware/aiValidation.js`

### Dateien die **modifiziert** werden:
- `server/routes/workouts.js` – Ollama-Imports entfernen, neue AIService-Imports hinzufügen
- `server/.env` – Ollama-Variablen entfernen (falls vorhanden)

### Abhängigkeiten der iPhone-App:
- Die zwei Endpunkte `/api/workouts/:id/ai-analysis` und `/ai-progress-feedback` **bleiben erhalten**
- Das Interface ändert sich NICHT
- Nur die Backend-Implementierung wechselt von Ollama zu OpenAI

---

## 8. NÄCHSTE SCHRITTE

1. ✅ Diese Analyse (DONE)
2. Berechnungslogik extrahieren → `trainingAnalysisService.js`
3. AIService-Framework bauen → `aiService.js` + Provider-Pattern
4. OpenAI-Provider implementieren
5. Ollama-Provider implementieren (optional)
6. workouts.js anpassen
7. Tests schreiben
8. Mit Qwen testen, dann OpenAI
9. Alte Ollama-Dateien löschen
10. .env aufräumen
