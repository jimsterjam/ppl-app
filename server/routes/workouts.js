import express from "express";
import Workout from "../models/Workout.js";
import { firebaseAuthMiddleware } from '../middleware/firebaseAuth.js';
// Clerk-Import entfernt
import { OpenAI } from 'openai';
import exercises from '../data/exercises.js';
import Exercise from '../models/Exercise.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

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
const muscleLabelMap = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  core: 'Core',
  cardio: 'Cardio'
};

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
  try {
    const { userId } = req.auth;
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
    res.status(201).json(workout);
  } catch (err) {
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
    const context = sanitizeWorkoutRequest(req.body || {});
    const requestedMode = (context.mode || req.header('x-ai-mode') || 'auto').toLowerCase();
    delete context.mode;

    const forceDemo = requestedMode === 'demo';
    const tryRemote = !forceDemo && canUseRemoteAI(userId);

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

function createWorkoutPrompt(context) {
  const timestamp = Date.now();
  const randomSeed = Math.random().toString(36).substr(2, 9);
  
  return `Erstelle ein EINZIGARTIGES Workout für Anfrage #${timestamp}-${randomSeed}:
  
  Erfahrungslevel: ${context.experienceLevel || 'unbekannt'}
  Verfügbare Zeit: ${context.timeAvailable || '45'} Minuten
  Fokus: ${context.focus || 'Ganzkörper'}
  Letzte Workouts: ${context.recentWorkouts || 'keine Daten'}
  Verletzungen: ${context.injuries || 'keine'}
  
  WICHTIG: Erstelle eine NEUE, ANDERE Variation als vorherige Anfragen.
  Variiere Übungsreihenfolge, Rep-Ranges, oder Fokus-Bereiche.
  Jedes Workout sollte einzigartig und frisch sein.
  
  Bitte erstelle ein sicheres, effektives und ABWECHSLUNGSREICHES Workout.`;
}

async function generateDemoSuggestion(context) {
  const timestamp = Date.now();
  const randomVariation = Math.floor(Math.random() * 3); // 0, 1, oder 2
  const focus = context.focus || 'push';
  const level = context.experienceLevel || 'intermediate';
  
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
  const selectedWorkout = availableVariations[randomVariation];
  
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
      variation: randomVariation + 1,
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
- Kategorien: Push = Brust/Schultern/Trizeps, Pull = Rücken/Bizeps/Trapez, Legs = Beine/Gesäß
- EXAKT 45 verschiedene Übungen
- Jede Übung UNIQUE und sinnvoll
- Deutsche Übungsnamen
- Realistisches und professionelles Equipment
- Keine Duplikate

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
