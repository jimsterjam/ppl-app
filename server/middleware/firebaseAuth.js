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

    // Sicherheitslücke geschlossen: bisher wurde hier nirgends geprüft, ob die E-Mail des
    // Accounts bestätigt ist - die Bestätigung wurde nur clientseitig durchgesetzt
    // (firebaseAuth.js blockt unverifizierte Logins im Client), ein gültiges ID-Token eines
    // unbestätigten Accounts kam aber bisher trotzdem an jeder API-Route vorbei.
    // decodedToken.email_verified ist das reguläre Firebase-Feld (E-Mail/Passwort, Google/Apple
    // Sign-In direkt über den Client). decodedToken.emailVerified (camelCase) ist die Custom
    // Claim, die der /api/auth/google-native-Fallback-Pfad setzt, wenn Google die E-Mail als
    // verifiziert meldet - siehe auth.js. Beide Fälle werden hier akzeptiert.
    const isEmailVerified = decodedToken.email_verified === true || decodedToken.emailVerified === true
    if (!isEmailVerified) {
      try {
        console.warn('[firebaseAuth] blocked: email not verified', {
          uid: decodedToken.uid,
          method: req?.method,
          path: req?.originalUrl || req?.url
        });
      } catch (e) {}
      return res.status(403).json({ error: 'EMAIL_NOT_VERIFIED', message: 'Bitte bestätige zuerst deine E-Mail-Adresse.' });
    }

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