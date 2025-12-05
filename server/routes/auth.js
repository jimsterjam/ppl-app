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
    logger.error('Failed to verify Google ID token', err);
    throw new Error('invalid-google-token');
  }
}

router.post('/google-native', async (req, res) => {
  try {
    const { idToken, accessToken, serverAuthCode, googleId, email } = req.body || {};

    if (!idToken) {
      return res.status(400).json({ error: 'missing-id-token' });
    }

    const payload = await verifyGoogleIdToken(idToken);
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
