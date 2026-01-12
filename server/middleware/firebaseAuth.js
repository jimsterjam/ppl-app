// server/middleware/firebaseAuth.js
import { admin } from '../utils/firebaseAdmin.js';

export function firebaseAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No auth token' });

  const token = authHeader.replace('Bearer ', '');
  admin.auth().verifyIdToken(token)
    .then((decodedToken) => {
      req.auth = { userId: decodedToken.uid, token: decodedToken };
      next();
    })
    .catch((err) => {
      // Verbose logging für Diagnose (keine sensiblen Tokens ins Log)
      try {
        console.error('[firebaseAuth] verifyIdToken failed:', err?.code || err?.message || err);
        console.error('[firebaseAuth] Authorization header present:', Boolean(authHeader));
      } catch (e) {}
      return res.status(401).json({ error: 'Invalid auth token', message: err?.message || String(err) });
    });
}