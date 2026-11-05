// KI-Kontingent für Gratis-Konten (Absprache Paul 05.11.): In den ersten Tagen nach der Registrierung gibt es ein
// Willkommenskontingent (Standard: 30 Anfragen in 30 Tagen), danach ein festes Monatskontingent (Standard: 10 pro
// Kalendermonat). Beide Töpfe werden getrennt gezählt: In der Willkommensphase zählt nur `welcomeCount`, danach
// `monthlyCount` im Kalendermonat. Dadurch bekommt niemand durch einen Monatswechsel doppelt Anfragen.
// Alle Werte kommen aus Umgebungsvariablen (Render), damit ein Wechsel keinen neuen Code braucht:
//   AI_WELCOME_LIMIT (30), AI_WELCOME_DAYS (30), FREE_AI_MONTHLY_LIMIT (10)
// Bezahlte Konten (pro/elite) sind unbegrenzt und werden hier nicht gezählt.
import { startOfMonth } from './workoutMetrics.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function readInt(value, fallback, { min = 0, max = 100000 } = {}) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function readAiQuotaConfig(env = process.env) {
  return {
    welcomeLimit: readInt(env.AI_WELCOME_LIMIT, 30),
    welcomeDays: readInt(env.AI_WELCOME_DAYS, 30, { max: 365 }),
    monthlyLimit: readInt(env.FREE_AI_MONTHLY_LIMIT, 10)
  };
}

function toDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function nextMonthStart(now) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

/**
 * Aktueller Stand des Kontingents eines Gratis-Kontos.
 * @param {object} profile - UserProfile (createdAt, aiUsage)
 * @returns {{ phase: 'welcome'|'monthly', count: number, limit: number, remaining: number, windowStart: Date|null,
 *   resetsAt: Date, welcomeEndsAt: Date|null, regularLimit: number }}
 */
export function getAiQuotaState(profile, { now = new Date(), config = readAiQuotaConfig() } = {}) {
  const created = toDate(profile?.createdAt);
  const welcomeEndsAt = created && config.welcomeDays > 0 && config.welcomeLimit > 0
    ? new Date(created.getTime() + config.welcomeDays * MS_PER_DAY)
    : null;

  if (welcomeEndsAt && now.getTime() < welcomeEndsAt.getTime()) {
    const count = Math.max(0, Number(profile?.aiUsage?.welcomeCount) || 0);
    return {
      phase: 'welcome',
      count,
      limit: config.welcomeLimit,
      remaining: Math.max(0, config.welcomeLimit - count),
      windowStart: null,
      // Ist der Topf leer, geht es erst mit dem Monatskontingent weiter.
      resetsAt: welcomeEndsAt,
      welcomeEndsAt,
      regularLimit: config.monthlyLimit
    };
  }

  const windowStart = startOfMonth(now);
  const saved = toDate(profile?.aiUsage?.monthWindowStart);
  const sameWindow = saved && startOfMonth(saved).getTime() === windowStart.getTime();
  const count = sameWindow ? Math.max(0, Number(profile?.aiUsage?.monthlyCount) || 0) : 0;
  return {
    phase: 'monthly',
    count,
    limit: config.monthlyLimit,
    remaining: Math.max(0, config.monthlyLimit - count),
    windowStart,
    resetsAt: nextMonthStart(now),
    welcomeEndsAt,
    regularLimit: config.monthlyLimit
  };
}

export function canUseAi(state) {
  return state.remaining > 0;
}

/** Neues `aiUsage`-Objekt nach einer verbrauchten Anfrage (nur den Topf der aktuellen Phase erhöhen). */
export function nextAiUsage(profile, state) {
  const current = profile?.aiUsage || {};
  if (state.phase === 'welcome') {
    return {
      monthWindowStart: current.monthWindowStart ?? null,
      monthlyCount: Math.max(0, Number(current.monthlyCount) || 0),
      welcomeCount: state.count + 1
    };
  }
  return {
    monthWindowStart: state.windowStart,
    monthlyCount: state.count + 1,
    welcomeCount: Math.max(0, Number(current.welcomeCount) || 0)
  };
}

/** Schnappschuss für die App (rückwärtskompatibel: monthly*-Felder beschreiben immer den aktuellen Topf). */
export function aiQuotaSnapshot(state, plan) {
  return {
    plan,
    phase: state.phase,
    monthWindowStart: state.windowStart,
    monthlyCount: state.count,
    monthlyLimit: state.limit,
    monthlyRemaining: state.remaining,
    resetsAt: state.resetsAt.toISOString(),
    welcomeEndsAt: state.welcomeEndsAt ? state.welcomeEndsAt.toISOString() : null,
    regularMonthlyLimit: state.regularLimit
  };
}
