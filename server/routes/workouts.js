import express from "express";
import Workout from "../models/Workout.js";
import { firebaseAuthMiddleware } from '../middleware/firebaseAuth.js';
// Clerk-Import entfernt
import { OpenAI } from 'openai';
import exercises from '../data/exercises.js';
import Exercise from '../models/Exercise.js';
import UserProfile from '../models/UserProfile.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

const exerciseCatalog = Array.isArray(exercises) ? exercises : [];

const METADATA_NAME_KEYS = ['name', 'name_en'];

function normalizeLookupKey(value = '') {
  return String(value || '').trim().toLowerCase();
}

function normalizeCompactKey(value = '') {
  return normalizeLookupKey(value).replace(/[^a-z0-9äöüß]/g, '');
}

function buildExerciseMetadataLookup(source = []) {
  const map = new Map();
  source.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const metadata = entry?.aiMetadata && typeof entry.aiMetadata === 'object' ? entry.aiMetadata : null;
    if (!metadata) return;
    METADATA_NAME_KEYS.forEach((key) => {
      const normalized = normalizeLookupKey(entry[key]);
      if (normalized) map.set(normalized, metadata);
    });
  });
  return map;
}

const exerciseMetadataLookup = buildExerciseMetadataLookup(exerciseCatalog);
const exerciseMetadataCandidates = exerciseCatalog
  .filter((entry) => entry && typeof entry === 'object' && entry.aiMetadata)
  .flatMap((entry) => METADATA_NAME_KEYS
    .map((key) => normalizeLookupKey(entry[key]))
    .filter(Boolean)
    .map((key) => ({
      key,
      compactKey: normalizeCompactKey(key),
      metadata: entry.aiMetadata
    })));

function resolveExerciseMetadata(name = '') {
  const normalized = normalizeLookupKey(name);
  if (!normalized) return null;

  const exact = exerciseMetadataLookup.get(normalized);
  if (exact) return exact;

  const compact = normalizeCompactKey(normalized);
  if (!compact) return null;

  const compactExact = exerciseMetadataCandidates.find((candidate) => candidate.compactKey === compact);
  if (compactExact) return compactExact.metadata;

  // Toleriert leichte Abweichungen (Wortstellung/Sonderzeichen), ohne aggressiv falsch zuzuordnen.
  const fuzzy = exerciseMetadataCandidates.find((candidate) => (
    candidate.compactKey.length >= 8
    && compact.length >= 8
    && (candidate.compactKey.includes(compact) || compact.includes(candidate.compactKey))
  ));
  return fuzzy?.metadata || null;
}

// OpenAI Setup wird beim ersten API-Aufruf gemacht
let openai = null;
let openaiInitialized = false;

const aiFeatureConfig = {
  remoteEnabled: process.env.AI_REMOTE_ENABLED === 'true',
  requireAuth: process.env.AI_REQUIRE_AUTH !== 'false',
  allowTestUserRemote: process.env.AI_REMOTE_ALLOW_TEST === 'true',
  allowDemoFallback: process.env.AI_DEMO_FALLBACK !== 'false',
  betaUsers: (process.env.AI_REMOTE_BETA_USERS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
};

const aiAuthMiddleware = aiFeatureConfig.requireAuth ? firebaseAuthMiddleware : (req, _res, next) => next();

function canUseRemoteAI(userId = '') {
  if (!aiFeatureConfig.remoteEnabled) return false;
  if (!userId || userId === 'test_user') {
    return aiFeatureConfig.allowTestUserRemote;
  }
  if (!aiFeatureConfig.betaUsers.length) return true;
  return aiFeatureConfig.betaUsers.includes(userId);
}

// Exercise name mapping für AI-Responses
const exerciseNameMapping = {
  // Englisch -> Deutsch Mapping
  'push-ups': 'Liegestütze',
  'push ups': 'Liegestütze', 
  'pushups': 'Liegestütze',
  'bench press': 'Bankdrücken',
  'incline bench press': 'Schrägbankdrücken',
  'incline dumbbell press': 'Schrägbankdrücken',
  'overhead press': 'Schulterdrücken',
  'shoulder press': 'Schulterdrücken',
  'military press': 'Military Press',
  'dips': 'Dips',
  'tricep dips': 'Dips',
  'lateral raises': 'Seitheben',
  'side raises': 'Seitheben',
  'front raises': 'Frontheben',
  'tricep extensions': 'Overhead Trizepsdrücken',
  'tricep kickbacks': 'Trizeps-Kickbacks',
  'pull-ups': 'Klimmzüge',
  'pullups': 'Klimmzüge',
  'chin-ups': 'Klimmzüge',
  'lat pulldown': 'Latzug zur Brust',
  'rows': 'Rudern Langhantel',
  'barbell rows': 'Rudern Langhantel',
  'dumbbell rows': 'Kurzhantelrudern',
  'bicep curls': 'Kurzhantel Bizeps Curls',
  'hammer curls': 'Hammer Curls',
  'squats': 'Kniebeugen Langhantel',
  'back squats': 'Kniebeugen Langhantel',
  'front squats': 'Frontkniebeugen',
  'deadlifts': 'Kreuzheben konventionell',
  'romanian deadlifts': 'Rumänisches Kreuzheben',
  'lunges': 'Ausfallschritte Kurzhantel',
  'leg press': 'Beinpresse',
  'calf raises': 'Wadenheben stehend'
};

const DEFAULT_PROGRESS_RANGE_DAYS = 120;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const FREE_AI_WEEKLY_LIMIT = 1;
const muscleLabelMap = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  core: 'Core',
  cardio: 'Cardio'
};

function isPaidPlan(plan = 'free') {
  return plan === 'pro' || plan === 'elite';
}

async function getOrCreateUserProfile(uid) {
  if (!uid) return null;
  let profile = await UserProfile.findOne({ uid });
  if (profile) return profile;
  profile = await UserProfile.create({ uid });
  return profile;
}

async function getEntitlements(userId) {
  const profile = await getOrCreateUserProfile(userId);
  const plan = profile?.subscription?.plan || 'free';
  const paid = isPaidPlan(plan);
  return {
    profile,
    plan,
    paid,
    canUseAnalytics: paid,
    weeklyAiLimit: paid ? Number.POSITIVE_INFINITY : FREE_AI_WEEKLY_LIMIT
  };
}

function getCurrentAiWeekWindowStart() {
  return startOfIsoWeek(new Date());
}

function getAiWeekState(profile) {
  const nowWindow = getCurrentAiWeekWindowStart();
  const savedWindowRaw = profile?.aiUsage?.weekWindowStart;
  const savedWindow = savedWindowRaw ? startOfIsoWeek(savedWindowRaw) : null;
  if (!savedWindow || savedWindow.getTime() !== nowWindow.getTime()) {
    return { weekWindowStart: nowWindow, weeklyCount: 0 };
  }
  return {
    weekWindowStart: savedWindow,
    weeklyCount: Math.max(0, Number(profile?.aiUsage?.weeklyCount) || 0)
  };
}

function canUseAiThisWeek(entitlements) {
  if (!entitlements?.profile) return false;
  if (!Number.isFinite(entitlements.weeklyAiLimit)) return true;
  const usage = getAiWeekState(entitlements.profile);
  return usage.weeklyCount < entitlements.weeklyAiLimit;
}

async function markAiUse(entitlements) {
  if (!entitlements?.profile) return;
  if (!Number.isFinite(entitlements.weeklyAiLimit)) return;
  const usage = getAiWeekState(entitlements.profile);
  entitlements.profile.aiUsage = {
    weekWindowStart: usage.weekWindowStart,
    weeklyCount: usage.weeklyCount + 1
  };
  await entitlements.profile.save();
}

function getAiLimitSnapshot(entitlements) {
  if (!entitlements?.profile) return null;
  const usage = getAiWeekState(entitlements.profile);
  const limit = entitlements.weeklyAiLimit;
  const remaining = Number.isFinite(limit) ? Math.max(0, limit - usage.weeklyCount) : null;
  return {
    plan: entitlements.plan,
    weekWindowStart: usage.weekWindowStart,
    weeklyCount: usage.weeklyCount,
    weeklyLimit: Number.isFinite(limit) ? limit : null,
    weeklyRemaining: remaining
  };
}

function startOfIsoWeek(dateInput) {
  const date = new Date(dateInput);
  const isoDay = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - isoDay + 1);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function normalizeCategory(input, workoutType) {
  const source = (input || workoutType || 'push').toString().toLowerCase();
  if (source.includes('pull') || source.includes('rück') || source.includes('back')) return 'pull';
  if (source.includes('leg') || source.includes('bein')) return 'legs';
  if (source.includes('core') || source.includes('abs') || source.includes('bauch')) return 'core';
  if (source.includes('cardio')) return 'cardio';
  return 'push';
}

function calculateExerciseVolume(exercise) {
  if (!exercise) return 0;
  if (Array.isArray(exercise.setDetails) && exercise.setDetails.length) {
    return exercise.setDetails.reduce((sum, set) => {
      const reps = Number(set?.reps ?? exercise.reps ?? 0);
      const weight = Number(set?.weight ?? exercise.weight ?? 0);
      return sum + Math.max(0, reps) * Math.max(0, weight);
    }, 0);
  }
  const sets = Number(exercise.sets) || 1;
  const reps = Number(exercise.reps) || 0;
  const weight = Number(exercise.weight) || 0;
  return Math.max(0, sets) * Math.max(0, reps) * Math.max(0, weight);
}

function getExerciseBestWeight(exercise) {
  let best = Number(exercise?.weight) || 0;
  if (Array.isArray(exercise?.setDetails)) {
    exercise.setDetails.forEach((set) => {
      const current = Number(set?.weight) || 0;
      if (current > best) best = current;
    });
  }
  return best;
}

function computeWorkoutMetrics(workout) {
  const metrics = {
    volume: 0,
    bestLifts: [],
    muscleVolume: new Map()
  };

  if (!Array.isArray(workout?.exercises)) {
    return metrics;
  }

  workout.exercises.forEach((exercise) => {
    const exerciseVolume = calculateExerciseVolume(exercise);
    metrics.volume += exerciseVolume;

    const category = normalizeCategory(exercise?.category, workout?.type);
    metrics.muscleVolume.set(category, (metrics.muscleVolume.get(category) || 0) + exerciseVolume);

    const peakWeight = getExerciseBestWeight(exercise);
    if (peakWeight > 0 && exercise?.name) {
      metrics.bestLifts.push({
        name: exercise.name,
        weight: peakWeight,
        reps: Number(exercise.reps) || null
      });
    }
  });

  return metrics;
}

