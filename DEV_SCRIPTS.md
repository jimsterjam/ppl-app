# Development Scripts

## 🚀 Server starten

### Empfohlen (Backend + Frontend parallel, mit Auto-Restart)
```bash
npm run dev
```
Startet `dev-stable.sh`: nodemon für Server + Vite für Client, koordiniertes Beenden mit Ctrl+C.

### Einzeln
```bash
npm run server     # Backend mit nodemon (Auto-Restart)
npm run client     # Frontend (Vite)
npm run server:prod  # Backend ohne nodemon (Production-Modus)
```

### Fallback (ohne nodemon)
```bash
npm run dev:old    # concurrently: Backend + Frontend
npm run dev:basic  # dev.sh (legacy)
```

---

## 📱 iOS / Capacitor

### Build & Xcode öffnen
```bash
cd client

npm run ios:fast     # build + rsync → Xcode öffnen (schnell, ohne pod install)
npm run ios:refresh  # build + cap sync + Xcode öffnen (vollständig)
npm run ios          # nur Xcode öffnen (cap open ios)
```

### Sync ohne Xcode öffnen
```bash
npm run cap:sync                  # clean web + cap sync (alle Plattformen)
npm run cap:sync:ios:stable       # clean + cap copy ios + pod install (empfohlen bei Pod-Fehlern)
```

### Build (nur Dist erstellen)
```bash
npm run build
# oder aus Root:
cd .. && npm run build
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

### CORS-Konfiguration (wichtig für iOS + Production)

Der Server liest eine env-gesteuerte Origin-Allowlist:

- `CORS_ALLOWED_ORIGINS`: Komma-separierte, exakte Origins
- `CORS_ALLOW_LAN`: erlaubt im Dev-Modus zusätzlich `http://192.168.x.x[:port]`

**Empfohlen für Development (`server/.env`):**
```bash
NODE_ENV=development
CORS_ALLOW_LAN=1
CORS_ALLOWED_ORIGINS=capacitor://localhost,http://localhost:5173,http://localhost:5174,http://localhost
```

**Empfohlen für Production:**
```bash
NODE_ENV=production
CORS_ALLOW_LAN=0
CORS_ALLOWED_ORIGINS=https://app.push-pull-legs.de
```

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
