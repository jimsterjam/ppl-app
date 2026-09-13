# Deployment des AI-Relays

Dieser Ordner (`relay/`) ist ein eigenständiger, von `server/` unabhängiger Node-Dienst. Er wird
**separat deployed** und hält den echten `OPENAI_API_KEY` ausschließlich in seiner eigenen
Umgebung - `server/` kennt diesen Key im Relay-Modus nicht mehr, sondern nur ein geteiltes
Secret (siehe `server/utils/aiClientFactory.js`).

**Status: noch nicht deployed.** Dieses Dokument beschreibt die nötigen Schritte, führt sie aber
nicht aus - es wurde bewusst kein öffentliches Deployment vorgenommen.

## Offene Entscheidung: welcher Hosting-Dienst?

Der bestehende `server/`-Dienst läuft bereits auf **Render** (siehe Kommentare in
`server/server.js` zum Deploy-Verhalten). Naheliegend ist daher, den Relay ebenfalls als
zweiten, unabhängigen Render-„Web Service" im selben Workspace zu deployen - dafür sind die
Schritte unten geschrieben. Genauso funktioniert der Relay aber auf jedem Anbieter, der einen
Node-Prozess mit Umgebungsvariablen und einer öffentlichen HTTPS-URL bereitstellt (Railway, Fly.io,
ein eigener VPS mit Reverse-Proxy, ...) - das Vorgehen ist überall im Kern gleich: Repo/Ordner
verbinden, Build-/Start-Befehl setzen, Umgebungsvariablen setzen, deployen, URL notieren.

## Schritt 1: Secret erzeugen

Einmalig ein zufälliges, langes Secret erzeugen (mind. 32 Zeichen empfohlen - `server.js` lehnt
kürzere als 20 Zeichen beim Start ab):

```bash
openssl rand -hex 32
```

Dieses Secret wird **zweimal** benötigt - identisch auf beiden Seiten:
- Auf dem Relay als `RELAY_SHARED_SECRET`
- Auf dem `server/`-Deployment als `AI_RELAY_SHARED_SECRET`

## Schritt 2: Relay auf Render deployen (Beispiel)

1. Neuen **Web Service** in Render anlegen, verbunden mit diesem Repository.
2. **Root Directory**: `relay`
3. **Build Command**: `npm install`
4. **Start Command**: `npm start`
5. **Environment Variables** setzen (Render-Dashboard, nicht committen):
   - `OPENAI_API_KEY` = der echte, produktive OpenAI-Key
   - `RELAY_SHARED_SECRET` = das in Schritt 1 erzeugte Secret
   - optional `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` (Standard: 30 Anfragen/Minute pro IP)
6. Health-Check-Pfad in Render auf `/healthz` setzen (benötigt kein Secret, siehe `app.js`).
7. Deployen. Render vergibt eine URL wie `https://bro-split-ai-relay.onrender.com`.

## Schritt 3: Haupt-Server auf den Relay umstellen

In der Umgebung von `server/` (lokale `.env` NUR zum Testen, produktiv im Render-Dashboard des
`server/`-Diensts):

```
AI_RELAY_URL=https://bro-split-ai-relay.onrender.com
AI_RELAY_SHARED_SECRET=<dasselbe Secret wie oben>
```

`OPENAI_API_KEY` kann danach aus der `server/`-Umgebung entfernt werden - er wird im Relay-Modus
nicht mehr gelesen (siehe `utils/aiClientFactory.js`, Modus `'relay'`).

Nach einem Neustart von `server/` zeigt das Start-Log:
```
🔌 AI-Client-Modus (OpenAIProvider): relay (bro-split-ai-relay.onrender.com) [relay]
```

## Schritt 4: Verifizieren

1. `GET https://<relay-url>/healthz` → `{"status":"ok"}` (ohne Auth-Header).
2. Ein echter Coach-Feedback-Request über die App auslösen und im `server/`-Log prüfen, dass
   `AI-Client-Modus: relay` genutzt wird und die Antwort wie gewohnt ankommt.
3. Optional: `AI_VERIFIER_MODE=shadow` setzen und den Feedback-Qualitäts-Loop im Admin-Panel
   (`VerifierAuditPanel.vue`) beobachten - er läuft im Relay-Modus identisch, nur der
   HTTP-Weg zu OpenAI ist ein anderer.

## Sicherheitshinweise

- `RELAY_SHARED_SECRET` ist kein OpenAI-Key, aber ein Zugriffsschlüssel auf einen Dienst, der
  echtes Geld kostet - genauso sensibel behandeln (nicht committen, nicht in Logs).
- Der Relay lässt nur `POST /chat/completions` und `GET /models*` zu (siehe `app.js`,
  `ALLOWED_EXACT_PATHS`) - kein offener Proxy auf die gesamte OpenAI-API.
- Rate-Limit ist pro IP, nicht pro Secret - bei mehreren Verbrauchern ggf. anpassen.
- Ein Secret-Rotationswechsel erfordert einen kurzen, koordinierten Neustart beider Dienste
  (neues Secret erst auf dem Relay setzen, dann auf `server/`, dann beide neu deployen/starten).
