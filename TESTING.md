# 🧪 Features Testing Guide

Dieser Guide zeigt dir, wie du die neuen Premium-Features deiner Fitness-App systematisch testen kannst.

## 🚀 Schnellstart

### 1. Test-Dashboard öffnen
```
http://localhost:5173/features-test
```

### 2. Server starten (für API-Tests)
```bash
cd server
npm run dev
```

### 3. Client starten
```bash
cd client  
npm run dev
```

---

## 💰 Freemium Model Testing

### **Free Plan Limits**
- ✅ **3 Workouts pro Woche**
- ✅ **6 Übungen pro Workout** 
- ✅ **5 Freunde**
- ❌ Kein AI Coach
- ❌ Kein Workout Sharing

### **Testschritte:**

1. **Workout-Limit testen:**
   ```
   1. Klick "Simulate Workout Creation" → 3x
   2. Beim 4. Mal sollte Upgrade-Modal erscheinen
   ```

2. **Übungs-Limit testen:**
   ```
   1. Gehe zu /workout-builder
   2. Wähle 7+ Übungen aus
   3. Bei der 7. Übung sollte Upgrade-Modal erscheinen
   ```

3. **Upgrade testen:**
   ```
   1. Klick "Show Upgrade Modal"
   2. Wähle Pro Plan
   3. Test-Upgrade durchführen
   4. Limits sollten verschwinden
   ```

---

## 🤖 AI Coach Testing

### **Pro Features:**
- ✅ Workout-Vorschläge basierend auf Historie
- ✅ Plateau-Erkennung
- ✅ Progressive Overload Empfehlungen
- ✅ Recovery-Analyse

### **Testschritte:**

1. **AI-Zugang testen:**
   ```
   1. Als Free User: AI-Buttons sind gesperrt
   2. Nach Pro-Upgrade: AI-Buttons funktional
   ```

2. **Workout-Suggestion:**
   ```
   1. Klick "Get AI Workout Suggestion"
   2. API-Call zu /api/ai/workout-suggestion
   3. Empfehlung wird angezeigt (Push/Pull/Legs)
   ```

3. **Progress-Analyse:**
   ```
   1. Klick "Analyze Progress"  
   2. API-Call zu /api/ai/analyze-progress
   3. Insights werden angezeigt (Verbesserungen, Plateaus)
   ```

4. **Backend API testen:**
   ```bash
   # Mit Bearer Token (von Clerk)
   curl -X POST http://localhost:3001/api/ai/workout-suggestion \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

---

## 👥 Social Features Testing

### **Pro Features:**
- ✅ Workout-Sharing
- ✅ Freunde-Feed  
- ✅ Likes & Comments
- ✅ Weekly Challenges

### **Testschritte:**

1. **Sharing-Zugang:**
   ```
   1. Als Free User: Sharing-Buttons gesperrt
   2. Nach Pro-Upgrade: Sharing funktional
   ```

2. **Workout teilen:**
   ```
   1. Klick "Share Mock Workout"
   2. API-Call zu /api/social/share-workout  
   3. Geteiltes Workout erscheint in Liste
   ```

3. **Friends Feed:**
   ```
   1. Klick "Load Friends Feed"
   2. API-Call zu /api/social/friends-feed
   3. Mock-Posts werden angezeigt
   ```

4. **Likes testen:**
   ```
   1. Klick ❤️ bei Feed-Post
   2. Like-Counter erhöht sich
   3. Button wird rot markiert
   ```

---

## 🌍 Exercise Translations Testing

### **Feature:**
- ✅ 60+ Übungen Deutsch ↔ Englisch
- ✅ Fallback für unbekannte Namen
- ✅ Equipment-Terminologie

### **Testschritte:**

1. **Einzelne Übersetzung:**
   ```
   1. Wähle "Bankdrücken" im Dropdown
   2. Übersetzung: "Bench Press"
   3. Rückübersetzung sollte funktionieren
   ```

2. **Alle Übersetzungen:**
   ```
   1. Klick "Test All Translations"  
   2. Console zeigt alle 60+ Übersetzungen
   3. Prüfe auf fehlende/falsche Übersetzungen
   ```

3. **Export testen:**
   ```
   1. Klick "Export Translation Map"
   2. JSON-Datei wird heruntergeladen
   3. Prüfe Vollständigkeit
   ```

4. **In der App testen:**
   ```
   1. Gehe zu /exercises
   2. Wechsel Sprache (DE ↔ EN)
   3. Übungsnamen sollten sich ändern
   ```

---

## 📡 API Integration Testing

### **Backend-Endpoints:**

```javascript
// Subscription
GET  /api/subscription/status
POST /api/subscription/upgrade

