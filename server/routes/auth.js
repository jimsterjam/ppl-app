import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import { admin } from '../utils/firebaseAdmin.js';
import { logger } from '../utils/logger.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();
const firebaseWebApiKey = process.env.FIREBASE_WEB_API_KEY || process.env.VITE_FIREBASE_API_KEY || null;

// Allow configuring resend verification rate limit via envs (dev needs higher limits)
const rawResendWindow = Number(process.env.RESEND_VERIFICATION_WINDOW_MS || (60 * 60 * 1000));
const resendLimitWindowMs = Number.isFinite(rawResendWindow) && rawResendWindow > 0 ? rawResendWindow : (60 * 60 * 1000);
const resendLimitDefaultMax = process.env.NODE_ENV === 'production' ? 5 : 20;
const rawResendMax = Number(process.env.RESEND_VERIFICATION_MAX || resendLimitDefaultMax);
const resendLimitMax = Number.isFinite(rawResendMax) && rawResendMax > 0 ? rawResendMax : resendLimitDefaultMax;
const disableResendLimiter = process.env.RESEND_VERIFICATION_DISABLE_RATE_LIMIT === '1' || rawResendMax === 0;

const rawCacheTtl = Number(process.env.RESEND_VERIFICATION_CACHE_TTL_MS || (15 * 60 * 1000));
const resendCacheTtlMs = Number.isFinite(rawCacheTtl) && rawCacheTtl > 0 ? rawCacheTtl : 0;
const resendLinkCache = new Map();

const getCacheKey = (email) => {
  if (typeof email !== 'string') return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed || null;
};

const getCachedLink = (email) => {
  if (!resendCacheTtlMs) return null;
  const cacheKey = getCacheKey(email);
  if (!cacheKey) return null;
  const entry = resendLinkCache.get(cacheKey);
  if (entry && entry.expiresAt > Date.now()) return entry;
  if (entry) resendLinkCache.delete(cacheKey);
  return null;
};

const rememberCachedLink = (email, payload) => {
  if (!resendCacheTtlMs) return;
  const cacheKey = getCacheKey(email);
  if (!cacheKey) return;
  const expiresAt = payload.expiresAt && Number.isFinite(payload.expiresAt)
    ? payload.expiresAt
    : Date.now() + resendCacheTtlMs;
  resendLinkCache.set(cacheKey, {
    link: payload.link,
    warnings: payload.warnings || null,
    expiresAt
  });
};

const clearCachedLink = (email) => {
  if (!resendCacheTtlMs) return;
  const cacheKey = getCacheKey(email);
  if (!cacheKey) return;
  resendLinkCache.delete(cacheKey);
};

async function sendVerificationEmailThroughFirebase(email, continueUrl) {
  if (!firebaseWebApiKey) {
    return { sent: false, reason: 'missing-api-key' };
  }
  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    if (!userRecord?.uid) {
      return { sent: false, reason: 'user-not-found' };
    }
    const customToken = await admin.auth().createCustomToken(userRecord.uid);
    const tokenResp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${firebaseWebApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true })
    });
    const tokenJson = await tokenResp.json().catch(() => ({}));
    if (!tokenResp.ok || !tokenJson?.idToken) {
      logger.error('resend-verification: failed to exchange custom token', tokenJson);
      return { sent: false, reason: 'custom-token-exchange-failed', details: tokenJson?.error?.message || null };
    }
    const sendPayload = { requestType: 'VERIFY_EMAIL', idToken: tokenJson.idToken };
    if (continueUrl && typeof continueUrl === 'string') {
      sendPayload.continueUrl = continueUrl;
      sendPayload.handleCodeInApp = false;
    }
    const sendResp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${firebaseWebApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sendPayload)
    });
    const sendJson = await sendResp.json().catch(() => ({}));
    if (!sendResp.ok) {
      logger.error('resend-verification: sendOobCode failed', sendJson);
      return { sent: false, reason: 'send-oob-failed', details: sendJson?.error?.message || null };
    }
    return { sent: true };
  } catch (err) {
    logger.error('resend-verification: sendVerificationEmailThroughFirebase exception', err?.message || err);
    return { sent: false, reason: 'exception', details: err?.message || String(err) };
  }
}

// Per-email/IP rate limiter for resend verification to avoid hitting Firebase limits
const resendLimiter = rateLimit({
  windowMs: resendLimitWindowMs,
  max: resendLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    try { return req.body && req.body.email ? `email:${String(req.body.email).toLowerCase()}` : req.ip }
    catch { return req.ip }
  },
  handler: (req, res, _next, options) => {
    const retryAfterSec = Math.max(1, Math.ceil(options.windowMs / 1000));
    res.set('Retry-After', String(retryAfterSec));
    return res.status(429).json({ error: 'too-many-requests', message: 'Zu viele Anfragen. Bitte später erneut versuchen.' });
  }
});
const resendLimiterMiddleware = disableResendLimiter ? (req, _res, next) => next() : resendLimiter;

