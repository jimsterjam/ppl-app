# Development Server Scripts

## 🚀 Verfügbare Modi

### 1. **Empfohlen: Stabiler Modus mit Auto-Restart**
```bash
npm run dev
# oder direkt:
./dev-stable.sh
```

**Features:**
- ✅ Backend startet automatisch bei Code-Änderungen neu (nodemon)
- ✅ Automatisches Cleanup bei Start
- ✅ Sauberes Beenden mit Ctrl+C
- ✅ Farbige Logs für bessere Übersicht

**Wann nutzen:** Standard für Development, besonders bei häufigen Backend-Änderungen

---

### 2. **Basis-Modus (alte Methode)**
```bash
npm run dev:old
# oder:
npm run dev:basic
```

**Features:**
- Concurrently startet beide Server parallel
- Kein Auto-Restart bei Änderungen
- Manueller Neustart nötig: `killall -9 node && npm run dev:old`

**Wann nutzen:** Wenn nodemon Probleme macht oder nur Frontend-Änderungen

---

### 3. **Einzelne Server starten**

**Backend (mit Auto-Restart):**
```bash
npm run server
# oder mit Watchdog (10 Auto-Restarts bei Crash):
./watchdog-backend.sh
```

**Backend (ohne Auto-Restart):**
```bash
npm run server:prod
```

**Frontend:**
```bash
npm run client
```

---

## 🔧 Konfiguration

### nodemon.json
Konfiguriert das Auto-Restart-Verhalten:
- `watch`: Überwachte Dateien/Ordner
- `ext`: Datei-Extensions
- `ignore`: Ignorierte Pfade
- `delay`: Verzögerung vor Restart (1000ms = 1s)

### Ports
- Frontend: `5173` (Vite)
- Backend: `3001` (Express)

---

## 🐛 Troubleshooting

### Server startet nicht / Port belegt
```bash
# Alle Node-Prozesse beenden
killall -9 node

# Ports manuell freigeben
lsof -ti:3001 | xargs kill -9
lsof -ti:5173 | xargs kill -9

# Dann neu starten
npm run dev
```

### Backend crashed ständig
```bash
# Nutze Watchdog (startet bis zu 10x automatisch neu)
./watchdog-backend.sh
```

### Nodemon erkennt Änderungen nicht
```bash
# Prüfe nodemon.json watch patterns
# Oder nutze manuellen Restart: type 'rs' in terminal
```

### Logs zu viel/wenig
- Mehr Details: In `nodemon.json` → `"verbose": true`
- Weniger Details: `"verbose": false`

---

## 📝 Logs verstehen

### dev-stable.sh Ausgabe
```
🚀 Starte Bro Split App (Stabil-Modus mit Auto-Restart)
🧹 Cleanup: Beende alte Prozesse...
✅ Cleanup abgeschlossen

🔵 [Backend] Starte mit Nodemon (Auto-Restart aktiv)...
🟢 [Frontend] Starte Vite...

✅ Server gestartet!
📱 Frontend: http://localhost:5173
🔌 Backend:  http://localhost:3001

💡 Backend startet automatisch bei Änderungen neu
💡 Drücke CTRL+C zum Beenden
```

### Nodemon Restart
```
[nodemon] restarting due to changes...
[nodemon] starting `node server.js`
```

---

## ⚡ Best Practices

1. **Immer `npm run dev` nutzen** (stabiler Modus)
2. **Bei Problemen:** `killall -9 node` → `npm run dev`
3. **Backend-Logs prüfen:** Zeigen Auto-Restart und Fehler
4. **Git vor Änderungen committen:** Fallback bei Problemen

---

## 🔄 Migration von alter Setup

**Alt:**
```bash
npm run dev  # Nutzte concurrently ohne Auto-Restart
```

**Neu:**
```bash
npm run dev       # Nutzt jetzt dev-stable.sh mit nodemon
npm run dev:old   # Alte Methode falls nötig
```

**Kein Breaking Change:** Alte Scripts bleiben als `dev:old` verfügbar
