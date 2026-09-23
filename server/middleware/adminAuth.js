// ---------------------------------------------------------------------------
// Einfacher Admin-Schutz für interne Review-Endpunkte (z.B. GET /api/feedback).
// KEIN vollwertiges Rollen-/Rechtesystem - bewusst minimal für die Testphase mit einem
// einzelnen Admin (Paul). Schützt per statischem Schlüssel im Header `x-admin-key`, der
// serverseitig über die Umgebungsvariable ADMIN_API_KEY gesetzt wird (z.B. in Render unter
// Environment). Ist die Variable nicht gesetzt, bleibt der Endpunkt bewusst gesperrt (503)
// statt offen zu sein - ein leerer/undefinierter Wert darf niemals "immer durchlassen" bedeuten.
export function requireAdminKey(req, res, next) {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) {
    return res.status(503).json({ error: 'Admin access not configured' });
  }

  const provided = req.get('x-admin-key');
  if (!provided || provided !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

// Liest ADMIN_UIDS (kommagetrennte Firebase-UIDs, z.B. in Render unter Environment).
export function parseAdminUids(value) {
  return new Set(
    String(value || '')
      .split(',')
      .map((uid) => uid.trim())
      .filter(Boolean)
  );
}

// Zusätzlicher Schutz für besonders interne Admin-Daten (aktuell: Verifier-Protokoll), der den
// statischen Admin-Schlüssel ergänzt: der Aufruf muss zusätzlich von einem eingeloggten Account
// kommen, dessen UID in ADMIN_UIDS steht. Muss NACH firebaseAuthMiddleware laufen (braucht
// req.auth.userId). Wie bei requireAdminKey gilt: nicht konfiguriert = gesperrt (503), nie offen.
export function requireAdminUid(req, res, next) {
  const allowed = parseAdminUids(process.env.ADMIN_UIDS);
  if (allowed.size === 0) {
    return res.status(503).json({ error: 'Admin access not configured' });
  }

  const uid = req.auth?.userId;
  if (!uid || !allowed.has(uid)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
}
