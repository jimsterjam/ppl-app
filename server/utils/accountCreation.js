// Registrierungszeitpunkt des Firebase-Kontos im Profil festhalten (Grundlage für das Willkommenskontingent in
// utils/aiQuota.js). Das Profil-Dokument entsteht erst beim ersten Serveraufruf; sein createdAt ist deshalb NICHT der
// Zeitpunkt der Registrierung. Der Wert wird einmal aus den Firebase-Kontodaten geholt und unveränderlich gespeichert.
// Schlägt die Abfrage fehl, bleibt der Wert leer (Monatskontingent als sichere Rückfalllösung), beim nächsten Aufruf
// wird es erneut versucht.

/** Registrierungszeitpunkt aus Firebase (Admin-SDK wird erst bei Bedarf geladen). */
export async function firebaseCreationTime(uid) {
  const { admin } = await import('./firebaseAdmin.js');
  const user = await admin.auth().getUser(uid);
  return user?.metadata?.creationTime || null;
}

/**
 * @param {object} profile - UserProfile-Dokument
 * @param {{ model: { updateOne: Function }, lookup?: (uid: string) => Promise<string|Date|null>, logger?: object }} deps
 * @returns {Promise<object>} dasselbe Profil (mit accountCreatedAt, falls ermittelbar)
 */
export async function ensureAccountCreatedAt(profile, { model, lookup = firebaseCreationTime, logger } = {}) {
  if (!profile?.uid) return profile;
  const existing = profile.accountCreatedAt ? new Date(profile.accountCreatedAt) : null;
  if (existing && !Number.isNaN(existing.getTime())) return profile;
  try {
    const raw = await lookup(profile.uid);
    const date = raw ? new Date(raw) : null;
    if (!date || Number.isNaN(date.getTime())) return profile;
    // Nur setzen, wenn noch nichts gespeichert ist (gleichzeitige Aufrufe überschreiben sich nicht).
    await model.updateOne(
      { uid: profile.uid, $or: [{ accountCreatedAt: { $exists: false } }, { accountCreatedAt: null }] },
      { $set: { accountCreatedAt: date } }
    );
    profile.accountCreatedAt = date;
  } catch (error) {
    logger?.warn?.('⚠️ Registrierungszeitpunkt konnte nicht ermittelt werden', { error: error?.message });
  }
  return profile;
}
