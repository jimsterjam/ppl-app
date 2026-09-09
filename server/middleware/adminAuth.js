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
