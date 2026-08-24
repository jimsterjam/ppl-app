#!/usr/bin/env node
/**
 * Test-Script: Workout Analyzer mit echten Daten
 * Lädt echte Workouts aus der DB und generiert Feedback
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Workout from './models/Workout.js';
import { generateProgressFeedback } from './utils/ollamaClient.js';

dotenv.config({ path: './.env' });

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI nicht gesetzt in .env');
  process.exit(1);
}

async function analyzeWorkoutWithData() {
  try {
    console.log('📊 Test: Workout Analyzer mit echten Daten\n');

    // Verbinde mit MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB verbunden\n');

    // Finde einen User mit Workouts
    const workoutWithExercises = await Workout.findOne({
      exercises: { $exists: true, $ne: [] }
    }).lean();

    if (!workoutWithExercises) {
      console.log('❌ Keine Workouts in der DB gefunden');
      process.exit(1);
    }

    const userId = workoutWithExercises.userId;
    console.log(`📋 User ID: ${userId}`);
    console.log(`📋 Sample Workout: ${workoutWithExercises.name}`);
    console.log(`📋 Übungen: ${workoutWithExercises.exercises?.length || 0}\n`);

    // Lade alle Workouts des Users
    const allWorkouts = await Workout.find({ userId })
      .sort({ date: -1 })
      .lean();

    console.log(`📊 Total Workouts für diesen User: ${allWorkouts.length}\n`);

    // Analysiere jede Übung im Workout
    console.log('🔍 Analysiere Übungen und generiere Feedback:\n');

    let feedbackCount = 0;

    for (const exercise of workoutWithExercises.exercises || []) {
      const exerciseName = exercise.name || 'Unknown';

      // Finde vorherige Session der gleichen Übung
      const previousWorkout = allWorkouts.find(w => {
        if (w._id.toString() === workoutWithExercises._id.toString()) return false;
        return w.exercises?.some(e => (e.name || '').toLowerCase() === exerciseName.toLowerCase());
      });

      if (!previousWorkout) {
        console.log(`⏭️  ${exerciseName} - Erste Session, kein Vergleich möglich`);
        continue;
      }

      const prevEx = previousWorkout.exercises?.find(
        e => (e.name || '').toLowerCase() === exerciseName.toLowerCase()
      );

      if (!prevEx) continue;

      // Berechne Fortschritte
      const prevVolume = (prevEx.weight || 0) * (prevEx.reps || 0) * (prevEx.sets || 0);
      const currVolume = (exercise.weight || 0) * (exercise.reps || 0) * (exercise.sets || 0);
      const volumeChange = prevVolume > 0 ? Math.round(((currVolume - prevVolume) / prevVolume) * 100) : 0;
      const weightChange = (exercise.weight || 0) - (prevEx.weight || 0);
      const repChange = (exercise.reps || 0) - (prevEx.reps || 0);

      // Bestimme progression
      let progression = 'stable';
      if (weightChange > 0 || volumeChange > 5) progression = 'positive';
      else if (weightChange < -2 || volumeChange < -5) progression = 'negative';

      // Berechne Tage
      const daysDiff = Math.floor(
        (new Date(workoutWithExercises.date) - new Date(previousWorkout.date)) /
        (1000 * 60 * 60 * 24)
      );

      const trainingData = {
        exercise: exerciseName,
        period: daysDiff > 7 ? `${daysDiff} days` : `${daysDiff} days`,
        weight_change: weightChange,
        rep_change: repChange,
        volume_change: volumeChange,
        progression: progression
      };

      console.log(`\n📌 ${exerciseName}`);
      console.log(`   Vorher: ${prevEx.weight}kg × ${prevEx.reps} Reps × ${prevEx.sets} Sets`);
      console.log(`   Nachher: ${exercise.weight}kg × ${exercise.reps} Reps × ${exercise.sets} Sets`);
      console.log(`   Änderungen: ${weightChange > 0 ? '+' : ''}${weightChange}kg, ${repChange > 0 ? '+' : ''}${repChange} Reps, ${volumeChange > 0 ? '+' : ''}${volumeChange}% Volume`);
      console.log(`   Trend: ${progression}`);

      try {
        const feedback = await generateProgressFeedback(trainingData, {
          requestId: `test_${exerciseName}`,
          temperature: 0.6
        });

        console.log(`   💬 Feedback: "${feedback}"`);
        feedbackCount++;
      } catch (error) {
        console.log(`   ❌ Feedback Error: ${error.message}`);
      }
    }

    console.log(`\n\n✅ Test abgeschlossen!`);
    console.log(`📊 Feedback generiert: ${feedbackCount} Übungen`);

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

analyzeWorkoutWithData();
