// server/middleware/firebaseAuth.js
import { admin } from '../utils/firebaseAdmin.js';

export async function firebaseAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    try {
      console.error('[firebaseAuth] missing Authorization header', {
        method: req?.method,
        path: req?.originalUrl || req?.url
      });
    } catch (e) {}
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.replace('Bearer ', '');
  try {
    const decodedToken = await admin.auth().verifyIdToken(token)
    req.auth = { userId: decodedToken.uid, token: decodedToken };
    try {
      console.log('[firebaseAuth] verified token', {
        uid: decodedToken.uid,
        method: req?.method,
        path: req?.originalUrl || req?.url
      });
    } catch (e) {}
    return next()
  } catch (err) {
    // Für Clients nur generische Fehler, Details nur im Server-Log
    try {
      console.error('[firebaseAuth] verifyIdToken failed:', {
        code: err?.code || null,
        method: req?.method,
        path: req?.originalUrl || req?.url
      });
    } catch (e) {}
    return res.status(401).json({ error: 'Unauthorized' });
  }
}