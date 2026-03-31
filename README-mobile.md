# iOS Vorbereitung (Capacitor)

Diese App wird mit Capacitor als iOS-App verpackt. Folgende Schritte sind nötig:

## 1) Abhängigkeiten installieren

Im `client/`-Ordner:
- `npm install`

## 2) API-Basis für Mobile setzen

Lege eine `.env` im `client/` an (oder nutze CI-Variablen):

```
VITE_API_BASE=https://deine-api-domain.tld
```

Im Web/Dev bleibt die API relativ über `/api` (Vite-Proxy). In der App nutzt der Client dann `https://deine-api-domain.tld/api`.

## 3) Capacitor initialisieren (einmalig)

Im `client/`:
- `npx cap add ios`

Die Konfiguration liegt in `client/capacitor.config.json`.

## 4) Live-Reload im Simulator oder auf echtem iPhone

Variante A – Simulator/Gerät lädt deine Dev-App (HMR):

1. Vite im LAN freigeben:
	- `npm run dev:lan` (entspricht `vite --host`)
	- Prüfe im Browser auf dem Mac: `http://<DEINE_LAN_IP>:5173`
2. Capacitor auf Live-Reload umstellen (URL wird automatisch erkannt):
	- `npm run cap:serve:auto`
3. iOS öffnen und starten:
	- `npm run ios`

Hinweise:
- Gerät und Rechner müssen im selben WLAN sein; macOS-Firewall Port 5173 erlauben.
- Lass `VITE_API_BASE` leer, damit API-Aufrufe weiter über den Vite-Proxy (`/api`) zum lokalen Backend gehen.

Live-Reload beenden (zurück auf gebündelten Build):
- `npm run cap:serve:off`

## 5) Build & Assets kopieren (gebündelt)

Im `client/`:
- `npm run build`
- `npx cap copy`

Optional Sync (Plugins & Native):
- `npx cap sync`

## 6) iOS-Projekt öffnen

Im `client/`:
- `npx cap open ios`

Dann in Xcode:
- Signing & Team setzen
- Scheme auf ein echtes Gerät/Simulator auswählen
- Build/Run

## Hinweise

- Backend muss per HTTPS erreichbar sein (ATS). Für Dev nur temporär Ausnahmen.
- Für lokales iPhone-Testing muss der Server-CORS passend gesetzt sein:
	- Dev: `NODE_ENV=development`, `CORS_ALLOW_LAN=1`
	- Prod: `NODE_ENV=production`, `CORS_ALLOW_LAN=0`, nur explizite Domain in `CORS_ALLOWED_ORIGINS`
- Auth (Clerk) im WebView testen. Falls OAuth-Redirects: Deep Link/Custom URL Scheme einrichten und ggf. `Capacitor Browser` verwenden.
- Für Geräte (Live-Reload): ggf. Origins in Clerk freischalten (z. B. `http://<DEINE_LAN_IP>:5173`).
- Kamera/Medien: Mit Capacitor-Plugins umsetzbar. Der Client unterstützt bereits Base64-Uploads (Data-URL), ideal für die Camera-API.
- Safe Areas: `viewport-fit=cover` ist gesetzt. Wenn nötig, UI-Abstände um `env(safe-area-inset-*)` ergänzen.
- App Store: Icons, Splash, Info.plist (NSCameraUsageDescription etc.), Datenschutzangaben in App Store Connect.
