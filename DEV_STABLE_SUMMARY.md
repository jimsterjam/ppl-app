## Auth/Capacitor iOS – Stable Update (2025-12-05)
- fix(ios-auth): Firebase Web SDK stabilisiert auf iOS (WKWebView)
  - Verwende `initializeAuth(app, { persistence: browserLocalPersistence })` für native Capacitor-Runtime.
  - Entferne künstliche Timeouts beim `signInWithCustomToken` im nativen Pfad.
  - Reduziere Debug-Logs, behalte essentielle Warnungen/Fehler.
- Config-Angleichung
  - `VITE_FIREBASE_APP_ID` ist Web-Format (`:web:`) und projektkonsistent (`ppl-workout-01`).
  - Storage Bucket korrigiert auf `ppl-workout-01.appspot.com`.
  - Backend `firebase-admin` initialisiert explizit mit `projectId` und loggt diese beim Serverstart.
- Tests/Verifikation
  - iOS: Native Google-Login → Backend Custom Token → Firebase-Sign-In erfolgreich; `auth.currentUser` gesetzt.
  - Router/Store hart verdrahtet: Navigation nur mit echtem Token/User.
- Release Hinweise
  - Client Sync: `npm run build && npx cap sync ios && npx cap open ios`.
  - Server Start: `npm run dev` (Projekt-ID-Log sichtbar).
  - Bei zukünftigen iOS-Versionen optionaler Fallback: `indexedDBLocalPersistence` testen, derzeit nicht nötig.

# 🎉 Problem gelöst: Stabile Dev-Umgebung mit Auto-Restart

## ✅ Was wurde implementiert

### 1. **Nodemon Integration**
- Backend startet **automatisch bei Code-Änderungen** neu
- Konfiguriert via `nodemon.json`
- Überwacht: `server/**/*.js`, `server/**/*.json`
- Ignoriert: `node_modules`, `uploads`
- Delay: 1 Sekunde vor Restart

### 2. **Dev-Stable Script** (`dev-stable.sh`)
- **Automatisches Cleanup** bei Start (beendet alte Prozesse)
- **Koordinierter Start** von Backend + Frontend
- **Sauberes Beenden** mit Ctrl+C
- **Farbige Logs** für bessere Übersicht
- **Robuste Pfade** (funktioniert von überall)

### 3. **Watchdog für Crash-Recovery** (`watchdog-backend.sh`)
- Startet Backend automatisch neu bei Crash
- Bis zu **10 Auto-Restarts**
- 2 Sekunden Pause zwischen Restarts
- Exit bei sauberem Beenden

### 4. **Aktualisierte Scripts** (`package.json`)
```json
{
  "dev": "./dev-stable.sh",           // NEU: Stabiler Modus (empfohlen)
  "dev:old": "concurrently ...",      // Alt: Alte Methode
  "server": "npx nodemon server.js",  // NEU: Mit Auto-Restart
  "server:prod": "node server.js"     // Ohne Auto-Restart
}
```

### 5. **Dokumentation** (`DEV_SCRIPTS.md`)
- Alle Modi erklärt
- Troubleshooting Guide
- Best Practices
- Migration von alter Setup

---

## 🚀 Wie nutzen?

### Standard-Workflow (empfohlen)
```bash
npm run dev
```

**Das passiert:**
1. ✅ Beendet alte Node-Prozesse
2. ✅ Räumt Ports 3001, 5173, 5174 auf
3. ✅ Startet Backend mit nodemon (Auto-Restart aktiv)
4. ✅ Startet Frontend mit Vite
5. ✅ Zeigt Status mit farbigen Logs

**Bei Code-Änderungen im Backend:**
- Nodemon erkennt Änderung automatisch
- Wartet 1 Sekunde (debounce)
- Startet Server neu
- Du siehst: `[nodemon] restarting due to changes...`

---

## 💡 Vorteile

