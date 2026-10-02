// Einfacher Pro-Nutzer-Zähler im Speicher (gleitendes Fenster), z.B. für die Stillstand-Diagnose.
// Wie checkAiBurstLimit (utils/aiUtils.js) nicht persistent und pro Server-Instanz - reicht als
// Missbrauchsschutz (Skripte, Endlosschleifen im Client), ist aber kein Abrechnungszähler.

/**
 * @param {{ windowMs: number, max: number, maxUsers?: number, now?: () => number }} options
 * @returns {(userId: string) => { allowed: boolean, retryAfterSec: number, remaining: number }}
 */
export function createUserRateLimiter({ windowMs, max, maxUsers = 10000, now = () => Date.now() }) {
  const buckets = new Map();

  return function check(userId) {
    const key = String(userId || 'anonymous');
    const t = now();
    const history = (buckets.get(key) || []).filter((ts) => t - ts < windowMs);

    if (history.length >= max) {
      buckets.set(key, history);
      const retryAfterMs = Math.max(0, windowMs - (t - history[0]));
      return { allowed: false, retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)), remaining: 0 };
    }

    history.push(t);
    // Älteste Einträge verwerfen, damit der Speicher bei vielen Nutzern nicht unbegrenzt wächst.
    buckets.delete(key);
    buckets.set(key, history);
    if (buckets.size > maxUsers) buckets.delete(buckets.keys().next().value);
    return { allowed: true, retryAfterSec: 0, remaining: max - history.length };
  };
}
