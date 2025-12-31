import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import { admin } from '../utils/firebaseAdmin.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

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

    const uid = payload?.sub;
    if (!uid) {
      return res.status(401).json({ error: 'missing-google-sub' });
    }

    const additionalClaims = {
      email: payload?.email ?? email ?? null,
      emailVerified: !!payload?.email_verified,
      authProvider: 'google-native'
    };

    const customToken = await admin.auth().createCustomToken(uid, additionalClaims);

    res.json({
      customToken,
      firebaseUid: uid,
      email: payload?.email ?? email ?? null,
      picture: payload?.picture ?? null,
      locale: payload?.locale ?? null,
      expiresIn: 3600,
      googleProfile: {
        email: payload?.email ?? email ?? null,
        name: payload?.name ?? null,
        givenName: payload?.given_name ?? null,
        familyName: payload?.family_name ?? null,
        picture: payload?.picture ?? null,
        id: uid
      },
      debug: {
        receivedAccessToken: Boolean(accessToken),
        receivedServerAuthCode: Boolean(serverAuthCode)
      }
    });
  } catch (err) {
    logger.error('Native Google auth exchange failed', err);
    const status = err?.message === 'invalid-google-token' ? 401 : 500;
    res.status(status).json({ error: 'google-native-auth-failed', message: err?.message || 'unknown-error' });
  }
});

export default router;