// Generate email verification link for an existing email (admin-generated)
// POST /api/auth/resend-verification { email, continueUrl }
router.post('/resend-verification', resendLimiterMiddleware, async (req, res) => {
  try {
    const { email, continueUrl, forceNewLink } = req.body || {};
    // Always log attempts so we can debug missing links (warn is always emitted)
    logger.warn('resend-verification requested', { email, continueUrl, ip: req.ip, forceNewLink: Boolean(forceNewLink) });
    if (!email) return res.status(400).json({ error: 'missing-email' });

    const wantsFreshLink = Boolean(forceNewLink);
    if (wantsFreshLink) clearCachedLink(email);

    const cachedEntry = wantsFreshLink ? null : getCachedLink(email);
    if (cachedEntry) {
      logger.info('resend-verification: serving cached link', { email });
      const cachedPayload = {
        link: cachedEntry.link,
        cached: true,
        cachedExpiresAt: cachedEntry.expiresAt
      };
      if (cachedEntry.warnings) cachedPayload.warnings = cachedEntry.warnings;
      return res.json(cachedPayload);
    }

    // Validate continueUrl: must be a valid absolute URL with http(s) protocol
    let actionCodeSettings = undefined;
    if (continueUrl && typeof continueUrl === 'string') {
      try {
        const parsed = new URL(continueUrl);
        // Allow only https in production, or localhost/loopback for local dev
        const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '::1';
        if (parsed.protocol === 'https:' || isLocalhost) {
          actionCodeSettings = { url: continueUrl, handleCodeInApp: false };
        } else {
          // reject other hosts (including LAN IPs) because Firebase often rejects them
          logger.warn('resend-verification: continueUrl rejected (must be https or localhost):', continueUrl);
        }
      } catch (e) {
        logger.warn('resend-verification: invalid continueUrl provided, ignoring', continueUrl, e?.message || e);
        // include raw body for debugging
        logger.warn('resend-verification: raw request body', req.body);
      }
    }

    const warnings = [];
    let link;
    try {
      link = await admin.auth().generateEmailVerificationLink(email, actionCodeSettings);
    } catch (linkErr) {
      const msg = linkErr?.message || String(linkErr);
      const continueUrlRejected = Boolean(actionCodeSettings && msg && msg.includes('continue URL'));
      if (continueUrlRejected) {
        warnings.push('continue-url-rejected');
        logger.warn('resend-verification: continueUrl rejected by Firebase, retrying without it', { continueUrl });
        link = await admin.auth().generateEmailVerificationLink(email).catch((fallbackErr) => {
          logger.error('resend-verification: fallback without continueUrl failed', fallbackErr?.message || fallbackErr);
          throw fallbackErr;
        });
      } else {
        throw linkErr;
      }
    }
    // Log the link for developers: show in non-production or when explicitly enabled
    try {
      if (process.env.NODE_ENV !== 'production' || process.env.SHOW_EMAIL_LINKS === '1') {
        logger.info(`Email verification link for ${email}: ${link}`);
      }
    } catch (logErr) {
      // don't fail the request if logging throws
      logger.warn('Could not log verification link', logErr?.message || logErr);
    }
    // Return the link so the client can open it or display instructions
    let delivery = null;
    if (!cachedEntry) {
      delivery = await sendVerificationEmailThroughFirebase(email, actionCodeSettings?.url);
      if (!delivery?.sent) {
        logger.warn('resend-verification: email dispatch skipped/failed', { email, delivery });
      }
    }
    const payload = warnings.length ? { link, warnings } : { link };
    if (delivery) payload.delivery = delivery;
    if (resendCacheTtlMs) {
      const expiresAt = Date.now() + resendCacheTtlMs;
      rememberCachedLink(email, { link, warnings: warnings.length ? warnings : null, expiresAt });
      payload.cached = false;
      payload.cachedExpiresAt = expiresAt;
    }
    res.json(payload);
  } catch (e) {
    // Log full error and request body to aid debugging when Firebase rejects continueUrl
    logger.error('resend-verification failed', e?.message || e, { body: req.body });

    // Map Firebase rate-limit error to 429 so the client can back off
    const msg = e && (e.message || String(e));
    if (msg && msg.includes('TOO_MANY_ATTEMPTS_TRY_LATER')) {
      logger.warn('resend-verification: firebase rate limit hit', { email: req.body && req.body.email });
      const wantsFreshLink = Boolean(req.body && req.body.forceNewLink);
      const cachedEntryOnRateLimit = wantsFreshLink ? null : getCachedLink(req.body && req.body.email);
      if (cachedEntryOnRateLimit) {
        return res.status(200).json({
          link: cachedEntryOnRateLimit.link,
          cached: true,
          warnings: [
            ...(cachedEntryOnRateLimit.warnings || []),
            'firebase-rate-limited'
          ],
          cachedExpiresAt: cachedEntryOnRateLimit.expiresAt,
          delivery: { sent: false, reason: 'rate-limited-served-from-cache' }
        });
      }
      // Suggest client to retry later; set Retry-After (3600s) as a hint
      res.set('Retry-After', '3600');
      return res.status(429).json({ error: 'too-many-requests', message: 'Zu viele Anfragen. Bitte später erneut versuchen.' });
    }

    // If Firebase returned specific error about continueUrl, surface it at warn level
    if (msg && msg.includes('The continue URL must be a valid URL string')) {
      logger.warn('resend-verification: firebase rejected continueUrl', { continueUrl: req.body && req.body.continueUrl });
      return res.status(400).json({ error: 'invalid-continue-url', message: 'Ungültige continueUrl.' });
    }

    res.status(500).json({ error: 'resend-verification-failed', message: e?.message || String(e) });
  }
})

