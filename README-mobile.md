# iOS / Capacitor Setup

App-ID: `com.pushpulllegs.com` — Capacitor 7, WKWebView, `VITE_CAP_HTTP_ENABLED=false`

## Voraussetzungen

```bash
cd client && npm install
```

`.env` in `client/` anlegen:
```
VITE_API_BASE=https://ppl-app-server.onrender.com
```

> Für lokales Backend: `VITE_API_BASE=http://192.168.x.x:3001`  
> Im Simulator/Gerät muss die IP des Macs erreichbar sein.

## Build & Deploy auf Gerät

```bash
cd client

# Schnell (nur build + rsync, kein pod install)
npm run ios:fast

# Vollständig (build + cap sync + Xcode)
npm run ios:refresh

# Nur Xcode öffnen (kein Build)
npm run ios
```

In Xcode: Team/Signing setzen → Scheme auf Gerät/Simulator → Run.

## Sync (Plugins / Native-Code aktualisieren)

```bash
# Standard
npm run cap:sync

# Stabiler (Pod-Fehler beheben)
npm run cap:sync:ios:stable
```

## Firebase Auth (iOS)

- `initializeAuth(app, { persistence: browserLocalPersistence })` — WKWebView-kompatibel
- Apple Sign-In → Custom Token vom Backend → Firebase Web SDK
- Auth-Status wird in `userStore.js` verwaltet

## CORS für lokales iPhone-Testing

`server/.env`:
```
NODE_ENV=development
CORS_ALLOW_LAN=1
CORS_ALLOWED_ORIGINS=capacitor://localhost,http://localhost:5173
```

## Hinweise

- ATS (App Transport Security): Production-Backend muss HTTPS sein
- Safe Areas: `viewport-fit=cover` gesetzt; UI nutzt `env(safe-area-inset-*)` 
- Bild-Uploads: Base64 / Data-URL via `@capacitor/camera`
- App Store: Icons, Splash, Info.plist (NSCameraUsageDescription etc.) in Xcode einrichten