// 🎯 Automatische Übungs-Hinzufügung zur Datenbank
async function addNewExercisesToDatabase(exercises, source = 'ai_suggestion', userId = null) {
  const addedExercises = [];
  
  for (const exercise of exercises) {
    try {
      // Prüfe, ob Übung bereits existiert (nach deutschem oder englischem Namen)
      const existingExercise = await Exercise.findOne({
        $or: [
          { 'names.de': exercise.name },
          { 'names.en': exercise.name },
          { name: exercise.name }
        ]
      });

      if (!existingExercise) {
        // Bestimme deutsche und englische Namen
        let germanName = exercise.name;
        let englishName = exercise.name;
        
        // Wenn der Name in der Mapping-Tabelle existiert, nutze die Zuordnung
        const mappingEntry = Object.entries(exerciseNameMapping).find(([en, de]) => 
          en.toLowerCase() === exercise.name.toLowerCase() || 
          de.toLowerCase() === exercise.name.toLowerCase()
        );
        
        if (mappingEntry) {
          englishName = mappingEntry[0];
          germanName = mappingEntry[1];
        }
        
        // Bestimme Kategorie basierend auf muscleGroup
        let category = 'Push'; // Default
        if (exercise.muscleGroup) {
          const mg = exercise.muscleGroup.toLowerCase();
          if (mg.includes('back') || mg.includes('rücken') || mg.includes('bicep') || mg.includes('bizep')) {
            category = 'Pull';
          } else if (mg.includes('leg') || mg.includes('bein') || mg.includes('quad') || mg.includes('glute') || mg.includes('gesäß')) {
            category = 'Legs';
          } else if (mg.includes('core') || mg.includes('bauch') || mg.includes('abs')) {
            category = 'Core';
          } else if (mg.includes('cardio')) {
            category = 'Cardio';
          }
        }
        
        // Mappe Equipment
        let equipment = 'Körpergewicht'; // Default
        if (exercise.equipment) {
          const eq = exercise.equipment.toLowerCase();
          if (eq.includes('dumbbell') || eq.includes('hantel')) equipment = 'Kurzhanteln';
          else if (eq.includes('barbell') || eq.includes('langhantel')) equipment = 'Langhantel';
          else if (eq.includes('cable') || eq.includes('kabel')) equipment = 'Kabelzug';
          else if (eq.includes('machine') || eq.includes('maschine')) equipment = 'Maschine';
          else if (eq.includes('kettlebell')) equipment = 'Kettlebell';
          else if (eq.includes('band') || eq.includes('resistance')) equipment = 'Resistance Band';
        }

        // Erstelle neue Übung
        const newExercise = new Exercise({
          name: germanName, // Primary name ist deutsch
          names: {
            de: germanName,
            en: englishName
          },
          category: category,
          muscleGroups: exercise.muscleGroup ? [exercise.muscleGroup] : ['Brust'],
          equipment: equipment,
          difficulty: 'Anfänger', // Default für AI-Vorschläge
          instructions: exercise.instructions || '',
          tips: exercise.tips || '',
          source: source,
          addedBy: userId
        });

        await newExercise.save();
        addedExercises.push(newExercise);
        
        logger.debug(`✅ Neue Übung hinzugefügt: ${germanName} (${englishName})`);
      }
    } catch (error) {
      logger.error(`❌ Fehler beim Hinzufügen der Übung ${exercise.name}:`, error.message);
    }
  }
  
  return addedExercises;
}

// 🔄 Erweiterte Übungs-Validierung mit Auto-Add
async function validateAndMapExercisesWithAutoAdd(exercises, userId = null) {
  // OPTIMIZED: Batch-Query statt einzelner findOne() Calls
  const validatedExercises = [];
  const exerciseNames = exercises.map(ex => ex.name.toLowerCase().trim());
  
  try {
    // Hole ALLE Übungen in EINER Query (nicht einzeln!)
    const existingExercises = await Exercise.find({
      $or: [
        { name: { $in: exercises.map(ex => ex.name) } },
        { 'names.de': { $in: exercises.map(ex => ex.name) } },
        { 'names.en': { $in: exercises.map(ex => ex.name) } }
      ]
    }).select('_id name names.de names.en category').lean().exec();
    
    logger.debug(`📊 validateAndMapExercisesWithAutoAdd - Batch-Query: ${exercises.length} Übungen gesucht, ${existingExercises.length} gefunden`);
    
    // Erstelle Lookup-Map für schnelle Searches
    const exerciseMap = new Map();
    existingExercises.forEach(ex => {
      const key = (ex.name || '').toLowerCase().trim();
      if (key) exerciseMap.set(key, ex);
    });
    
    // Matching
    for (const exercise of exercises) {
      const key = (exercise.name || '').toLowerCase().trim();
      const match = exerciseMap.get(key);
      
      if (match) {
        validatedExercises.push({
          ...exercise,
          name: match.names?.de || match.name,
          _id: match._id,
          found: true
        });
      }
    }
    
    logger.debug(`✅ validateAndMapExercisesWithAutoAdd - ${validatedExercises.length}/${exercises.length} Übungen gematcht`);
    
  } catch (error) {
    logger.error('⚠️ validateAndMapExercisesWithAutoAdd - Batch-Query Error:', error.message);
    // Fallback: Nutze Eingaben as-is
    validatedExercises.push(...exercises);
  }
  
  return validatedExercises;
}

async function initializeOpenAI() {
  if (openaiInitialized) return openai;
  
  openaiInitialized = true;
  
  if (process.env.OPENAI_API_KEY) {
    try {
      const OpenAI = (await import('openai')).default;
      openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      logger.debug('✅ OpenAI initialized successfully');
      return openai;
    } catch (error) {
      logger.warn('⚠️ OpenAI initialization failed:', error.message);
      return null;
    }
  } else {
    logger.debug('ℹ️ No OpenAI API key found - using demo mode');
    return null;
  }
}