const configuredAudiences = [
  process.env.GOOGLE_IOS_CLIENT_ID,
  process.env.VITE_IOS_CLIENT_ID,
  process.env.GOOGLE_WEB_CLIENT_ID,
  process.env.VITE_WEB_CLIENT_ID,
  process.env.GOOGLE_SERVER_CLIENT_ID
].filter(Boolean);

const FALLBACK_CLIENT_IDS = [
  '109118119734-a1ruf512sojeho0vkgrkjmutp2v2j03g.apps.googleusercontent.com',
  '109118119734-73sv2hb5cjnqdifvgar84t27et1bvvid.apps.googleusercontent.com'
];

const audiences = configuredAudiences.length ? configuredAudiences : FALLBACK_CLIENT_IDS;
const oauthClient = new OAuth2Client();

async function verifyGoogleIdToken(idToken) {
  try {
    const ticket = await oauthClient.verifyIdToken({
      idToken,
      audience: audiences
    });
    const payload = ticket.getPayload();
    logger.warn('Received Google payload audience', payload?.aud);
    return payload;
  } catch (err) {
    logger.warn('google-auth-library verifyIdToken failed, trying Firebase admin.verifyIdToken...', err?.message || err)
    // Fallback: token might be a Firebase ID token (issued by securetoken.google.com)
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      // Normalize decoded firebase token into a payload-like object
      const payload = {
        sub: decoded.uid,
        email: decoded.email || null,
        email_verified: decoded.email_verified || false,
        aud: decoded.aud || process.env.FIREBASE_PROJECT_ID || null,
        iss: decoded.iss || `https://securetoken.google.com/${process.env.FIREBASE_PROJECT_ID}`,
        name: decoded.name || null,
        picture: decoded.picture || null,
        locale: decoded.locale || null
      };
      logger.warn('Verified token with Firebase admin, uid:', decoded.uid);
      return payload;
    } catch (e2) {
      logger.error('Failed to verify Google ID token and Firebase ID token', e2?.message || e2);
      throw new Error('invalid-google-token');
    }
  }
}

