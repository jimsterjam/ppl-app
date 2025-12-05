// server/middleware/firebaseAuth.js
import { admin } from '../utils/firebaseAdmin.js';

export function firebaseAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No auth token' });

  const token = authHeader.replace('Bearer ', '');
  admin.auth().verifyIdToken(token)
    .then((decodedToken) => {
      req.auth = { userId: decodedToken.uid };
      next();
    })
    .catch(() => res.status(401).json({ error: 'Invalid auth token' }));
}