function sanitizeWorkoutRequest(body) {
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

function sanitizeQuickGeneratorRequest(body) {
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

function getQuickGeneratorMissingInputs(rawBody = {}, context = {}) {
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

// Alle Workouts für den eingeloggten User holen
router.get("/", firebaseAuthMiddleware, async (req, res) => {
  try {
    const { userId } = req.auth;
    const workouts = await Workout.find({ userId })
      .sort({ date: -1 }); // Neueste zuerst
    res.json(workouts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/stats/progress", firebaseAuthMiddleware, async (req, res) => {
  try {
    const { userId } = req.auth;
    const entitlements = await getEntitlements(userId);
    if (!entitlements.canUseAnalytics) {
      return res.status(403).json({
        error: 'Progress analysis requires Pro subscription',
        code: 'ANALYTICS_REQUIRES_PRO',
        entitlement: { plan: entitlements.plan }
      });
    }
    const rangeDays = Math.min(
      365,
      Math.max(30, Number(req.query.rangeDays) || DEFAULT_PROGRESS_RANGE_DAYS)
    );
    const fromDate = new Date(Date.now() - rangeDays * MS_PER_DAY);

    const workouts = await Workout.find({
      userId,
      date: { $gte: fromDate }
    }).sort({ date: 1 }).lean();

    const weeksMap = new Map();
    const liftRecords = new Map();
    const muscleMap = new Map();
    let totalVolume = 0;

    workouts.forEach((workout) => {
      const metrics = computeWorkoutMetrics(workout);
      totalVolume += metrics.volume;

      const weekStart = startOfIsoWeek(workout.date);
      const weekKey = weekStart.toISOString();
      const existingWeek = weeksMap.get(weekKey) || {
        weekStart: weekKey,
        sessionCount: 0,
        totalVolume: 0
      };
      existingWeek.sessionCount += 1;
      existingWeek.totalVolume += metrics.volume;
      weeksMap.set(weekKey, existingWeek);

      metrics.bestLifts.forEach((lift) => {
        const existing = liftRecords.get(lift.name);
        if (!existing || lift.weight > existing.weight) {
          liftRecords.set(lift.name, {
            ...lift,
            date: workout.date
          });
        }
      });

      metrics.muscleVolume.forEach((value, key) => {
        muscleMap.set(key, (muscleMap.get(key) || 0) + value);
      });
    });

    const weeks = Array.from(weeksMap.values())
      .sort((a, b) => new Date(a.weekStart) - new Date(b.weekStart))
      .map((week) => ({
        ...week,
        totalVolume: Math.round(week.totalVolume),
        avgIntensity: week.sessionCount ? Math.round(week.totalVolume / week.sessionCount) : 0
      }));

    const totalWeeks = weeks.length || 1;
    const avgWeeklyVolume = totalWeeks ? Math.round(totalVolume / totalWeeks) : 0;
    const avgSessionsPerWeek = totalWeeks ? Number((workouts.length / totalWeeks).toFixed(2)) : 0;
    const consistencyScore = totalWeeks
      ? Math.round((weeks.filter((week) => week.sessionCount >= 2).length / totalWeeks) * 100)
      : 0;

    const topLifts = Array.from(liftRecords.values())
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5);

    const muscleBreakdown = Array.from(muscleMap.entries())
      .map(([key, value]) => ({
        key,
        label: muscleLabelMap[key] || key,
        volume: Math.round(value)
      }))
      .sort((a, b) => b.volume - a.volume);

    res.json({
      range: {
        start: fromDate,
        end: new Date()
      },
      kpis: {
        sessions: workouts.length,
        totalVolume: Math.round(totalVolume),
        avgWeeklyVolume,
        avgSessionsPerWeek,
        consistencyScore
      },
      weeks,
      topLifts,
      muscleBreakdown
    });
  } catch (err) {
    logger.error('progress stats error', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/quick-generator', aiAuthMiddleware, async (req, res) => {
  const requestId = `quick_gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    const userId = req.auth?.userId || 'test_user';
    const entitlements = await getEntitlements(userId);
    const rawBody = req.body || {};
    const context = sanitizeQuickGeneratorRequest(rawBody);
    const missingRequiredInputs = getQuickGeneratorMissingInputs(rawBody, context);

    if (context.requireCompleteInput && missingRequiredInputs.length > 0) {
      return res.status(422).json({
        error: 'Missing required input for professional workout generation',
        code: 'WORKOUT_INPUT_INCOMPLETE',
        missingRequiredInputs
      });
    }

    const openaiClient = await initializeOpenAI();
    const aiAllowedForUser = canUseAiThisWeek(entitlements);

    let suggestion = null;
    if (openaiClient && aiAllowedForUser) {
      try {
        suggestion = await generateQuickGeneratorWithOpenAI(context, openaiClient);
        if (suggestion) {
          await markAiUse(entitlements);
        }
      } catch (error) {
        logger.error('❌ Quick generator OpenAI error', { requestId, message: error?.message });
      }
    }

    if (!suggestion) {
      suggestion = generateQuickGeneratorDemo(context);
    }

    const normalized = normalizeQuickGeneratorResponse(suggestion, context);
    normalized.metadata = {
      ...(normalized.metadata || {}),
      aiUsage: getAiLimitSnapshot(entitlements),
      generationMode: suggestion?.metadata?.mode || (aiAllowedForUser ? 'auto' : 'demo_quota_limited'),
      missingRequiredInputs,
      ruleset: {
        professionalMode: true,
        strictStructure: true,
        performanceFiltersApplied: true,
        timeAdaptationApplied: true
      }
    };
    return res.json(normalized);
  } catch (error) {
    logger.error('❌ Quick generator route error', { requestId, message: error?.message });
    return res.status(500).json({
      workoutName: 'Quick Workout',
      exercises: [],
      estimatedDuration: 45,
      difficulty: 'beginner',
      notes: 'Generierung fehlgeschlagen.'
    });
  }
});

router.get("/stats/overview", firebaseAuthMiddleware, async (req, res) => {
  try {
    const { userId } = req.auth;
    const totalWorkouts = await Workout.countDocuments({ userId });

    const totalDuration = await Workout.aggregate([
      { $match: { userId } },
      { $group: { _id: null, total: { $sum: "$duration" } } }
    ]);

    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);

    const recentWorkouts = await Workout.countDocuments({
      userId,
      date: { $gte: lastWeek }
    });

    res.json({
      totalWorkouts,
      totalDuration: totalDuration[0]?.total || 0,
      recentWorkouts
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Einzelnes Workout anhand ID holen
router.get("/:id", firebaseAuthMiddleware, async (req, res) => {
  try {
    const { userId } = req.auth;
    const workout = await Workout.findOne({ 
      _id: req.params.id, 
      userId 
    });
    
    if (!workout) {
      return res.status(404).json({ error: "Workout nicht gefunden" });
    }
    
    res.json(workout);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Neues Workout anlegen
router.post("/", firebaseAuthMiddleware, async (req, res) => {
  const requestId = `save_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  try {
    const { userId } = req.auth;
    const readyState = (await import('mongoose')).default.connection?.readyState;
    const beforeCount = await Workout.countDocuments({ userId });
    // TEMP LOGGING: Request-Body und userId
    logger.info("[POST /api/workouts] incoming", {
      requestId,
      userId,
      readyState,
      beforeCount,
      type: req.body?.type,
      name: req.body?.name,
      exercises: Array.isArray(req.body?.exercises) ? req.body.exercises.length : 0
    });
    // Debug: Logge die Notizen der Übungen, falls vorhanden
    if (Array.isArray(req.body.exercises)) {
      console.log('📝 Notizen der Übungen beim POST /workouts:');
      req.body.exercises.forEach((ex, idx) => {
        if (ex.note) {
          console.log(`  Übung ${idx + 1}: ${ex.name || ''} | Notiz: ${ex.note}`);
        }
      });
    }
    const workout = await Workout.create({
      ...req.body,
      userId
    });
    const afterCount = await Workout.countDocuments({ userId });
    logger.info("[POST /api/workouts] saved", {
      requestId,
      workoutId: workout?._id,
      userId,
      beforeCount,
      afterCount
    });
    res.status(201).json(workout);
  } catch (err) {
    logger.error("[POST /api/workouts] Fehler beim Speichern", {
      requestId,
      message: err?.message,
      stack: err?.stack
    });
    res.status(400).json({ error: err.message });
  }
});

// Workout aktualisieren
router.put("/:id", firebaseAuthMiddleware, async (req, res) => {
  try {
    const { userId } = req.auth;
    const workout = await Workout.findOneAndUpdate(
      { _id: req.params.id, userId },
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!workout) {
      return res.status(404).json({ error: "Workout nicht gefunden" });
    }
    
    res.json(workout);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Workout löschen
router.delete("/:id", firebaseAuthMiddleware, async (req, res) => {
  try {
    const { userId } = req.auth;
    const workout = await Workout.findOneAndDelete({ 
      _id: req.params.id, 
      userId 
    });
    
    if (!workout) {
      return res.status(404).json({ error: "Workout nicht gefunden" });
    }
    
    res.json({ message: "Workout erfolgreich gelöscht", workout });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ALLE Workouts des Users aus MongoDB löschen (Danger Zone)
router.delete("/", firebaseAuthMiddleware, async (req, res) => {
  try {
    const { userId } = req.auth;
    
    // Defensive: Falls keine DB-Verbindung besteht, nicht mit 500 antworten
    const readyState = req?.mongoose?.connection?.readyState ?? (await import('mongoose')).default.connection?.readyState;
    // 1 = connected
    if (readyState !== 1) {
      logger.warn('🟠 Keine aktive MongoDB-Verbindung – überspringe Löschung', { readyState });
      return res.json({
        message: "DB derzeit nicht verbunden – keine Workouts gelöscht",
        deletedCount: 0,
        userId
      });
    }

    // Zähle Workouts vor dem Löschen
    const count = await Workout.countDocuments({ userId });
    
    // Lösche alle Workouts des Users
    const result = await Workout.deleteMany({ userId });
    
    logger.debug(`🗑️ Gelöscht: ${result.deletedCount} Workouts für User ${userId}`);
    
    res.json({ 
      message: "Alle Workouts erfolgreich gelöscht",
      deletedCount: result.deletedCount,
      userId 
    });
  } catch (err) {
    logger.error('❌ Fehler beim Löschen aller Workouts:', err);
    res.status(500).json({ error: err.message });
  }
});

// � TEST ROUTE - AI Demo ohne Auth (nur für Testing)
router.post("/ai-demo", async (req, res) => {
  try {
    logger.debug('🧪 AI Demo requested:', req.body);
    
    // Einfache Demo-Response ohne Datenbank-Operationen
    const demoResponse = {
      workoutName: "Demo Push Workout",
      exercises: [
        { name: "Bankdrücken", sets: 4, reps: 8, weight: 0, rest: 120 },
        { name: "Liegestütze", sets: 3, reps: 10, weight: 0, rest: 90 },
        { name: "Schulterdrücken", sets: 3, reps: 12, weight: 0, rest: 90 },
        { name: "Dips", sets: 3, reps: 8, weight: 0, rest: 90 },
        { name: "Seitheben", sets: 3, reps: 15, weight: 0, rest: 60 }
      ],
      estimatedDuration: 45,
      difficulty: "intermediate",
      metadata: {
        source: 'demo_test',
        recommendationId: `demo_test_${Date.now()}`,
        requestedAt: new Date().toISOString(),
        confidence: 0,
        isDemoData: true
      }
    };
    
    res.json(demoResponse);
  } catch (err) {
    logger.error('❌ AI Demo Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 🤖 AI WORKOUT SUGGESTION (Feature-Flag gesteuert)
router.post("/ai-suggestion", aiAuthMiddleware, async (req, res) => {
  const requestId = `ai_req_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  res.set('X-AI-Request-Id', requestId);

  try {
    const userId = req.auth?.userId || 'test_user';
    const entitlements = await getEntitlements(userId);
    const context = sanitizeWorkoutRequest(req.body || {});
    const requestedMode = (context.mode || req.header('x-ai-mode') || 'auto').toLowerCase();
    delete context.mode;

    const forceDemo = requestedMode === 'demo';
    const aiAllowedForUser = canUseAiThisWeek(entitlements);
    const tryRemote = !forceDemo && aiAllowedForUser && canUseRemoteAI(userId);

    logger.debug('🤖 AI Suggestion requested', {
      requestId,
      userId,
      requestedMode,
      tryRemote
    });

    let responsePayload = null;
    let modeUsed = 'demo';

    if (tryRemote) {
      const openaiClient = await initializeOpenAI();
      if (openaiClient) {
        try {
          const aiSuggestion = await generateGPT4Suggestion(context, openaiClient);

          if (aiSuggestion.exercises?.length > 0) {
            const exerciseNames = aiSuggestion.exercises.map(ex => ex.name);
            const dbExercises = await Exercise.find({ name: { $in: exerciseNames } }).lean();
            const nameToId = {};
            dbExercises.forEach(ex => { nameToId[ex.name] = ex._id; });

            aiSuggestion.exercises = aiSuggestion.exercises.map(ex => ({
              ...ex,
              _id: nameToId[ex.name] || `temp_${Math.random()}`
            }));
          }

          aiSuggestion.metadata = {
            source: 'openai_gpt4',
            recommendationId: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            requestedAt: new Date().toISOString(),
            userId,
            confidence: aiSuggestion.metadata?.confidence || 85,
            exercisesValidated: true,
            mode: 'remote'
          };

          responsePayload = aiSuggestion;
          modeUsed = 'remote';
          await markAiUse(entitlements);
        } catch (aiError) {
          logger.error('❌ OpenAI Error:', { requestId, message: aiError.message });
        }
      } else {
        logger.debug('ℹ️ Remote AI nicht aktiv/kein API-Key', { requestId });
      }
    }

    if (!responsePayload) {
      if (!aiFeatureConfig.allowDemoFallback && tryRemote) {
        return res.status(503).json({
          error: 'AI temporarily unavailable',
          requestId
        });
      }

      const demoSuggestion = await generateDemoSuggestion(context);
      
      if (demoSuggestion.exercises?.length > 0) {
        const exerciseNames = demoSuggestion.exercises.map(ex => ex.name);
        const dbExercises = await Exercise.find({ name: { $in: exerciseNames } }).lean();
        const nameToId = {};
        dbExercises.forEach(ex => { nameToId[ex.name] = ex._id; });
        demoSuggestion.exercises = demoSuggestion.exercises.map(ex => ({
          ...ex,
          _id: nameToId[ex.name] || `temp_${Math.random()}`
        }));
      }

      demoSuggestion.metadata = {
        source: tryRemote ? 'fallback_after_ai_error' : 'demo_no_api_key',
        recommendationId: `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        requestedAt: new Date().toISOString(),
        userId,
        confidence: 0,
        isDemoData: true,
        exercisesValidated: true,
        mode: 'demo'
      };

      responsePayload = demoSuggestion;
      modeUsed = 'demo';
    }

    responsePayload = enforceWorkoutProgrammingRules(
      responsePayload,
      {
        requestedType: context.focus,
        focus: context.focus,
        goal: Number(context.intensity) >= 4 ? 'strength' : 'muscle_building',
        intensity: context.intensity,
        timeAvailable: context.timeAvailable
      },
      { source: 'ai-suggestion' }
    );

    responsePayload.metadata = {
      ...(responsePayload.metadata || {}),
      aiUsage: getAiLimitSnapshot(entitlements),
      quotaLimited: !aiAllowedForUser && !isPaidPlan(entitlements.plan)
    };

    logger.debug('✅ AI Suggestion fulfilled', {
      requestId,
      modeUsed,
      exercises: responsePayload.exercises?.length || 0
    });

    res.json(responsePayload);

  } catch (err) {
    logger.error('❌ AI Suggestion Route Error:', { requestId, message: err.message });
    res.status(500).json({ 
      error: 'Interner Server-Fehler',
      message: err.message,
      requestId
    });
  }
});

// 📊 AI FEEDBACK sammeln (Vereinfacht)
router.post("/ai-feedback", firebaseAuthMiddleware, async (req, res) => {
  try {
    const { recommendationId, rating, used, completed, difficulty, comments, injury } = req.body;
    const { userId } = req.auth;
    
    // Feedback loggen (in Production: in DB speichern)
    const feedbackData = {
      recommendationId,
      userId,
      rating,
      used,
      completed,
      difficulty,
      comments,
      injury: injury || false,
      timestamp: new Date().toISOString()
    };

    logger.debug('📝 AI Feedback received:', feedbackData);

    // Bei Verletzung extra Warnung
    if (injury) {
      logger.error('🚨 INJURY REPORTED:', {
        recommendationId,
        userId,
        timestamp: feedbackData.timestamp
      });
    }

    res.json({ 
      message: "Feedback erfolgreich gespeichert",
      feedbackId: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });

  } catch (err) {
    logger.error('❌ AI Feedback Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 🔍 AI QUALITY MONITORING (Vereinfacht)
router.get("/ai-quality", firebaseAuthMiddleware, async (req, res) => {
  try {
    // Einfacher Status-Report
    const qualityReport = {
      openaiAvailable: !!openai,
      apiKeyConfigured: !!process.env.OPENAI_API_KEY,
      timestamp: new Date().toISOString(),
      status: openai ? 'operational' : 'demo_mode'
    };

    res.json(qualityReport);

  } catch (err) {
    logger.error('❌ AI Quality Report Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Helper Functions
async function generateGPT4Suggestion(workoutContext, openaiClient) {
  if (!openaiClient) {
    throw new Error('OpenAI Client nicht verfügbar');
  }

  const prompt = createWorkoutPrompt(workoutContext);
  
  const completion = await openaiClient.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Du bist ein erfahrener Fitness-Coach. Erstelle sichere, personalisierte Workout-Empfehlungen. 
        
        WICHTIGE SICHERHEITSREGELN:
        - Nie mehr als 6 Übungen pro Session
        - Sets: 1-6, Reps: 1-20
        - Immer Aufwärmen empfehlen
        - Bei Anfängern konservativ bleiben
        - Keine extremen Versprechungen
        
        ÜBUNGSNAMEN: Verwende AUSSCHLIESSLICH deutsche Übungsnamen aus dieser Liste:
        - Bankdrücken, Schrägbankdrücken, Kurzhantel Bankdrücken
        - Liegestütze, Dips 
        - Schulterdrücken, Military Press, Kurzhantel-Schulterdrücken
        - Seitheben, Frontheben
        - Trizeps-Kickbacks, Overhead Trizepsdrücken, Trizeps Bankdrücken
        - Klimmzüge, Latzug zur Brust
        - Rudern Langhantel, Kurzhantelrudern, Rudern Kabelzug
        - Bizeps Curls Langhantel, Kurzhantel Bizeps Curls, Hammer Curls
        - Kniebeugen Langhantel, Frontkniebeugen, Beinpresse
        - Kreuzheben konventionell, Rumänisches Kreuzheben
        - Ausfallschritte Kurzhantel, Bulgarian Split Squats
        - Wadenheben stehend, Wadenheben sitzend
        
        Antworte IMMER im JSON Format mit dieser Struktur:
        {
          "workoutName": "Name",
          "exercises": [{"name": "...", "sets": 3, "reps": 12, "weight": 0, "rest": 60}],
          "estimatedDuration": 45,
          "difficulty": "beginner|intermediate|advanced",
          "notes": "Wichtige Hinweise"
        }`
      },
      {
        role: "user", 
        content: prompt
      }
    ],
    max_tokens: 1000,
    temperature: 0.8,
    timeout: 15000
  });

  const response = completion.choices[0].message.content;
  return JSON.parse(response);
}

async function generateQuickGeneratorWithOpenAI(context, openaiClient) {
  const prompt = createQuickGeneratorPrompt(context);

  const completion = await openaiClient.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Erzeuge genau 1 Workout aus den gelieferten Parametern, zustandslos, ohne Historie, ohne Coaching-Stil.
Nur JSON, kein Markdown, keine Zusatzschlüssel, keine Erklärtexte, kein Motivations-Text.
      Regeln (streng):
      - requestedType strikt einhalten (push|pull|legs|fullbody), kein Mix außerhalb des Splits.
      - Reihenfolge strikt: Main Compound -> Secondary Compound -> Accessory -> optional Core/Finisher.
      - Keine doppelte Hauptbewegung direkt hintereinander.
      - 5-6 Übungen insgesamt, maximal 1 Core-Übung und nicht an Position 1.
      - Für strength: Hauptübungen 3-6 Reps, längere Pausen; für hypertrophy: 6-12 Reps, moderate Pausen.
      - equipmentMode strikt beachten (gym_only, gym_plus_bodyweight, bodyweight_only).
Schema exakt:
{"workoutName":"string","exercises":[{"name":"string","sets":3,"reps":10,"weight":0,"rest":90}],"estimatedDuration":45,"difficulty":"beginner|advanced","notes":"string"}
Fallback auf sinnvolle Standardwerte bei fehlenden Parametern.`
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.2,
    max_tokens: 360,
    timeout: 15000,
    response_format: { type: 'json_object' }
  });

  const raw = completion?.choices?.[0]?.message?.content || '{}';
  return JSON.parse(raw);
}

function createQuickGeneratorPrompt(context) {
  return [
    `durationMinutes=${context.durationMinutes}`,
    `goal=${context.goal}`,
    `gender=${context.gender}`,
    `bodyweightKg=${context.bodyweightKg}`,
    `level=${context.level}`,
    `trainingFrequencyPerWeek=${context.trainingFrequencyPerWeek}`,
    `equipmentMode=${context.equipmentMode}`,
    `equipmentAvailability=${(context.equipmentAvailability || []).join(',') || 'not_provided'}`,
    `requestedType=${context.requestedType}`,
    `maxStrictPullups=${context.performance?.maxStrictPullups ?? 'unknown'}`,
    `maxStrictDips=${context.performance?.maxStrictDips ?? 'unknown'}`,
    `maxStrictPushups=${context.performance?.maxStrictPushups ?? 'unknown'}`,
    `squat1RM=${context.performance?.squat1RM ?? 'unknown'}`,
    `bench1RM=${context.performance?.bench1RM ?? 'unknown'}`,
    `deadlift1RM=${context.performance?.deadlift1RM ?? 'unknown'}`,
    `injuries=${context.injuries || 'none'}`,
    `restrictions=${context.restrictions || 'none'}`,
    'constraint=professional_sc_programming_no_random_mixing'
  ].join('; ');
}

function normalizeRequestedType(type) {
  const normalized = typeof type === 'string' ? type.trim().toLowerCase() : '';
  return ['push', 'pull', 'legs', 'fullbody'].includes(normalized) ? normalized : 'fullbody';
}

function normalizeGoal(goal) {
  const normalized = String(goal || '').toLowerCase();
  if (normalized.includes('strength')) return 'strength';
  return 'hypertrophy';
}

function normalizeEquipmentMode(mode) {
  const normalized = String(mode || '').toLowerCase();
  if (normalized === 'gym_only' || normalized === 'gym_plus_bodyweight' || normalized === 'bodyweight_only') {
    return normalized;
  }
  return 'gym_plus_bodyweight';
}

const WORKOUT_BLUEPRINTS = {
  push: {
    hypertrophy: {
      gym_only: ['Bankdrücken', 'Schulterdrücken', 'Schrägbankdrücken', 'Dips', 'Seitheben'],
      gym_plus_bodyweight: ['Kurzhantel Bankdrücken', 'Schulterdrücken', 'Liegestütze', 'Dips', 'Seitheben'],
      bodyweight_only: ['Liegestütze', 'Pike Push-Ups', 'Dips', 'Enge Liegestütze', 'Plank']
    },
    strength: {
      gym_only: ['Bankdrücken', 'Schulterdrücken', 'Schrägbankdrücken', 'Dips'],
      gym_plus_bodyweight: ['Bankdrücken', 'Schulterdrücken', 'Dips', 'Liegestütze'],
      bodyweight_only: ['Dips', 'Liegestütze', 'Pike Push-Ups', 'Enge Liegestütze']
    }
  },
  pull: {
    hypertrophy: {
      gym_only: ['Rudern Langhantel', 'Latzug zur Brust', 'Kurzhantelrudern', 'Face Pulls', 'Kurzhantel Bizeps Curls'],
      gym_plus_bodyweight: ['Klimmzüge', 'Rudern Kabelzug', 'Kurzhantelrudern', 'Face Pulls', 'Hammer Curls'],
      bodyweight_only: ['Klimmzüge', 'Inverted Rows', 'Superman Hold', 'Reverse Snow Angels', 'Dead Bug']
    },
    strength: {
      gym_only: ['Rudern Langhantel', 'Klimmzüge', 'Latzug zur Brust', 'Kurzhantelrudern'],
      gym_plus_bodyweight: ['Klimmzüge', 'Rudern Langhantel', 'Rudern Kabelzug', 'Kurzhantelrudern'],
      bodyweight_only: ['Klimmzüge', 'Inverted Rows', 'Superman Hold', 'Dead Bug']
    }
  },
  legs: {
    hypertrophy: {
      gym_only: ['Kniebeugen Langhantel', 'Rumänisches Kreuzheben', 'Ausfallschritte Kurzhantel', 'Beinpresse', 'Wadenheben stehend'],
      gym_plus_bodyweight: ['Kniebeugen Langhantel', 'Rumänisches Kreuzheben', 'Bulgarian Split Squats', 'Ausfallschritte Kurzhantel', 'Wadenheben stehend'],
      bodyweight_only: ['Kniebeugen', 'Bulgarian Split Squats', 'Ausfallschritte', 'Glute Bridge', 'Wadenheben stehend']
    },
    strength: {
      gym_only: ['Kniebeugen Langhantel', 'Rumänisches Kreuzheben', 'Bulgarian Split Squats', 'Beinpresse'],
      gym_plus_bodyweight: ['Kniebeugen Langhantel', 'Rumänisches Kreuzheben', 'Bulgarian Split Squats', 'Ausfallschritte Kurzhantel'],
      bodyweight_only: ['Bulgarian Split Squats', 'Kniebeugen', 'Ausfallschritte', 'Glute Bridge']
    }
  },
  fullbody: {
    hypertrophy: {
      gym_only: ['Kniebeugen Langhantel', 'Kurzhantel Bankdrücken', 'Rudern Kabelzug', 'Rumänisches Kreuzheben', 'Plank'],
      gym_plus_bodyweight: ['Kniebeugen Langhantel', 'Liegestütze', 'Klimmzüge', 'Ausfallschritte Kurzhantel', 'Plank'],
      bodyweight_only: ['Kniebeugen', 'Liegestütze', 'Inverted Rows', 'Ausfallschritte', 'Plank']
    },
    strength: {
      gym_only: ['Kniebeugen Langhantel', 'Bankdrücken', 'Rudern Langhantel', 'Rumänisches Kreuzheben'],
      gym_plus_bodyweight: ['Kniebeugen Langhantel', 'Bankdrücken', 'Klimmzüge', 'Rumänisches Kreuzheben'],
      bodyweight_only: ['Bulgarian Split Squats', 'Liegestütze', 'Klimmzüge', 'Ausfallschritte']
    }
  }
};

function inferExerciseType(name = '') {
  const normalized = String(name).toLowerCase();

  const pushTerms = ['bank', 'drücken', 'liegestütz', 'dips', 'trizeps', 'seitheben', 'frontheben', 'press', 'push-up', 'push up', 'pushup'];
  const pullTerms = ['rudern', 'klimm', 'latzug', 'bizeps', 'face pull', 'curl', 'shrug', 'pull', 'row'];
  const legTerms = ['kniebeuge', 'bein', 'ausfallschritt', 'waden', 'squat', 'deadlift', 'kreuzheben', 'hip thrust', 'lunge', 'glute'];

  if (pushTerms.some((term) => normalized.includes(term))) return 'push';
  if (pullTerms.some((term) => normalized.includes(term))) return 'pull';
  if (legTerms.some((term) => normalized.includes(term))) return 'legs';
  return 'fullbody';
}

function inferMovementPattern(name = '') {
  const normalized = String(name).toLowerCase();
  if (normalized.includes('bank') || normalized.includes('liegestütz') || normalized.includes('push-up')) return 'horizontal_push';
  if (normalized.includes('schulterdr') || normalized.includes('military press') || normalized.includes('overhead')) return 'vertical_push';
  if (normalized.includes('rudern') || normalized.includes('row') || normalized.includes('face pull')) return 'horizontal_pull';
  if (normalized.includes('latzug') || normalized.includes('klimmzug') || normalized.includes('pull-up')) return 'vertical_pull';
  if (normalized.includes('kniebeuge') || normalized.includes('beinpresse') || normalized.includes('split squat') || normalized.includes('ausfallschritt')) return 'squat';
  if (normalized.includes('kreuzheben') || normalized.includes('deadlift') || normalized.includes('hip thrust') || normalized.includes('good morning')) return 'hinge';
  if (normalized.includes('plank') || normalized.includes('core') || normalized.includes('bauch') || normalized.includes('abs')) return 'core';
  return 'other';
}

function isIsolationExercise(name = '') {
  const normalized = String(name).toLowerCase();
  const isolationTerms = ['curl', 'heben', 'kickback', 'trizeps', 'bizeps', 'waden', 'fly', 'flys', 'extension', 'beinstrecker', 'beincurls'];
  return isolationTerms.some((term) => normalized.includes(term));
}

function inferDemandTier(name = '') {
  const pattern = inferMovementPattern(name);
  if (['squat', 'hinge', 'horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull'].includes(pattern) && !isIsolationExercise(name)) {
    return 'high';
  }
  if (pattern === 'core') return 'low';
  return isIsolationExercise(name) ? 'low' : 'medium';
}

function isMobilityOrWarmupExercise(name = '') {
  const normalized = String(name).toLowerCase();
  const blockedTerms = [
    'warm-up',
    'warm up',
    'warmup',
    'cooldown',
    'mobility',
    'beweglichkeit',
    'stretch',
    'stretching',
    'streck',
    'dehnen',
    'dehnung',
    'dehn',
    'activation',
    'aktivierung',
    'foam roll',
    'yoga',
    'cat cow'
  ];
  return blockedTerms.some((term) => normalized.includes(term));
}

function isMachineHeavyExercise(name = '') {
  const normalized = String(name).toLowerCase();
  return [
    'maschine',
    'machine',
    'beinpresse',
    'kabelzug',
    'latzug',
    'smith'
  ].some((term) => normalized.includes(term));
}

function isExternalLoadExercise(name = '') {
  const normalized = String(name).toLowerCase();
  return [
    'langhantel',
    'barbell',
    'kurzhantel',
    'dumbbell',
    'kettlebell'
  ].some((term) => normalized.includes(term));
}

function isAdvancedSkillExercise(name = '') {
  const normalized = String(name).toLowerCase();
  return [
    'muscle-up',
    'planche',
    'pistol squat',
    'handstand'
  ].some((term) => normalized.includes(term));
}

function getExerciseRole(exercise = {}) {
  if (exercise.exerciseType === 'core') return 'core';
  if (exercise.exerciseType === 'compound') return 'main_compound';
  if (exercise.exerciseType === 'isolation') return 'accessory';
  const movementPattern = exercise.movementPattern || inferMovementPattern(exercise.name);
  if (movementPattern === 'core') return 'core';
  if (!exercise.isIsolation && exercise.demandTier === 'high') return 'main_compound';
  if (!exercise.isIsolation) return 'secondary_compound';
  return 'accessory';
}

function applyHardExerciseFilters(exercises = [], context = {}) {
  const goal = normalizeGoal(context.goal);
  const requestedType = normalizeRequestedType(context.requestedType || context.focus);
  const equipmentMode = normalizeEquipmentMode(context.equipmentMode);
  const level = String(context.level || context.experienceLevel || 'beginner').toLowerCase();

  return exercises.filter((exercise) => {
    const name = String(exercise.name || '').trim();
    if (!name) return false;

    if (isMobilityOrWarmupExercise(name)) return false;
    if (requestedType !== 'fullbody' && !matchesRequestedType(name, requestedType)) return false;

    if (exercise.exerciseType === 'mobility' || exercise.primaryPhase === 'warmup') {
      return false;
    }

    if (exercise.disallowedGoals.includes(goal)) {
      return false;
    }

    if ((goal === 'strength' || goal === 'hypertrophy') && isAssistedVariation(name)) {
      return false;
    }

    if (equipmentMode === 'bodyweight_only' && (isMachineHeavyExercise(name) || isExternalLoadExercise(name))) {
      return false;
    }

    if (exercise.allowedEquipmentModes && !exercise.allowedEquipmentModes.includes(equipmentMode)) {
      return false;
    }

    if (level === 'beginner' && isAdvancedSkillExercise(name)) {
      return false;
    }

    if (level === 'beginner' && exercise.minDifficulty !== 'beginner') {
      return false;
    }

    if (level === 'intermediate' && exercise.minDifficulty === 'advanced') {
      return false;
    }

    return true;
  });
}

function sortByPatternPriority(exercises = [], patternPriority = []) {
  const rank = new Map(patternPriority.map((pattern, index) => [pattern, index]));
  return [...exercises].sort((a, b) => {
    const aRank = rank.has(a.movementPattern) ? rank.get(a.movementPattern) : 99;
    const bRank = rank.has(b.movementPattern) ? rank.get(b.movementPattern) : 99;
    if (aRank !== bRank) return aRank - bRank;
    return String(a.name).localeCompare(String(b.name));
  });
}

function buildDeterministicExerciseOrder(exercises = [], context = {}, targetExerciseCount = 5) {
  const requestedType = normalizeRequestedType(context.requestedType || context.focus);
  const goal = normalizeGoal(context.goal);
  const maxCount = Math.max(3, Math.min(6, Number(targetExerciseCount) || 5));

  const preferredBySplit = {
    push: ['horizontal_push', 'vertical_push', 'other'],
    pull: ['horizontal_pull', 'vertical_pull', 'other'],
    legs: ['squat', 'hinge', 'other'],
    fullbody: ['squat', 'horizontal_push', 'horizontal_pull', 'hinge', 'other']
  };

  const unique = [];
  const used = new Set();
  exercises.forEach((exercise) => {
    const key = String(exercise.name || '').toLowerCase().trim();
    if (!key || used.has(key)) return;
    used.add(key);
    unique.push(exercise);
  });

  const compounds = sortByPatternPriority(
    unique.filter((exercise) => {
      const role = getExerciseRole(exercise);
      return role === 'main_compound' || role === 'secondary_compound';
    }),
    preferredBySplit[requestedType] || preferredBySplit.fullbody
  );
  const accessories = sortByPatternPriority(
    unique.filter((exercise) => getExerciseRole(exercise) === 'accessory'),
    preferredBySplit[requestedType] || preferredBySplit.fullbody
  );
  const cores = sortByPatternPriority(
    unique.filter((exercise) => getExerciseRole(exercise) === 'core'),
    ['core', 'other']
  );

  const ordered = [];
  compounds.slice(0, 2).forEach((exercise) => ordered.push(exercise));
  compounds.slice(2).forEach((exercise) => ordered.push(exercise));
  accessories.forEach((exercise) => ordered.push(exercise));

  if (goal === 'hypertrophy') {
    cores.slice(0, 1).forEach((exercise) => ordered.push(exercise));
  } else if (requestedType === 'fullbody') {
    cores.slice(0, 1).forEach((exercise) => ordered.push(exercise));
  }

  const fallback = [...cores, ...compounds, ...accessories];
  fallback.forEach((exercise) => {
    const key = String(exercise.name || '').toLowerCase().trim();
    if (!key) return;
    if (!ordered.some((item) => String(item.name || '').toLowerCase().trim() === key)) {
      ordered.push(exercise);
    }
  });

  return ordered.slice(0, maxCount);
}

function getWorkoutBlueprint(type, goal, equipmentMode) {
  return (
    WORKOUT_BLUEPRINTS[type]?.[goal]?.[equipmentMode]
    || WORKOUT_BLUEPRINTS[type]?.[goal]?.gym_plus_bodyweight
    || []
  );
}

function findExerciseByBlueprintName(pool, blueprintName) {
  const normalizedBlueprint = String(blueprintName || '').toLowerCase();
  return pool.find((exercise) => {
    const normalizedName = String(exercise.name || '').toLowerCase();
    return normalizedName === normalizedBlueprint
      || normalizedName.includes(normalizedBlueprint)
      || normalizedBlueprint.includes(normalizedName);
  });
}

function buildBlueprintFallbackExercise(name, fallbackType, goal) {
  const strength = goal === 'strength';
  return {
    name,
    sets: strength ? 4 : 3,
    reps: strength ? 6 : 10,
    weight: 0,
    rest: strength ? 120 : 90,
    category: fallbackType,
    movementPattern: inferMovementPattern(name),
    targetType: inferExerciseType(name),
    isIsolation: isIsolationExercise(name),
    demandTier: inferDemandTier(name)
  };
}

function normalizeExercise(exercise, fallbackType) {
  const name = String(exercise?.name || '').trim();
  if (!name) return null;
  const metadata = resolveExerciseMetadata(name);
  const movementPattern = inferMovementPattern(name);
  const targetType = inferExerciseType(name);
  return {
    name,
    sets: Math.min(6, Math.max(1, Number(exercise?.sets) || 3)),
    reps: Math.min(20, Math.max(1, Number(exercise?.reps) || 10)),
    weight: Math.max(0, Number(exercise?.weight) || 0),
    rest: Math.min(240, Math.max(20, Number(exercise?.rest) || 90)),
    category: fallbackType,
    movementPattern,
    targetType,
    isIsolation: isIsolationExercise(name),
    demandTier: inferDemandTier(name),
    aiMetadata: metadata,
    minDifficulty: metadata?.minDifficulty || 'beginner',
    exerciseType: metadata?.exerciseType || null,
    primaryPhase: metadata?.primaryPhase || null,
    disallowedGoals: Array.isArray(metadata?.disallowedGoals) ? metadata.disallowedGoals : [],
    allowedEquipmentModes: Array.isArray(metadata?.allowedEquipmentModes) ? metadata.allowedEquipmentModes : null
  };
}

function getTimeAdjustedExerciseTarget(durationMinutes = 45, goal = 'hypertrophy') {
  const duration = Number(durationMinutes) || 45;
  if (duration <= 30) return goal === 'strength' ? 3 : 4;
  if (duration <= 45) return goal === 'strength' ? 4 : 5;
  return goal === 'strength' ? 5 : 6;
}

function isAssistedVariation(name = '') {
  const normalized = String(name).toLowerCase();
  return [
    'assist',
    'assisted',
    'unterstützt',
    'unterstuetzt',
    'support',
    'supported',
    'gravitron',
    'smith assisted',
    'hilfe'
  ].some((term) => normalized.includes(term));
}

function isPushupVariation(name = '') {
  const normalized = String(name).toLowerCase();
  return normalized.includes('liegestütz') || normalized.includes('push-up') || normalized.includes('push up') || normalized.includes('pushup');
}

function applyPerformanceSelectionRules(exercises = [], performance = {}) {
  const maxStrictPullups = Number(performance?.maxStrictPullups);
  const maxStrictDips = Number(performance?.maxStrictDips);
  const maxStrictPushups = Number(performance?.maxStrictPushups);

  let filtered = [...exercises];

  if (Number.isFinite(maxStrictPullups) && maxStrictPullups >= 8) {
    filtered = filtered.filter((exercise) => {
      const name = String(exercise.name || '').toLowerCase();
      const targetsPullPattern = inferMovementPattern(name) === 'vertical_pull' || name.includes('klimm');
      return !(targetsPullPattern && isAssistedVariation(name));
    });
  }

  if (Number.isFinite(maxStrictDips) && maxStrictDips >= 10) {
    filtered = filtered.filter((exercise) => {
      const name = String(exercise.name || '').toLowerCase();
      const targetsDipPattern = name.includes('dip');
      return !(targetsDipPattern && isAssistedVariation(name));
    });
  }

  if (Number.isFinite(maxStrictPushups) && maxStrictPushups > 20) {
    const nonPushupMain = filtered.find((exercise) => !isPushupVariation(exercise.name));
    if (nonPushupMain) {
      const pushupIndex = filtered.findIndex((exercise) => isPushupVariation(exercise.name));
      const mainIndex = filtered.findIndex((exercise) => exercise.name === nonPushupMain.name);
      if (pushupIndex !== -1 && mainIndex !== -1 && pushupIndex < mainIndex) {
        const pushupExercise = filtered[pushupIndex];
        filtered.splice(pushupIndex, 1);
        filtered.splice(Math.min(filtered.length, 2), 0, pushupExercise);
      }
    }
  }

  return filtered;
}

function buildExerciseCoachingNote(exercise, goal, index) {
  const primary = index < 2 && !isIsolationExercise(exercise.name);
  if (goal === 'strength') {
    if (primary) return 'Arbeite bei RPE 7-9, steigere Last progressiv bei sauberer Technik.';
    return 'Kontrollierte Ausführung, Last konservativ steigern, vollständige ROM.';
  }
  if (primary) return 'Kontrollierte Exzentrik (2-3 Sek.) und saubere Technik priorisieren.';
  return 'Fokus auf Mind-Muscle-Connection und konstante Spannungszeit.';
}

function pickExercisesByPattern(pool, preferredPatterns = [], maxCount = 6) {
  const selected = [];
  const used = new Set();

  const take = (exercise) => {
    if (!exercise) return;
    const key = String(exercise.name).toLowerCase();
    if (used.has(key) || selected.length >= maxCount) return;
    used.add(key);
    selected.push(exercise);
  };

  preferredPatterns.forEach((pattern) => {
    const match = pool.find((exercise) => exercise.movementPattern === pattern && !used.has(String(exercise.name).toLowerCase()));
    take(match);
  });

  pool.forEach((exercise) => take(exercise));

  const noBackToBackSamePattern = [];
  selected.forEach((exercise) => {
    const prev = noBackToBackSamePattern[noBackToBackSamePattern.length - 1];
    if (!prev || prev.movementPattern !== exercise.movementPattern) {
      noBackToBackSamePattern.push(exercise);
      return;
    }
    const swapIndex = selected.findIndex((candidate) => {
      const candidateKey = String(candidate.name).toLowerCase();
      return !noBackToBackSamePattern.some((s) => String(s.name).toLowerCase() === candidateKey)
        && candidate.movementPattern !== prev.movementPattern;
    });
    if (swapIndex !== -1) {
      noBackToBackSamePattern.push(selected[swapIndex]);
    } else {
      noBackToBackSamePattern.push(exercise);
    }
  });

  return noBackToBackSamePattern.slice(0, maxCount);
}

function applyGoalRanges(exercises, goal) {
  return exercises.map((exercise, index) => {
    const primary = index < 2 && !exercise.isIsolation;
    const accessory = exercise.isIsolation || exercise.demandTier === 'low';

    if (goal === 'strength') {
      const repsRange = primary ? [3, 6] : accessory ? [6, 12] : [3, 8];
      const setsRange = primary ? [4, 5] : accessory ? [2, 3] : [3, 4];
      const restRange = primary ? [120, 240] : accessory ? [60, 120] : [90, 180];
      return {
        ...exercise,
        reps: Math.min(repsRange[1], Math.max(repsRange[0], exercise.reps)),
        sets: Math.min(setsRange[1], Math.max(setsRange[0], exercise.sets)),
        rest: Math.min(restRange[1], Math.max(restRange[0], exercise.rest))
      };
    }

    const repsRange = primary ? [6, 12] : [8, 15];
    const setsRange = [3, 4];
    const restRange = primary ? [60, 120] : [45, 90];
    return {
      ...exercise,
      reps: Math.min(repsRange[1], Math.max(repsRange[0], exercise.reps)),
      sets: Math.min(setsRange[1], Math.max(setsRange[0], exercise.sets)),
      rest: Math.min(restRange[1], Math.max(restRange[0], exercise.rest))
    };
  });
}

function enforceWorkoutProgrammingRules(payload, context = {}, options = {}) {
  const requestedType = normalizeRequestedType(context.requestedType || context.focus);
  const goal = normalizeGoal(context.goal || (Number(context.intensity) >= 4 ? 'strength' : 'muscle_building'));
  const equipmentMode = normalizeEquipmentMode(context.equipmentMode || payload?.equipmentMode);
  const targetExerciseCount = getTimeAdjustedExerciseTarget(context.durationMinutes || context.timeAvailable, goal);
  const preferredBySplit = {
    push: ['horizontal_push', 'vertical_push', 'horizontal_push', 'vertical_push', 'core'],
    pull: ['horizontal_pull', 'vertical_pull', 'horizontal_pull', 'vertical_pull', 'core'],
    legs: ['squat', 'hinge', 'squat', 'hinge', 'core'],
    fullbody: ['squat', 'horizontal_push', 'horizontal_pull', 'hinge', 'core']
  };

  const inputExercises = Array.isArray(payload?.exercises) ? payload.exercises : [];
  const normalized = inputExercises
    .map((exercise) => normalizeExercise(exercise, requestedType))
    .filter(Boolean)
    .filter((exercise) => (requestedType === 'fullbody' ? true : matchesRequestedType(exercise.name, requestedType)));

  const blueprint = getWorkoutBlueprint(requestedType, goal, equipmentMode);
  const blueprintSelected = [];
  const blueprintUsedNames = new Set();

  blueprint.forEach((name) => {
    const existing = findExerciseByBlueprintName(normalized, name);
    const picked = existing || buildBlueprintFallbackExercise(name, requestedType, goal);
    const key = String(picked.name || '').toLowerCase();
    if (!blueprintUsedNames.has(key)) {
      blueprintUsedNames.add(key);
      blueprintSelected.push(picked);
    }
  });

  const normalizedWithoutBlueprint = normalized.filter((exercise) => {
    const key = String(exercise.name || '').toLowerCase();
    return !blueprintUsedNames.has(key);
  });

  const orderedRemainder = pickExercisesByPattern(normalizedWithoutBlueprint, preferredBySplit[requestedType] || preferredBySplit.fullbody, 6);
  const ordered = [...blueprintSelected, ...orderedRemainder].slice(0, 6);
  const hardFiltered = applyHardExerciseFilters(ordered, {
    ...context,
    requestedType,
    goal,
    equipmentMode
  });
  const performanceFiltered = applyPerformanceSelectionRules(hardFiltered, context.performance || {});
  const deterministicOrder = buildDeterministicExerciseOrder(
    performanceFiltered,
    {
      ...context,
      requestedType,
      goal
    },
    targetExerciseCount
  );

  let reordered = deterministicOrder;
  const firstCompoundIndex = reordered.findIndex((exercise) => !exercise.isIsolation);
  if (firstCompoundIndex > 0) {
    const firstCompound = reordered[firstCompoundIndex];
    reordered = [firstCompound, ...reordered.filter((_, index) => index !== firstCompoundIndex)];
  }

  const goalAdjusted = applyGoalRanges(reordered, goal)
    .slice(0, targetExerciseCount)
    .map((exercise, index) => ({
    name: exercise.name,
    sets: exercise.sets,
    reps: exercise.reps,
    weight: exercise.weight,
    rest: exercise.rest,
    category: requestedType,
    note: buildExerciseCoachingNote(exercise, goal, index)
    }));

  const fallbackName = requestedType === 'fullbody' ? 'Full Body Session' : `${requestedType.toUpperCase()} Session`;
  const warmupHint = Number(context.durationMinutes || context.timeAvailable || 45) >= 30
    ? `Warm-up: 5-8 min ${requestedType === 'legs' ? 'Mobilität + Ramp-Up Sets' : 'leichtes Cardio + Aktivierung'}.`
    : 'Warm-up: 2-4 min Gelenkaktivierung + 1 leichter Ramp-up Satz.';

  return {
    workoutName: typeof payload?.workoutName === 'string' && payload.workoutName.trim()
      ? payload.workoutName.trim()
      : fallbackName,
    exercises: goalAdjusted,
    estimatedDuration: Math.min(120, Math.max(20, Number(payload?.estimatedDuration) || Number(context.durationMinutes) || Number(context.timeAvailable) || 45)),
    difficulty: payload?.difficulty === 'advanced' ? 'advanced' : 'beginner',
    warmup: warmupHint,
    notes: [
      warmupHint,
      goal === 'strength'
        ? 'Reihenfolge: Main Compound → Secondary Compound → Accessory. Pausen 2-4 min bei Hauptlifts.'
        : 'Reihenfolge: Main Compound → Secondary Compound → Accessory. Kontrollierte Exzentrik und saubere Technik.'
    ].join(' '),
    goal,
    requestedType,
    equipmentMode,
    metadata: {
      ...(payload?.metadata || {}),
      ruleEngine: {
        enabled: true,
        source: options.source || 'unknown',
        goal,
        requestedType,
        equipmentMode,
        blueprintLocked: true,
        targetExerciseCount,
        outputFormat: {
          title: true,
          goal: true,
          environment: true,
          warmup: true,
          exerciseNotes: true
        }
      }
    }
  };
}

function matchesRequestedType(exerciseName, requestedType) {
  const type = normalizeRequestedType(requestedType);
  if (type === 'fullbody') return true;
  return inferExerciseType(exerciseName) === type;
}

function generateQuickGeneratorDemo(context) {
  const requestedType = normalizeRequestedType(context.requestedType);
  const equipmentMode = context.equipmentMode === 'bodyweight_only' ? 'bodyweight_only' : context.equipmentMode;
  const plans = {
    push: {
      gym_only: [
        { name: 'Bankdrücken', sets: 4, reps: 8, weight: 0, rest: 120 },
        { name: 'Schulterdrücken', sets: 4, reps: 8, weight: 0, rest: 120 },
        { name: 'Dips', sets: 3, reps: 10, weight: 0, rest: 90 },
        { name: 'Seitheben', sets: 3, reps: 12, weight: 0, rest: 75 },
        { name: 'Overhead Trizepsdrücken', sets: 3, reps: 12, weight: 0, rest: 75 }
      ],
      gym_plus_bodyweight: [
        { name: 'Liegestütze', sets: 4, reps: 12, weight: 0, rest: 60 },
        { name: 'Kurzhantel Bankdrücken', sets: 4, reps: 10, weight: 0, rest: 90 },
        { name: 'Dips', sets: 3, reps: 10, weight: 0, rest: 90 },
        { name: 'Seitheben', sets: 3, reps: 15, weight: 0, rest: 60 },
        { name: 'Trizeps-Kickbacks', sets: 3, reps: 12, weight: 0, rest: 60 }
      ],
      bodyweight_only: [
        { name: 'Liegestütze', sets: 4, reps: 12, weight: 0, rest: 60 },
        { name: 'Dips', sets: 4, reps: 8, weight: 0, rest: 75 },
        { name: 'Pike Push-Ups', sets: 3, reps: 10, weight: 0, rest: 75 },
        { name: 'Enge Liegestütze', sets: 3, reps: 12, weight: 0, rest: 60 },
        { name: 'Plank', sets: 3, reps: 45, weight: 0, rest: 45 }
      ]
    },
    pull: {
      gym_only: [
        { name: 'Rudern Langhantel', sets: 4, reps: 8, weight: 0, rest: 120 },
        { name: 'Latzug zur Brust', sets: 4, reps: 10, weight: 0, rest: 90 },
        { name: 'Kurzhantelrudern', sets: 3, reps: 10, weight: 0, rest: 90 },
        { name: 'Bizeps Curls Langhantel', sets: 3, reps: 10, weight: 0, rest: 75 },
        { name: 'Face Pulls', sets: 3, reps: 12, weight: 0, rest: 60 }
      ],
      gym_plus_bodyweight: [
        { name: 'Klimmzüge', sets: 4, reps: 8, weight: 0, rest: 90 },
        { name: 'Rudern Kabelzug', sets: 4, reps: 10, weight: 0, rest: 90 },
        { name: 'Kurzhantel Bizeps Curls', sets: 3, reps: 12, weight: 0, rest: 60 },
        { name: 'Hammer Curls', sets: 3, reps: 12, weight: 0, rest: 60 },
        { name: 'Umgekehrtes Flys', sets: 3, reps: 15, weight: 0, rest: 60 }
      ],
      bodyweight_only: [
        { name: 'Klimmzüge', sets: 4, reps: 6, weight: 0, rest: 90 },
        { name: 'Inverted Rows', sets: 4, reps: 10, weight: 0, rest: 75 },
        { name: 'Superman Hold', sets: 3, reps: 40, weight: 0, rest: 45 },
        { name: 'Reverse Snow Angels', sets: 3, reps: 12, weight: 0, rest: 60 },
        { name: 'Dead Bug', sets: 3, reps: 12, weight: 0, rest: 45 }
      ]
    },
    legs: {
      gym_only: [
        { name: 'Kniebeugen Langhantel', sets: 4, reps: 8, weight: 0, rest: 150 },
        { name: 'Rumänisches Kreuzheben', sets: 4, reps: 8, weight: 0, rest: 150 },
        { name: 'Beinpresse', sets: 3, reps: 12, weight: 0, rest: 90 },
        { name: 'Beincurls liegend', sets: 3, reps: 12, weight: 0, rest: 90 },
        { name: 'Wadenheben stehend', sets: 4, reps: 12, weight: 0, rest: 60 }
      ],
      gym_plus_bodyweight: [
        { name: 'Kniebeugen Langhantel', sets: 4, reps: 10, weight: 0, rest: 120 },
        { name: 'Ausfallschritte Kurzhantel', sets: 3, reps: 12, weight: 0, rest: 90 },
        { name: 'Bulgarian Split Squats', sets: 3, reps: 10, weight: 0, rest: 90 },
        { name: 'Glute Bridge', sets: 3, reps: 15, weight: 0, rest: 60 },
        { name: 'Wadenheben sitzend', sets: 4, reps: 15, weight: 0, rest: 60 }
      ],
      bodyweight_only: [
        { name: 'Kniebeugen', sets: 4, reps: 15, weight: 0, rest: 60 },
        { name: 'Bulgarian Split Squats', sets: 4, reps: 10, weight: 0, rest: 75 },
        { name: 'Ausfallschritte', sets: 3, reps: 12, weight: 0, rest: 60 },
        { name: 'Glute Bridge', sets: 3, reps: 15, weight: 0, rest: 60 },
        { name: 'Wadenheben stehend', sets: 4, reps: 20, weight: 0, rest: 45 }
      ]
    },
    fullbody: {
      gym_only: [
        { name: 'Kniebeugen Langhantel', sets: 4, reps: 6, weight: 0, rest: 120 },
        { name: 'Kurzhantel Bankdrücken', sets: 4, reps: 8, weight: 0, rest: 90 },
        { name: 'Rudern Kabelzug', sets: 3, reps: 10, weight: 0, rest: 90 },
        { name: 'Schulterdrücken', sets: 3, reps: 10, weight: 0, rest: 90 },
        { name: 'Wadenheben stehend', sets: 3, reps: 12, weight: 0, rest: 60 }
      ],
      gym_plus_bodyweight: [
        { name: 'Liegestütze', sets: 4, reps: 12, weight: 0, rest: 60 },
        { name: 'Kniebeugen Langhantel', sets: 4, reps: 8, weight: 0, rest: 90 },
        { name: 'Klimmzüge', sets: 3, reps: 8, weight: 0, rest: 90 },
        { name: 'Ausfallschritte Kurzhantel', sets: 3, reps: 10, weight: 0, rest: 75 },
        { name: 'Plank', sets: 3, reps: 45, weight: 0, rest: 45 }
      ],
      bodyweight_only: [
        { name: 'Kniebeugen', sets: 4, reps: 15, weight: 0, rest: 60 },
        { name: 'Liegestütze', sets: 4, reps: 12, weight: 0, rest: 60 },
        { name: 'Inverted Rows', sets: 3, reps: 10, weight: 0, rest: 75 },
        { name: 'Ausfallschritte', sets: 3, reps: 12, weight: 0, rest: 60 },
        { name: 'Plank', sets: 3, reps: 45, weight: 0, rest: 45 }
      ]
    }
  };

  const strength = context.goal === 'strength';
  const selectedTypePlans = plans[requestedType] || plans.fullbody;
  const exercises = equipmentMode === 'gym_only'
    ? selectedTypePlans.gym_only
    : equipmentMode === 'bodyweight_only'
      ? selectedTypePlans.bodyweight_only
      : selectedTypePlans.gym_plus_bodyweight;

  return {
    workoutName: `${requestedType === 'fullbody' ? 'Full Body' : requestedType.toUpperCase()} ${strength ? 'Strength' : 'Hypertrophy'} Session`,
    exercises: exercises.map((exercise) => ({
      ...exercise,
      reps: strength ? Math.min(exercise.reps, 8) : Math.max(exercise.reps, 10),
      sets: strength ? Math.max(exercise.sets, 4) : exercise.sets,
      category: requestedType
    })),
    estimatedDuration: context.durationMinutes,
    difficulty: context.level,
    notes: `${strength ? 'Fokus auf kontrollierte schwere Sätze.' : 'Fokus auf saubere Wiederholungen und Volumen.'} Typ: ${requestedType}.`
  };
}

function normalizeQuickGeneratorResponse(payload, context) {
  const safePayload = payload && Array.isArray(payload.exercises) && payload.exercises.length >= 3
    ? payload
    : generateQuickGeneratorDemo(context);
  return enforceWorkoutProgrammingRules(safePayload, context, { source: 'quick-generator' });
}

function createWorkoutPrompt(context) {
  const timestamp = Date.now();
  
  return `Erstelle ein strukturiertes Workout für Anfrage #${timestamp}:
  
  Erfahrungslevel: ${context.experienceLevel || 'unbekannt'}
  Verfügbare Zeit: ${context.timeAvailable || '45'} Minuten
  Fokus: ${context.focus || 'Ganzkörper'}
  Letzte Workouts: ${context.recentWorkouts || 'keine Daten'}
  Verletzungen: ${context.injuries || 'keine'}
  
  WICHTIG: Priorisiere klare Struktur vor Variation.
  Reihenfolge: Main Compound -> Secondary Compound -> Accessory -> optional Core.
  requestedType muss strikt eingehalten werden.
  
  Bitte erstelle ein sicheres, effektives und zielgerichtetes Workout.`;
}

async function generateDemoSuggestion(context) {
  const timestamp = Date.now();
  const focus = context.focus || 'push';
  const level = context.experienceLevel || 'intermediate';
  const normalizedGoal = normalizeGoal(context.goal || (Number(context.intensity) >= 4 ? 'strength' : 'muscle_building'));
  
  // Fokus-spezifische Workout-Variationen
  const workoutVariations = {
    push: [
      {
        workoutName: "Power Push Session",
        exercises: [
          { name: "Schrägbankdrücken", sets: 4, reps: 8, weight: 0, rest: 120 },
          { name: "Liegestütze", sets: 3, reps: 10, weight: 0, rest: 90 },
          { name: "Dips", sets: 3, reps: 8, weight: 0, rest: 90 },
          { name: "Schulterdrücken", sets: 4, reps: 10, weight: 0, rest: 120 },
          { name: "Trizeps-Kickbacks", sets: 3, reps: 12, weight: 0, rest: 60 }
        ]
      },
      {
        workoutName: "Push Volume Builder",
        exercises: [
          { name: "Kurzhantel Bankdrücken", sets: 3, reps: 12, weight: 0, rest: 90 },
          { name: "Seitheben", sets: 4, reps: 15, weight: 0, rest: 60 },
          { name: "Liegestütze", sets: 3, reps: 15, weight: 0, rest: 60 },
          { name: "Frontheben", sets: 3, reps: 12, weight: 0, rest: 60 },
          { name: "Overhead Trizepsdrücken", sets: 4, reps: 12, weight: 0, rest: 90 }
        ]
      },
      {
        workoutName: "Push Strength Circuit",
        exercises: [
          { name: "Bankdrücken", sets: 4, reps: 6, weight: 0, rest: 150 },
          { name: "Military Press", sets: 3, reps: 5, weight: 0, rest: 120 },
          { name: "Dips", sets: 4, reps: 6, weight: 0, rest: 150 },
          { name: "Trizeps Bankdrücken", sets: 3, reps: 8, weight: 0, rest: 90 },
          { name: "Arnold Press", sets: 3, reps: 15, weight: 0, rest: 60 }
        ]
      }
    ],
    pull: [
      {
        workoutName: "Pull Power Session",
        exercises: [
          { name: "Klimmzüge", sets: 4, reps: 6, weight: 0, rest: 120 },
          { name: "Rudern Langhantel", sets: 4, reps: 8, weight: 0, rest: 120 },
          { name: "Kurzhantelrudern", sets: 3, reps: 10, weight: 0, rest: 90 },
          { name: "Bizeps Curls Langhantel", sets: 3, reps: 8, weight: 0, rest: 90 },
          { name: "Face Pulls", sets: 3, reps: 12, weight: 0, rest: 60 }
        ]
      },
      {
        workoutName: "Pull Volume Builder",
        exercises: [
          { name: "Latzug zur Brust", sets: 3, reps: 12, weight: 0, rest: 90 },
          { name: "Rudern Kabelzug", sets: 4, reps: 12, weight: 0, rest: 90 },
          { name: "Kurzhantel Bizeps Curls", sets: 3, reps: 15, weight: 0, rest: 60 },
          { name: "Hammer Curls", sets: 3, reps: 12, weight: 0, rest: 60 },
          { name: "Umgekehrtes Flys", sets: 4, reps: 15, weight: 0, rest: 60 }
        ]
      },
      {
        workoutName: "Pull Strength Circuit",
        exercises: [
          { name: "Klimmzüge", sets: 4, reps: 5, weight: 0, rest: 150 },
          { name: "Rudern Langhantel", sets: 4, reps: 6, weight: 0, rest: 150 },
          { name: "Pullovers Langhantel", sets: 3, reps: 8, weight: 0, rest: 120 },
          { name: "Bizeps Curls Langhantel", sets: 3, reps: 6, weight: 0, rest: 90 },
          { name: "Shrugs Langhantel", sets: 3, reps: 12, weight: 0, rest: 90 }
        ]
      }
    ],
    legs: [
      {
        workoutName: "Leg Power Session",
        exercises: [
          { name: "Kniebeugen Langhantel", sets: 4, reps: 6, weight: 0, rest: 180 },
          { name: "Rumänisches Kreuzheben", sets: 4, reps: 8, weight: 0, rest: 150 },
          { name: "Bulgarian Split Squats", sets: 3, reps: 10, weight: 0, rest: 120 },
          { name: "Ausfallschritte Kurzhantel", sets: 3, reps: 8, weight: 0, rest: 90 },
          { name: "Wadenheben stehend", sets: 4, reps: 15, weight: 0, rest: 60 }
        ]
      },
      {
        workoutName: "Leg Volume Builder",
        exercises: [
          { name: "Frontkniebeugen", sets: 3, reps: 12, weight: 0, rest: 120 },
          { name: "Beinpresse", sets: 4, reps: 15, weight: 0, rest: 90 },
          { name: "Beincurls liegend", sets: 3, reps: 12, weight: 0, rest: 90 },
          { name: "Beinstrecker", sets: 3, reps: 15, weight: 0, rest: 60 },
          { name: "Glute Bridge", sets: 4, reps: 20, weight: 0, rest: 60 }
        ]
      },
      {
        workoutName: "Leg Strength Circuit",
        exercises: [
          { name: "Kreuzheben konventionell", sets: 4, reps: 5, weight: 0, rest: 180 },
          { name: "Kniebeugen Langhantel", sets: 4, reps: 6, weight: 0, rest: 180 },
          { name: "Hip Thrust Langhantel", sets: 3, reps: 8, weight: 0, rest: 120 },
          { name: "Good Mornings", sets: 3, reps: 10, weight: 0, rest: 90 },
          { name: "Wadenheben sitzend", sets: 4, reps: 12, weight: 0, rest: 60 }
        ]
      }
    ]
  };
  
  // Fallback für andere Fokus-Typen
  const availableVariations = workoutVariations[focus] || workoutVariations.push;
  const variationIndex = normalizedGoal === 'strength' ? 2 : 1;
  const selectedWorkout = availableVariations[variationIndex] || availableVariations[0];
  
  // Mappe Exercise-Namen zu Datenbank-IDs (asynchron, daher async function nötig)
  const exercisesWithIds = await Promise.all(
    selectedWorkout.exercises.map(async (ex) => {
      try {
        // Suche Übung in Datenbank nach Namen
        const dbExercise = await Exercise.findOne({ 
          name: { $regex: new RegExp(`^${ex.name}$`, 'i') }
        }).lean();
        
        return {
          ...ex,
          _id: dbExercise?._id?.toString() || `default_${ex.name.replace(/\s+/g, '_')}`,
          exerciseId: dbExercise?._id?.toString(),
          muscleGroup: dbExercise?.muscleGroups?.[0] || 'Unknown',
          category: focus,
          equipment: dbExercise?.equipment || 'Unknown'
        };
      } catch (err) {
        logger.warn(`⚠️ Fehler beim Matchen von "${ex.name}":`, err.message);
        return {
          ...ex,
          _id: `default_${ex.name.replace(/\s+/g, '_')}`,
          muscleGroup: 'Unknown',
          category: focus
        };
      }
    })
  );
  
  // Gebe angereicherte Demo-Vorschläge zurück
  return {
    type: focus,
    focus: focus,
    workoutName: selectedWorkout.workoutName,
    exercises: exercisesWithIds,
    estimatedDuration: context.timeAvailable || 45,
    difficulty: level,
    metadata: {
      source: 'demo',
      isDemoData: true,
      variation: variationIndex + 1,
      recommendationId: `demo_${timestamp}_${Math.random().toString(36).substr(2, 9)}`
    }
  };
}

// 🤖 Admin: Lasse KI Übungen generieren und befülle Datenbank (45 Push, 45 Pull, 45 Legs)
router.post("/admin/populate-db-with-ai", async (req, res) => {
  try {
    logger.debug('🤖 Admin: Starte KI-basierte Datenbank-Befüllung...');
    
    // Initialisiere OpenAI
    const openaiClient = await initializeOpenAI();
    if (!openaiClient) {
      logger.warn('⚠️ OpenAI nicht verfügbar - nutze Fallback mit statischen Übungen');
      
      // Fallback: Nutze statische Übungen statt KI
      logger.debug('🧹 Lösche alte Übungen...');
      const deleteResult = await Exercise.deleteMany({});
      logger.debug(`✅ Gelöscht: ${deleteResult.deletedCount} Übungen`);
      
      // Importiere statische Übungen
      const staticExercises = await import('../data/exercises.js').then(m => m.default);
      logger.debug(`📋 Statische Übungen verfügbar: ${staticExercises.length}`);
      
      const newExercises = [];
      for (const staticEx of staticExercises) {
        try {
          const newEx = new Exercise({
            name: staticEx.name,
            names: {
              de: staticEx.name,
              en: staticEx.name
            },
            category: staticEx.category,
            muscleGroups: [staticEx.muscleGroup],
            equipment: staticEx.equipment,
            difficulty: 'Anfänger',
            instructions: staticEx.instructions || '',
            tips: staticEx.tips || '',
            source: 'static_fallback'
          });
          
          await newEx.save();
          newExercises.push(newEx);
        } catch (err) {
          logger.warn(`⚠️ Fehler beim Speichern von ${staticEx.name}:`, err.message);
        }
      }
      
      return res.json({
        message: 'Datenbank mit Fallback-Übungen befüllt (OpenAI nicht verfügbar)',
        totalExercises: newExercises.length,
        byCategory: {
          push: newExercises.filter(e => e.category === 'Push').length,
          pull: newExercises.filter(e => e.category === 'Pull').length,
          legs: newExercises.filter(e => e.category === 'Legs').length
        }
      });
    }
    
    // KI ist verfügbar - generiere neue Übungen
    logger.debug('🧹 Lösche alte Übungen...');
    const deleteResult = await Exercise.deleteMany({});
    logger.debug(`✅ Gelöscht: ${deleteResult.deletedCount} Übungen`);
    
    const categories = ['Push', 'Pull', 'Legs'];
    const allNewExercises = [];
    const exercisesByCategory = {};
    
    // Für jede Kategorie 45 Übungen generieren
    for (const category of categories) {
      logger.debug(`\n📚 Generiere 45 ${category}-Übungen mit KI...`);
      exercisesByCategory[category] = [];
      
      try {
        const prompt = `Du bist ein Fitness-Experte. Generiere EXAKT 45 VERSCHIEDENE, UNIQUE Übungen für die Kategorie "${category}".

Gib AUSSCHLIESSLICH ein JSON-Array zurück (keine andere Erklärung), mit dieser Struktur:
[
  {
    "name": "Übungsname",
    "muscleGroup": "Muskelgruppe",
    "equipment": "Gerät"
  }
]

ANFORDERUNGEN:

Generiere jetzt 45 ${category}-Übungen:`;

        const completion = await openaiClient.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "Du bist ein Fitness-Experte. Antworte AUSSCHLIESSLICH mit gültigem JSON, kein zusätzlicher Text."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          max_tokens: 4000,
          temperature: 0.9,
          timeout: 30000
        });

        const responseText = completion.choices[0].message.content;
        logger.debug(`📝 KI-Response Länge: ${responseText.length} Zeichen`);
        
        // Versuche JSON zu parsen
        const exercises = JSON.parse(responseText);
        
        if (!Array.isArray(exercises)) {
          throw new Error('KI hat kein Array zurückgegeben');
        }
        
        logger.debug(`✅ KI hat ${exercises.length} ${category}-Übungen generiert`);
        
        // Speichere die Übungen in die Datenbank
        for (const ex of exercises) {
          try {
            const newExercise = new Exercise({
              name: ex.name || `${category} Exercise`,
              names: {
                de: ex.name || `${category} Exercise`,
                en: ex.name || `${category} Exercise`
              },
              category: category,
              muscleGroups: ex.muscleGroup ? [ex.muscleGroup] : [`${category} Muscle`],
              equipment: ex.equipment || 'Körpergewicht',
              difficulty: 'Anfänger',
              instructions: `${ex.name} - Generated by AI`,
              source: 'ai_generated',
              createdAt: new Date(),
              updatedAt: new Date()
            });
            
            await newExercise.save();
            exercisesByCategory[category].push(newExercise);
            allNewExercises.push(newExercise);
            
          } catch (saveErr) {
            logger.warn(`⚠️ Fehler beim Speichern von "${ex.name}":`, saveErr.message);
          }
        }
        
        logger.debug(`✅ ${exercisesByCategory[category].length}/${exercises.length} ${category}-Übungen gespeichert`);
        
      } catch (aiErr) {
        logger.error(`❌ Fehler bei ${category}-Generierung:`, aiErr.message);
        // Wenn KI-Fehler: Fall back zu statischen Übungen!
        logger.debug(`⚠️ Fallback zu statischen Übungen nach KI-Fehler...`);
        
        const staticExercises = await import('../data/exercises.js').then(m => m.default);
        const staticForCategory = staticExercises.filter(ex => ex.category === category);
        
        for (const staticEx of staticForCategory) {
          try {
            const newExercise = new Exercise({
              name: staticEx.name,
              names: { de: staticEx.name, en: staticEx.name },
              category: category,
              muscleGroups: [staticEx.muscleGroup],
              equipment: staticEx.equipment,
              difficulty: 'Anfänger',
              source: 'static_fallback'
            });
            
            await newExercise.save();
            exercisesByCategory[category].push(newExercise);
            allNewExercises.push(newExercise);
          } catch (saveErr) {
            logger.warn(`⚠️ Fehler beim Speichern von "${staticEx.name}":`, saveErr.message);
          }
        }
        
        logger.debug(`✅ Fallback erfolgreich: ${exercisesByCategory[category].length} statische ${category}-Übungen geladen`);
      }
    }
    
    logger.debug(`\n✅ Datenbank erfolgreich mit ${allNewExercises.length} KI-Übungen befüllt!`);
    logger.debug(`   Push: ${exercisesByCategory['Push'].length}`);
    logger.debug(`   Pull: ${exercisesByCategory['Pull'].length}`);
    logger.debug(`   Legs: ${exercisesByCategory['Legs'].length}`);
    
    res.json({
      message: 'Datenbank erfolgreich mit KI-Übungen befüllt',
      totalExercises: allNewExercises.length,
      byCategory: {
        push: exercisesByCategory['Push'].length,
        pull: exercisesByCategory['Pull'].length,
        legs: exercisesByCategory['Legs'].length
      },
      exercises: allNewExercises.map(ex => ({ 
        _id: ex._id, 
        name: ex.name, 
        category: ex.category 
      })).slice(0, 10) // Zeige erste 10 als Sample
    });
    
  } catch (err) {
    logger.error('❌ Admin Populate Error:', err);
    logger.error('Stack:', err.stack);
    res.status(500).json({ 
      error: 'Fehler beim Befüllen der Datenbank',
      message: err.message,
      stack: err.stack
    });
  }
});

// 🔄 EXERCISE DATABASE SYNC - Bestehende Übungen in DB übertragen (Public für Setup)
router.post("/sync-exercises", async (req, res) => {
  try {
    const { userId } = req.auth();
    
    logger.debug('🔄 Synchronizing exercises to database...');
    
    // Konvertiere statische Übungsliste zu Datenbank-Format
    const exercisesToAdd = exercises.map(exercise => ({
      name: exercise.name,
      names: {
        de: exercise.name,
        en: exerciseNameMapping[exercise.name] || exercise.name // Fallback zum deutschen Namen
      },
      category: exercise.category,
      muscleGroups: [exercise.muscleGroup],
      equipment: exercise.equipment === 'dumbbells' ? 'Kurzhanteln' : 
                 exercise.equipment === 'barbell' ? 'Langhantel' :
                 exercise.equipment === 'cable_machine' ? 'Kabelzug' :
                 exercise.equipment === 'machine' ? 'Maschine' :
                 exercise.equipment === 'pull_up_bar' ? 'Körpergewicht' :
                 exercise.equipment === 'bench' ? 'Körpergewicht' :
                 'Körpergewicht',
      difficulty: 'Anfänger',
      source: 'manual',
      addedBy: userId
    }));
    
    const addedExercises = await addNewExercisesToDatabase(exercisesToAdd, 'manual', userId);
    
    // Statistiken
    const totalExercises = await Exercise.countDocuments();
    
    res.json({
      message: 'Übungen erfolgreich synchronisiert',
      addedCount: addedExercises.length,
      totalExercises: totalExercises,
      addedExercises: addedExercises.map(ex => ({
        id: ex._id,
        name: ex.name,
        category: ex.category,
        source: ex.source
      }))
    });

  } catch (err) {
    logger.error('❌ Exercise Sync Error:', err);
    res.status(500).json({ 
      error: 'Fehler beim Synchronisieren der Übungen',
      message: err.message 
    });
  }
});

// 📊 EXERCISE DATABASE STATS (Public für Debug-Zwecke)
router.get("/exercise-stats", async (req, res) => {
  try {
    const totalExercises = await Exercise.countDocuments();
    const exercisesBySource = await Exercise.aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } }
    ]);
    const exercisesByCategory = await Exercise.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);
    
    // Zusätzlich: Zeige erste 10 Übungen als Sample
    const sampleExercises = await Exercise.find({}).limit(10).select('name category source equipment');
    
    res.json({
      total: totalExercises,
      bySource: exercisesBySource,
      byCategory: exercisesByCategory,
      sampleExercises: sampleExercises,
      lastSyncDate: new Date().toISOString()
    });

  } catch (err) {
    logger.error('❌ Exercise Stats Error:', err);
    res.status(500).json({ 
      error: 'Fehler beim Abrufen der Übungsstatistiken',
      message: err.message 
    });
  }
});

export default router;
