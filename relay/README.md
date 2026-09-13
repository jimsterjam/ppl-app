# bro-split-ai-relay

Geschützter Relay zwischen `server/` (bro-split-app) und der OpenAI-API. Hält den echten
`OPENAI_API_KEY` ausschließlich in seinem eigenen Deployment - `server/` kennt im Relay-Modus
nur ein geteiltes Secret (`AI_RELAY_SHARED_SECRET`). Siehe `server/utils/aiClientFactory.js`
für die Client-Seite.

## Lokal starten (ohne echten OpenAI-Key testbar)

```bash
cd relay
npm install
cp .env.example .env
# RELAY_SHARED_SECRET setzen (z.B. `openssl rand -hex 32`), OPENAI_API_KEY kann für
# Auth-/Allowlist-Tests leer bleiben - erst ein tatsächlicher /chat/completions-Aufruf
# scheitert dann am Upstream (401 von OpenAI), Relay-eigene Logik ist trotzdem geprüft.
npm run dev
```

## Tests (kein echter Key, kein echtes Netzwerk nötig)

```bash
npm test
```

Prüft Auth (fehlendes/falsches Secret), die Pfad-Allowlist und die Weiterleitung gegen einen
lokalen Mock-Upstream (`app.test.js`).

## Deployment

Noch nicht deployed. Schritt-für-Schritt-Anleitung: siehe [DEPLOYMENT.md](./DEPLOYMENT.md).
