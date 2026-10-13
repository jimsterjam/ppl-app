import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateExerciseVolume, getExerciseBestWeight } from '../workoutMetrics.js';
import { calculateExerciseStats } from '../../services/trainingAnalysisService.js';

// Absprache Paul 13.10.: Nicht gemachte Sätze (done:false) bleiben gespeichert, zählen aber nicht in Auswertungen.
const exercise = {
  weight: 100,
  reps: 5,
  setDetails: [
    { reps: 5, weight: 60, isWarmup: true },
    { reps: 5, weight: 100, done: true },
    { reps: 5, weight: 100 }, // ältere Daten ohne Angabe zählen als gemacht
    { reps: 5, weight: 120, done: false }
  ]
};

test('Volumen und Bestgewicht ignorieren nicht gemachte Sätze', () => {
  assert.equal(calculateExerciseVolume(exercise), 1000);
  assert.equal(getExerciseBestWeight({ ...exercise, weight: 0 }), 100);
});

test('Übungs-Statistik zählt nur gemachte Arbeitssätze', () => {
  const stats = calculateExerciseStats(exercise);
  assert.equal(stats.sets, 2);
  assert.equal(stats.reps, 10);
  assert.equal(stats.volume, 1000);
});

test('Ganz nicht gemachte Übung: keine Statistik', () => {
  assert.equal(calculateExerciseStats({ setDetails: [{ reps: 8, weight: 50, done: false }] }), null);
});
