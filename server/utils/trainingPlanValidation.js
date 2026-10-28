import { clampText } from './textLimits.js';

// Prüfung und Bereinigung von Trainingsplänen (client/src/utils/trainingPlan.js ist das Gegenstück). Bewusst als
// reine Funktionen ohne Express/MongoDB, damit sie ohne Server testbar sind. Es werden nur bekannte Felder
// übernommen - nie der Request-Body ungeprüft (siehe CLAUDE.md, "Regeln für Texteingaben").
export const PLAN_LIMITS = Object.freeze({ maxPlans: 3, maxDays: 7, maxName: 40, maxLabel: 24, maxId: 64 });

function cleanLine(value, max) {
  // Erst Steuerzeichen/Leerraum bereinigen, dann kürzen - sonst zählen führende Leerzeichen gegen die Länge.
  const cleaned = String(clampText(String(value ?? '').replace(/[<>]/g, ''), 10000)).replace(/\s+/g, ' ').trim();
  return String(clampText(cleaned, max)).trim();
}

function cleanId(value) {
  const id = String(value ?? '').trim();
  return id && id.length <= PLAN_LIMITS.maxId && /^[A-Za-z0-9_.:-]+$/.test(id) ? id : '';
}

/** Plan-/Tag-Verweis am Workout: nur eine gültige ID, sonst null (Setter darf das Speichern nie scheitern lassen). */
export function sanitizePlanRef(value) {
  return cleanId(value) || null;
}

function cleanDate(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time) : null;
}

/**
 * @param {object} body - Request-Body von POST /api/training-plans
 * @returns {{ value?: object, error?: string }} bereinigte Felder oder ein Fehlertext
 */
export function sanitizePlanPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Ungültiger Plan' };
  const clientId = cleanId(body.clientId);
  if (!clientId) return { error: 'clientId ist erforderlich' };
  const name = cleanLine(body.name, PLAN_LIMITS.maxName);
  if (!name) return { error: 'name ist erforderlich' };
  if (!Array.isArray(body.days) || !body.days.length) return { error: 'days muss mindestens einen Tag enthalten' };

  const seen = new Set();
  const days = [];
  for (const raw of body.days.slice(0, PLAN_LIMITS.maxDays)) {
    if (!raw || typeof raw !== 'object') continue;
    const id = cleanId(raw.id);
    const favoriteId = cleanId(raw.favoriteId);
    if (!id || !favoriteId || seen.has(id)) continue;
    seen.add(id);
    days.push({ id, label: cleanLine(raw.label, PLAN_LIMITS.maxLabel), favoriteId, lastDoneAt: cleanDate(raw.lastDoneAt) });
  }
  if (!days.length) return { error: 'days enthält keinen gültigen Tag' };

  const index = Number.parseInt(body.activeDayIndex, 10);
  return {
    value: {
      clientId,
      name,
      days,
      activeDayIndex: Number.isInteger(index) && index >= 0 && index < days.length ? index : 0,
      active: body.active === true
    }
  };
}

/** `existingCount` = Pläne des Nutzers OHNE den gerade zu schreibenden. */
export function isPlanLimitExceeded(existingCount) {
  return Number(existingCount || 0) >= PLAN_LIMITS.maxPlans;
}