### Vorher ❌
- Server crashen zufällig
- Manuelle Restarts nötig: `killall -9 node && npm run dev`
- Ports bleiben belegt
- Unklare Error-Messages
- "Token failed", "Exercise failed" bei jedem Start

### Nachher ✅
- **Auto-Restart** bei Code-Änderungen (Backend)
- **Crash-Recovery** via Watchdog (optional)
- **Automatisches Cleanup** bei Start und Stop
- **Klare Logs** mit Farben und Emojis
- **Robustes Token-Handling** (null statt Demo-Token)
- **Langfristig stabil**

---

## 🔧 Konfiguration

### `nodemon.json` - Auto-Restart Behavior
```json
{
  "watch": ["server/**/*.js", "server/**/*.json"],
  "ext": "js,json",
  "ignore": ["server/node_modules/**", "server/public/uploads/**"],
  "delay": "1000"  // 1s Delay vor Restart
}
```

**Anpassen:**
- Mehr Details: `"verbose": true`
- Andere Dateien: `"watch"` Array erweitern
- Schnellerer Restart: `"delay": "500"`

---

## 🐛 Troubleshooting

### Server startet nicht
```bash
killall -9 node
npm run dev
```

### Backend crashed ständig (>10x)
```bash
# Nutze Watchdog
./watchdog-backend.sh
```

### Nodemon erkennt Änderungen nicht
```bash
# Manueller Restart: Type 'rs' + Enter im Terminal
rs
```

### Port belegt
```bash
lsof -ti:3001 | xargs kill -9
npm run dev
```

---

## 📊 Test-Ergebnisse

### ✅ Getestet
1. Start mit `npm run dev` → **Erfolgreich**
2. Backend startet auf Port 3001 → **OK**
3. Frontend startet auf Port 5173 → **OK**
4. Nodemon erkennt Änderungen → **OK** (1s delay)
5. Ctrl+C beendet beide Server → **OK**
6. Token-Handling verbessert → **OK** (null statt Demo-Token)

### ⚠️ Bekannte Warnungen (nicht kritisch)
- Mongoose duplicate index `{"name":1}` → Kosmetisch, Server läuft

---

## 📝 Migration

### Alt → Neu
```bash
# ALT (musste oft manuell restartet werden)
npm run dev  # nutzte concurrently ohne Auto-Restart

# NEU (Auto-Restart + Crash-Recovery)
npm run dev  # nutzt jetzt dev-stable.sh + nodemon
```

**Keine Breaking Changes!** Alte Methode bleibt als `npm run dev:old` verfügbar.

---

## 🎯 Nächste Schritte

1. **Teste App:** http://localhost:5173
2. **Ändere Backend-Code** → Watch Auto-Restart
3. **Bei Problemen:** Siehe `DEV_SCRIPTS.md`
4. **Commit/Push:** Änderungen sind committed

---

## 📦 Neue Dateien

- `nodemon.json` - Nodemon Konfiguration
- `dev-stable.sh` - Stabiles Dev-Script (ausführbar)
- `watchdog-backend.sh` - Crash-Recovery Script (ausführbar)
- `DEV_SCRIPTS.md` - Vollständige Dokumentation
- `DEV_STABLE_SUMMARY.md` - Diese Datei

---

## ✨ Zusätzliche Verbesserungen

### Token-Handling
- `authToken.js`: Gibt `null` statt `'demo-token-for-testing'` zurück
- Längere Timeout: 3 Sekunden (besser für langsame Clerk-Init)
- Besseres Logging: Jede Token-Quelle separat geloggt

### Sync Manager
- Entfernt alle `'demo-token-for-testing'` Checks
- Arbeitet mit `null` Token
- Klarere Error-Messages

### WorkoutBuilder
- 300ms Delay zwischen Token-Versuchen
- Besseres Logging für Token-Status
- Verhindert "Token failed" beim Start

---

**Status:** ✅ Komplett implementiert und getestet
**Terminal:** Server läuft stabil auf http://localhost:3001 + http://localhost:5173