// AI Coach  
POST /api/ai/workout-suggestion
GET  /api/ai/analyze-progress
GET  /api/ai/plateau-detection

// Social
POST /api/social/share-workout
GET  /api/social/friends-feed
POST /api/social/like/:id
```

### **Testschritte:**

1. **API-Logs überwachen:**
   ```
   1. Alle Aktionen werden im Test-Dashboard geloggt
   2. Erfolgreiche Calls: Grün
   3. Fehler: Rot mit Details
   ```

2. **Authentifizierung testen:**
   ```
   1. Ohne Login: 401 Unauthorized
   2. Mit Login: 200 Success
   3. Expired Token: 401 + Refresh
   ```

3. **Feature-Gating testen:**
   ```
   1. Free User → AI-Endpoint: 403 Forbidden
   2. Pro User → AI-Endpoint: 200 Success
   ```

---

## 🔧 Lokale Entwicklung

### **Mock-Daten aktivieren:**

```javascript
// In stores: Aktiviere Mock-Mode
const MOCK_MODE = true

// Server: Mock-Responses verwenden
if (process.env.NODE_ENV === 'development') {
  // Return mock data
}
```

### **Subscription zurücksetzen:**
```javascript
// Im Test-Dashboard
localStorage.clear()
subscriptionStore.subscription.plan = 'free'
```

### **Debugging:**
```javascript
// Console-Logs aktivieren
localStorage.setItem('debug', 'subscription,ai,social')

// Pinia State inspizieren
window.subscriptionStore = subscriptionStore
```

---

## ✅ Test-Checkliste

### **Freemium Model:**
- [ ] Free Limits funktionieren
- [ ] Upgrade-Modal erscheint bei Limits
- [ ] Pro-Features nach Upgrade verfügbar
- [ ] Usage-Tracking funktioniert

### **AI Coach:**
- [ ] Feature-Gating funktioniert
- [ ] Workout-Suggestions generiert
- [ ] Progress-Analysis zeigt Insights
- [ ] API-Integration erfolgreich

### **Social Features:**
- [ ] Sharing funktioniert
- [ ] Feed lädt Posts
- [ ] Likes funktionieren  
- [ ] Feature-Gating korrekt

### **Exercise Translations:**
- [ ] Alle 60 Übungen übersetzt
- [ ] Sprach-Umschaltung funktioniert
- [ ] Fallbacks für unbekannte Namen
- [ ] Export funktioniert

### **API Integration:**
- [ ] Alle Endpoints erreichbar
- [ ] Authentifizierung korrekt
- [ ] Error-Handling funktioniert
- [ ] Logging vollständig

---

## 🐛 Häufige Probleme

### **"AI Coach locked" obwohl Pro:**
```javascript
// Subscription-Status refresh
await subscriptionStore.checkSubscription()
```

### **API 404 Errors:**
```javascript
// Server läuft auf Port 3001?
// Proxy in vite.config.js korrekt?
```

### **Übersetzungen fehlen:**
```javascript
// i18n Hot-Reload
window.location.reload()
```

### **Mock-Daten nicht sichtbar:**
```javascript
// Browser-Cache leeren
localStorage.clear()
sessionStorage.clear()
```

---

## 📞 Support

Bei Problemen:
1. Check Console für Errors
2. Check Network-Tab für API-Calls  
3. Check Test-Dashboard API-Logs
4. Restart Server & Client

**Test-Dashboard:** `http://localhost:5173/features-test`