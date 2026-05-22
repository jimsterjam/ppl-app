# Testing Guide — PPL App

## Features-Test Dashboard

```
http://localhost:5173/features-test
```

Erfordert laufenden Dev-Server: `npm run dev`

---

## AI Coach Testing

### Setup
- Mit `OPENAI_API_KEY` in `server/.env`: echte GPT-4-Antworten
- Ohne Key: Demo-Modus (`generateDemoSuggestion`)

### Testschritte

1. **Workout-Vorschlag generieren:**
   - Im Features-Test-Dashboard: "Get AI Workout Suggestion" klicken
   - API: `POST /api/workouts/:id/ai-suggestion`
   - Erwartet: JSON mit Übungs-Vorschlägen (Push/Pull/Legs je nach Typ)

2. **Backend direkt testen (Firebase-Token erforderlich):**
   ```bash
   curl -X POST http://localhost:3001/api/workouts/WORKOUT_ID/ai-suggestion \
     -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
     -H "Content-Type: application/json"
   ```

---

## Offline-Support Testing

1. App im Browser öffnen: `http://localhost:5173`
2. DevTools → Network → "Offline" aktivieren
3. Erwartetes Verhalten:
   - OfflineIndicator-Badge wechselt zu "Offline"
   - Dashboard lädt Workouts aus IndexedDB-Cache
   - Neue Workouts landen in Sync-Queue (`db.syncQueue`)
4. Wieder online gehen → Sync-Queue wird automatisch verarbeitet

---

## API Health Check

```bash
# Server läuft lokal
curl http://localhost:3001/api/health
curl http://localhost:3001/api/test

# Production
curl https://ppl-app-server.onrender.com/api/health
```

---

## Auth-Test (Firebase)

Token für Tests aus der Browser-Console holen (während eingeloggt):
```javascript
// In Browser-DevTools Console (App muss laufen):
const token = await firebase.auth().currentUser.getIdToken()
console.log(token)
```

Dann für geschützte Endpoints:
```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/workouts
```

---

## Hinweise

- Social Features (`/future-features/`) sind **nicht aktiv** und nicht testbar
- Subscription/Upgrade-Modal: `UpgradeModal.vue` existiert, aber kein aktives Payment-Backend
- Exercise-Übersetzungen: DE/EN in `client/src/utils/exerciseTranslation.js`