router.post('/google-native', async (req, res) => {
  try {
    // Normalize incoming body: accept top-level fields or nested under `authentication`
    const incoming = Object.assign({}, req.body || {}, (req.body && req.body.authentication) ? req.body.authentication : {});
    let { idToken, accessToken, serverAuthCode, googleId, email } = incoming;
    // request received: normalized keys

    // Prefer verifying a provided idToken first (avoids unauthorized_client when code belongs to other client)
    let payload = null;
    if (idToken) {
      try {
        payload = await verifyGoogleIdToken(idToken);
        logger.warn('[auth] idToken verified locally; aud:', payload?.aud)
      } catch (verifyErr) {
        logger.warn('[auth] idToken verification failed; will attempt server-side exchange if serverAuthCode present', verifyErr?.message || verifyErr)
      }
    }

    // If verification didn't yield a payload, and we have a serverAuthCode, attempt server-side exchange
    if (!payload && serverAuthCode) {
      try {
        const serverClientId = process.env.GOOGLE_SERVER_CLIENT_ID || process.env.GOOGLE_WEB_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID
        const serverClientSecret = process.env.GOOGLE_SERVER_CLIENT_SECRET || process.env.GOOGLE_WEB_CLIENT_SECRET
        // server exchange credentials present? check
        if (!serverClientId || !serverClientSecret) {
          logger.error('Server-side exchange requested but server client id/secret missing')
          return res.status(500).json({ error: 'server-client-credentials-missing' })
        }
        const exchangeClient = new OAuth2Client(serverClientId, serverClientSecret)
        logger.warn('[auth] attempting token exchange for serverAuthCode...')
        const r = await exchangeClient.getToken(serverAuthCode)
        try {
          const safeR = Object.assign({}, r)
          if (safeR && safeR.tokens) {
            safeR.tokens = Object.assign({}, safeR.tokens)
            if (safeR.tokens.id_token) safeR.tokens.id_token = '<<id_token_present>>'
            if (safeR.tokens.access_token) safeR.tokens.access_token = '<<access_token_present>>'
            if (safeR.tokens.refresh_token) safeR.tokens.refresh_token = '<<refresh_token_present>>'
          }
          // exchange response (masked)
        } catch (e) {
          logger.warn('[auth] could not stringify exchange response for debug:', e?.message || e)
        }
        const tokens = r.tokens || {}
        accessToken = tokens.access_token || accessToken
        idToken = tokens.id_token || idToken
        // exchanged serverAuthCode for tokens; idToken present: set accordingly

        // If exchange produced an idToken, try verifying it
        if (idToken) {
          payload = await verifyGoogleIdToken(idToken).catch((e) => { logger.warn('[auth] verify after exchange failed', e?.message || e); return null })
        }
      } catch (ex) {
        logger.error('Server-side exchange of serverAuthCode failed', ex?.message || ex)
        return res.status(500).json({ error: 'server-exchange-failed', message: ex?.message || String(ex) })
      }
    }

    // If we still don't have a verified payload, try using idToken (if now present) or accessToken to fetch userinfo
    if (!payload) {
      if (idToken) {
        payload = await verifyGoogleIdToken(idToken).catch((e) => { logger.warn('[auth] verify retry failed', e?.message || e); return null })
      }
      if (!payload && accessToken) {
        try {
          logger.warn('[auth] fetching userinfo with access_token')
          const uresp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` }
          })
          if (!uresp.ok) {
            logger.error('[auth] userinfo fetch failed', uresp.status, await uresp.text().catch(() => 'no-body'))
            return res.status(500).json({ error: 'userinfo-fetch-failed' })
          }
          payload = await uresp.json()
          logger.warn('[auth] userinfo payload keys:', Object.keys(payload || {}))
        } catch (e) {
          logger.error('[auth] failed to fetch userinfo with access token', e)
          return res.status(500).json({ error: 'userinfo-fetch-exception', message: e?.message || String(e) })
        }
      }
    }

    if (!payload) {
      return res.status(400).json({ error: 'missing-id-token' });
    }
    if (googleId && payload?.sub && googleId !== payload.sub) {
      logger.warn('Google ID mismatch between payload and request body');
      return res.status(401).json({ error: 'google-id-mismatch' });
    }

    const googleUid = payload?.sub;
    if (!googleUid) {
      return res.status(401).json({ error: 'missing-google-sub' });
    }

    const resolvedEmail = payload?.email ?? email ?? null;
    const canonicalUid = googleUid;

    const additionalClaims = {
      email: resolvedEmail,
      emailVerified: !!payload?.email_verified,
      authProvider: 'google-native'
    };

    const customToken = await admin.auth().createCustomToken(canonicalUid, additionalClaims);

    res.json({
      customToken,
      firebaseUid: canonicalUid,
      originalGoogleUid: googleUid,
      email: resolvedEmail,
      picture: payload?.picture ?? null,
      locale: payload?.locale ?? null,
      expiresIn: 3600,
      googleProfile: {
        email: resolvedEmail,
        name: payload?.name ?? null,
        givenName: payload?.given_name ?? null,
        familyName: payload?.family_name ?? null,
        picture: payload?.picture ?? null,
        id: canonicalUid
      },
      debug: {
        receivedAccessToken: Boolean(accessToken),
        receivedServerAuthCode: Boolean(serverAuthCode),
        uidReconciled: false,
        movedWorkouts: 0
      }
    });
  } catch (err) {
    logger.error('Native Google auth exchange failed', err);
    const status = err?.message === 'invalid-google-token' ? 401 : 500;
    res.status(status).json({ error: 'google-native-auth-failed', message: err?.message || 'unknown-error' });
  }
});

export default router;
