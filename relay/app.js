/**
 * Baut die Express-App des Relays auf (siehe server.js für den Modul-Kommentar mit Zweck/
 * Architektur). Ausgelagert aus server.js, damit relay/app.test.js die App ohne echten
 * OPENAI_API_KEY importieren und testen kann (server.js selbst bricht bewusst fail-fast ab,
 * wenn die kritischen ENV-Variablen fehlen - siehe dort).
 *
 * @param {Object} config
 * @param {string} config.openaiApiKey
 * @param {string} config.relaySharedSecret
 * @param {string} [config.openaiBaseUrl] - überschreibbar für Tests (Mock-Upstream)
 * @param {number} [config.rateLimitWindowMs]
 * @param {number} [config.rateLimitMax]
 * @returns {import('express').Express}
 */
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

export function createApp(config) {
  const {
    openaiApiKey,
    relaySharedSecret,
    openaiBaseUrl = 'https://api.openai.com/v1',
    rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
    rateLimitMax = Number(process.env.RATE_LIMIT_MAX) || 30
  } = config;

  if (!openaiApiKey) throw new Error('createApp: openaiApiKey ist erforderlich');
  if (!relaySharedSecret) throw new Error('createApp: relaySharedSecret ist erforderlich');

  const app = express();

  // CSP/COEP hier ohne Nutzen (reine Server-zu-Server-API, kein HTML), Standard-Header genügen.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(express.json({ limit: '2mb' }));

  // Health-Check OHNE Auth (für Render/Uptime-Monitoring) - liefert bewusst keine internen Details.
  app.get('/healthz', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Grobe Rate-Begrenzung pro IP: der Relay kostet echtes Geld pro Anfrage (OpenAI-API) - selbst
  // mit korrektem Secret soll ein Bug/Loop im Haupt-Server oder ein kompromittiertes Secret
  // nicht zu unbegrenzten Kosten führen können.
  const limiter = rateLimit({
    windowMs: rateLimitWindowMs,
    limit: rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use(limiter);

  app.use((req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token || token !== relaySharedSecret) {
      return res.status(401).json({ error: { message: 'Unauthorized' } });
    }
    next();
  });

  // Allowlist statt Wildcard-Proxy: nur die zwei Pfade, die der bro-split-app-Server
  // tatsächlich nutzt (chat.completions.create + models.list als Health-Check).
  const ALLOWED_EXACT_PATHS = new Set(['/chat/completions', '/models']);
  const isAllowedPath = (requestPath) => ALLOWED_EXACT_PATHS.has(requestPath) || requestPath.startsWith('/models/');

  app.use(async (req, res) => {
    if (!isAllowedPath(req.path)) {
      return res.status(404).json({ error: { message: 'Not found' } });
    }

    try {
      const upstreamUrl = `${openaiBaseUrl}${req.path}`;
      const init = {
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiApiKey}`
        }
      };
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        init.body = JSON.stringify(req.body ?? {});
      }

      const upstreamResponse = await fetch(upstreamUrl, init);
      const bodyText = await upstreamResponse.text();

      res.status(upstreamResponse.status);
      res.set('Content-Type', upstreamResponse.headers.get('content-type') || 'application/json');
      res.send(bodyText);
    } catch (error) {
      console.error('Relay: Weiterleitung an Upstream fehlgeschlagen:', error.message);
      res.status(502).json({ error: { message: 'Upstream request failed' } });
    }
  });

  return app;
}

export default createApp;
