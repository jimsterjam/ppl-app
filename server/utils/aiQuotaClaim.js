// Atomares Beanspruchen eines KI-Kontingent-Platzes (Datenbank). Prüfung und Erhöhen des Zählers passieren in EINER
// bedingten Update-Anweisung. Zwei gleichzeitige Anfragen können so nicht beide den letzten freien Platz sehen. Wird
// vor dem Aufruf des KI-Dienstes aufgerufen und bei einem Fehlschlag (kein Ergebnis) mit `releaseAiQuotaSlot` zurückgegeben,
// damit weiter gilt: verbraucht wird nur, wenn der Nutzer ein Ergebnis bekommt.

/**
 * @param {{ model: { findOneAndUpdate: Function }, uid: string, state: object }} input
 *   state = Ergebnis von getAiQuotaState (phase, limit, windowStart)
 * @returns {Promise<{ claimed: boolean, phase?: string, windowStart?: Date|null, profile?: object }>}
 */
export async function claimAiQuotaSlot({ model, uid, state }) {
  if (!uid || !state || !(state.limit > 0)) return { claimed: false };
  const options = { new: true };

  if (state.phase === 'welcome') {
    const profile = await model.findOneAndUpdate(
      { uid, $or: [{ 'aiUsage.welcomeCount': { $exists: false } }, { 'aiUsage.welcomeCount': { $lt: state.limit } }] },
      { $inc: { 'aiUsage.welcomeCount': 1 } },
      options
    );
    return profile ? { claimed: true, phase: 'welcome', windowStart: null, profile } : { claimed: false };
  }

  const windowStart = state.windowStart;
  const sameWindow = () => model.findOneAndUpdate(
    { uid, 'aiUsage.monthWindowStart': windowStart, 'aiUsage.monthlyCount': { $lt: state.limit } },
    { $inc: { 'aiUsage.monthlyCount': 1 } },
    options
  );
  // 1. Normalfall: aktueller Kalendermonat, noch Platz.
  let profile = await sameWindow();
  // 2. Neuer Monat (oder noch kein Fenster gespeichert): Fenster setzen und mit 1 beginnen. Die Bedingung
  //    "Fenster ist nicht das aktuelle" lässt nur EINE von mehreren gleichzeitigen Anfragen durch.
  if (!profile) {
    profile = await model.findOneAndUpdate(
      { uid, 'aiUsage.monthWindowStart': { $ne: windowStart } },
      { $set: { 'aiUsage.monthWindowStart': windowStart, 'aiUsage.monthlyCount': 1 } },
      options
    );
  }
  // 3. Eine gleichzeitige Anfrage hat das neue Fenster gerade gesetzt: noch einmal im jetzt aktuellen Fenster versuchen.
  if (!profile) profile = await sameWindow();
  return profile ? { claimed: true, phase: 'monthly', windowStart, profile } : { claimed: false };
}

/** Gibt einen beanspruchten Platz zurück (Zähler um 1 senken, nie unter 0). Liefert das aktualisierte Profil oder null. */
export async function releaseAiQuotaSlot({ model, uid, claim }) {
  if (!uid || !claim?.claimed) return null;
  if (claim.phase === 'welcome') {
    return model.findOneAndUpdate(
      { uid, 'aiUsage.welcomeCount': { $gt: 0 } },
      { $inc: { 'aiUsage.welcomeCount': -1 } },
      { new: true }
    );
  }
  return model.findOneAndUpdate(
    { uid, 'aiUsage.monthWindowStart': claim.windowStart, 'aiUsage.monthlyCount': { $gt: 0 } },
    { $inc: { 'aiUsage.monthlyCount': -1 } },
    { new: true }
  );
}

/**
 * Führt einen KI-Aufruf nur aus, wenn ein Kontingent-Platz atomar beansprucht werden konnte, und gibt den Platz zurück,
 * wenn der Aufruf kein brauchbares Ergebnis liefert oder einen Fehler wirft (verbraucht wird nur bei Erfolg).
 * @param {{ claim: () => Promise<{claimed: boolean}>, release: (claim: object) => Promise<void>,
 *   run: () => Promise<any>, isSuccess?: (result: any) => boolean }} input
 * @returns {Promise<{ limited: true, error: boolean } | { limited: false, result: any }>} `error: true` = Datenbankfehler beim
 *   Beanspruchen (kein erschöpftes Kontingent): der Aufrufer antwortet wiederholbar und ruft die KI nicht auf
 */
export async function withAiQuotaSlot({ claim, release, run, isSuccess = Boolean }) {
  const slot = await claim();
  if (!slot?.claimed) return { limited: true, error: Boolean(slot?.error) };
  let result;
  try {
    result = await run();
  } catch (error) {
    await release(slot);
    throw error;
  }
  if (!isSuccess(result)) await release(slot);
  return { limited: false, result };
}
