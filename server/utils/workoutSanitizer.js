/**
 * Eingabe-Sanitierung für Workout-Requests.
 * Keine Datenbank- oder externe Abhängigkeiten.
 */

export function sanitizeWorkoutRequest(body) {
  const toNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  return {
    timeAvailable: toNumber(body.timeAvailable, 45),
    experienceLevel: typeof body.experienceLevel === 'string' ? body.experienceLevel : 'intermediate',
    intensity: toNumber(body.intensity, 3),
    focus: typeof body.focus === 'string' ? body.focus : 'push',
    recentWorkouts: Array.isArray(body.recentWorkouts) ? body.recentWorkouts.slice(0, 10) : null,
    injuries: body.injuries || null,
    mode: typeof body.mode === 'string' ? body.mode : undefined
  };
}

export function sanitizeQuickGeneratorRequest(body) {
  const clampNumber = (value, fallback, min, max) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  };

  const normalizeEnum = (value, allowed, fallback) => {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return allowed.includes(normalized) ? normalized : fallback;
  };

  const normalizeOptionalNumber = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  };

  const normalizeEquipmentAvailability = (value) => {
    const allowed = ['barbell', 'dumbbells', 'machines', 'cable_station', 'pull_up_bar', 'none'];
    if (!Array.isArray(value)) return [];
    return [...new Set(value
      .map((entry) => (typeof entry === 'string' ? entry.trim().toLowerCase() : ''))
      .filter((entry) => allowed.includes(entry)))];
  };

  return {
    durationMinutes: clampNumber(body.durationMinutes, 45, 20, 120),
    goal: normalizeEnum(body.goal, ['muscle_building', 'hypertrophy', 'strength'], 'muscle_building'),
    gender: normalizeEnum(body.gender, ['male', 'female', 'diverse'], 'male'),
    bodyweightKg: clampNumber(body.bodyweightKg, 80, 35, 250),
    level: normalizeEnum(body.level, ['beginner', 'intermediate', 'advanced'], 'beginner'),
    trainingFrequencyPerWeek: clampNumber(body.trainingFrequencyPerWeek, 3, 1, 14),
    equipmentMode: normalizeEnum(body.equipmentMode, ['gym_only', 'gym_plus_bodyweight', 'bodyweight_only'], 'gym_plus_bodyweight'),
    requestedType: normalizeEnum(body.requestedType, ['push', 'pull', 'legs', 'fullbody'], 'fullbody'),
    equipmentAvailability: normalizeEquipmentAvailability(body.equipmentAvailability),
    performance: {
      maxStrictPullups: normalizeOptionalNumber(body.maxStrictPullups),
      maxStrictDips: normalizeOptionalNumber(body.maxStrictDips),
      maxStrictPushups: normalizeOptionalNumber(body.maxStrictPushups),
      squat1RM: normalizeOptionalNumber(body.squat1RM),
      bench1RM: normalizeOptionalNumber(body.bench1RM),
      deadlift1RM: normalizeOptionalNumber(body.deadlift1RM),
      squat5RM: normalizeOptionalNumber(body.squat5RM),
      bench5RM: normalizeOptionalNumber(body.bench5RM),
      deadlift5RM: normalizeOptionalNumber(body.deadlift5RM)
    },
    injuries: typeof body.injuries === 'string' ? body.injuries.trim() : '',
    restrictions: typeof body.restrictions === 'string' ? body.restrictions.trim() : '',
    requireCompleteInput: body.requireCompleteInput === true
  };
}

export function getQuickGeneratorMissingInputs(rawBody = {}, context = {}) {
  const missing = [];
  if (!rawBody.goal) missing.push('goal');
  if (!rawBody.level) missing.push('level');
  if (!rawBody.requestedType) missing.push('requestedType');
  if (!rawBody.equipmentMode) missing.push('equipmentMode');
  if (!rawBody.durationMinutes) missing.push('durationMinutes');
  if (!rawBody.trainingFrequencyPerWeek && !context.trainingFrequencyPerWeek) missing.push('trainingFrequencyPerWeek');
  if (!Array.isArray(rawBody.equipmentAvailability) || rawBody.equipmentAvailability.length === 0) {
    missing.push('equipmentAvailability');
  }
  if (rawBody.maxStrictPullups === undefined || rawBody.maxStrictPullups === null || rawBody.maxStrictPullups === '') {
    missing.push('maxStrictPullups');
  }
  if (rawBody.maxStrictDips === undefined || rawBody.maxStrictDips === null || rawBody.maxStrictDips === '') {
    missing.push('maxStrictDips');
  }
  if (rawBody.maxStrictPushups === undefined || rawBody.maxStrictPushups === null || rawBody.maxStrictPushups === '') {
    missing.push('maxStrictPushups');
  }
  return missing;
}
