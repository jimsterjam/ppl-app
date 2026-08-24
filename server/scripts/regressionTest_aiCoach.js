/**
 * Regressionstests: KI-Coach Analyse-Korrektur (Konzept-PDF Kap. 29)
 *
 * Reine Node-Skript-Tests OHNE DB-Verbindung und OHNE Test-Framework (im Projekt bisher
 * kein Test-Runner vorhanden - dieses Skript ist bewusst ein einfaches, abhängigkeitsfreies
 * Assert-Skript, direkt ausführbar mit:
 *
 *   node server/scripts/regressionTest_aiCoach.js
 *
 * Deckt die Kernszenarien aus Kap. 29 ab, die für die stufenweise Phase 1-4 relevant sind
 * (Datenmodell, Korrektheits-Regel-Engine, Route-Verdrahtung, Prompt). Prüft NICHT den
 * eigentlichen OpenAI-Call (kein Netzwerk nötig) und NICHT den JSON-Schema/Validator-Teil
 * (F-01-F10) - der ist laut Stufenentscheidung noch nicht gebaut.
 */

import assert from 'node:assert/strict';
import {
  determineTrend,
  analyzeExercise,
  structureAnalysisForAI
} from '../services/trainingAnalysisService.js';
import {
  determineTrendWithProfile,
  resolveEffectiveProfile,
  buildNoteContext
} from '../services/exerciseAnalysisRules.js';
import { OpenAIProvider } from '../services/OpenAIProvider.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`✅ ${name}`);
  } catch (err) {
    failed++;
    console.error(`❌ ${name}`);
    console.error(`   ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// 1. Rückwärtskompatibilität: ohne Profil identisches Verhalten wie vor Phase 2
// ---------------------------------------------------------------------------
test('determineTrendWithProfile ohne Profil == altes determineTrend()', () => {
  const cases = [
    [3, 2], [0, 6], [-3, 0], [0, -6], [0, 0], [1, -1]
  ];
  for (const [weightChange, volumeChange] of cases) {
    const legacy = determineTrend(weightChange, volumeChange);
    const withRules = determineTrendWithProfile({ weightChange, volumeChangePercent: volumeChange, profile: null });
    assert.equal(withRules, legacy, `weightChange=${weightChange}, volumeChange=${volumeChange}`);
  }
});

test('analyzeExercise ohne options-Parameter wirft nicht und liefert progression wie vorher', () => {
  const current = { name: 'Kniebeuge', setDetails: [{ reps: 8, weight: 100, isWarmup: false }] };
  const previous = { name: 'Kniebeuge', setDetails: [{ reps: 8, weight: 90, isWarmup: false }] };
  const analysis = analyzeExercise('Kniebeuge', current, previous, 7);
  assert.equal(analysis.progression, 'positive');
  assert.equal(analysis.noteContext, null);
  assert.equal(analysis.profileHint, null);
});

// ---------------------------------------------------------------------------
// 2. Kap. 26: exerciseType-abhängige Metrikbewertung
// ---------------------------------------------------------------------------
test('technique + externalLoadRelevant=false: Gewichtssteigerung wird NICHT als positiv gewertet', () => {
  const trend = determineTrendWithProfile({
    weightChange: 10,
    volumeChangePercent: 20,
    profile: { exerciseType: 'technique', externalLoadRelevant: false, trainingVolumeRelevant: false }
  });
  assert.equal(trend, 'stable');
});

test('power + higherRepsAreProgress=false: mehr Wiederholungen sind KEIN Fortschritt', () => {
  const trend = determineTrendWithProfile({
    weightChange: 0,
    volumeChangePercent: 0,
    repsChange: 5,
    profile: { exerciseType: 'power', higherRepsAreProgress: false, externalLoadRelevant: true, trainingVolumeRelevant: true }
  });
  assert.notEqual(trend, 'positive');
});

test('trainingVolumeRelevant=false: Volumenanstieg allein löst kein "positive" aus', () => {
  const trend = determineTrendWithProfile({
    weightChange: 0,
    volumeChangePercent: 50,
    profile: { exerciseType: 'endurance', trainingVolumeRelevant: false, externalLoadRelevant: true }
  });
  assert.notEqual(trend, 'positive');
});

test('Profil mit exerciseType und normalen Flags verhält sich wie generische Bewertung', () => {
  const trend = determineTrendWithProfile({
    weightChange: 5,
    volumeChangePercent: 10,
    profile: { exerciseType: 'strength', externalLoadRelevant: true, trainingVolumeRelevant: true, higherRepsAreProgress: true }
  });
  assert.equal(trend, 'positive');
});

// ---------------------------------------------------------------------------
// 3. Kap. 25: Prioritätsreihenfolge globales Profil (Rang 3) vs. User-Override (Rang 1/2)
// ---------------------------------------------------------------------------
test('resolveEffectiveProfile: kein Profil, keine Notiz -> null', () => {
  assert.equal(resolveEffectiveProfile(null, null), null);
});

test('resolveEffectiveProfile: nur globales Profil -> unverändert übernommen', () => {
  const global = { exerciseType: 'hypertrophy', externalLoadRelevant: true };
  const effective = resolveEffectiveProfile(global, null);
  assert.equal(effective.exerciseType, 'hypertrophy');
});

test('resolveEffectiveProfile: bestätigte User-Notiz überschreibt exerciseType des globalen Profils (Rang 1 > Rang 3)', () => {
  const global = { exerciseType: 'hypertrophy', externalLoadRelevant: true, trainingVolumeRelevant: true };
  const userNote = { isConfirmed: true, overrides: { exerciseType: 'technique', externalLoadRelevant: false } };
  const effective = resolveEffectiveProfile(global, userNote);
  assert.equal(effective.exerciseType, 'technique');
  assert.equal(effective.externalLoadRelevant, false);
});

test('resolveEffectiveProfile: User-Override ohne globales Profil, aber mit exerciseType -> gültiges Profil', () => {
  const userNote = { isConfirmed: false, overrides: { exerciseType: 'power' } };
  const effective = resolveEffectiveProfile(null, userNote);
  assert.equal(effective.exerciseType, 'power');
});

test('resolveEffectiveProfile: Override ohne exerciseType (nur z.B. targetRepRange) -> weiterhin null (kein spezifisches Profil auswertbar)', () => {
  const userNote = { isConfirmed: true, overrides: { targetRepRange: { min: 5, max: 8 } } };
  const effective = resolveEffectiveProfile(null, userNote);
  assert.equal(effective, null);
});

// ---------------------------------------------------------------------------
// 4. Kap. 25: Notiz-Merge (persistent vs. session)
// ---------------------------------------------------------------------------
test('buildNoteContext: nur sessionNote -> persistent null', () => {
  const ctx = buildNoteContext({ sessionNote: 'heute schwer gefallen', userNote: null });
  assert.equal(ctx.session, 'heute schwer gefallen');
  assert.equal(ctx.persistent, null);
});

test('buildNoteContext: nur persistente (bestätigte) Notiz, keine Session-Notiz -> bleibt gültig', () => {
  const ctx = buildNoteContext({ sessionNote: null, userNote: { noteText: 'Knieproblem', isConfirmed: true } });
  assert.equal(ctx.session, null);
  assert.equal(ctx.persistent.text, 'Knieproblem');
  assert.equal(ctx.persistent.confirmed, true);
});

test('buildNoteContext: beide leer -> null (kein leeres Objekt)', () => {
  const ctx = buildNoteContext({ sessionNote: '   ', userNote: null });
  assert.equal(ctx, null);
});

// ---------------------------------------------------------------------------
// 5. Kap. 24: Null-Annahmen-Prinzip für Körpergewicht
// ---------------------------------------------------------------------------
test('structureAnalysisForAI: athleteBodyweightKg=null -> Feld fehlt komplett im Output', () => {
  const analyses = [analyzeExercise('Bankdrücken', { name: 'Bankdrücken', setDetails: [{ reps: 8, weight: 60, isWarmup: false }] })];
  const structured = structureAnalysisForAI(analyses, { athleteBodyweightKg: null });
  assert.equal('athlete_bodyweight_kg' in structured, false);
});

test('structureAnalysisForAI: athleteBodyweightKg gesetzt -> im Output vorhanden', () => {
  const analyses = [analyzeExercise('Bankdrücken', { name: 'Bankdrücken', setDetails: [{ reps: 8, weight: 60, isWarmup: false }] })];
  const structured = structureAnalysisForAI(analyses, { athleteBodyweightKg: 78 });
  assert.equal(structured.athlete_bodyweight_kg, 78);
});

test('structureAnalysisForAI ohne options-Parameter (alter Aufruf-Stil) funktioniert weiterhin', () => {
  const analyses = [analyzeExercise('Bankdrücken', { name: 'Bankdrücken', setDetails: [{ reps: 8, weight: 60, isWarmup: false }] })];
  const structured = structureAnalysisForAI(analyses);
  assert.equal('athlete_bodyweight_kg' in structured, false);
  assert.equal(structured.total_exercises_analyzed, 1);
});

// ---------------------------------------------------------------------------
// 6. Kap. 27-Vorstufe: Prompt enthält keine unbelegten Aussagen / respektiert profile_hint
// ---------------------------------------------------------------------------
test('buildPrompt: kein Körpergewicht-Abschnitt, wenn nicht gesetzt', () => {
  const provider = Object.create(OpenAIProvider.prototype);
  const prompt = provider.buildPrompt({
    total_exercises_analyzed: 0,
    progression_summary: { positive: 0, stable: 0, negative: 0 },
    top_improvements: [], top_declines: [], exercises: []
  });
  assert.equal(prompt.includes('Körpergewicht'), false);
});

test('buildPrompt: technique-Profil erscheint im Prompt-Text der Übung', () => {
  const provider = Object.create(OpenAIProvider.prototype);
  const prompt = provider.buildPrompt({
    total_exercises_analyzed: 1,
    progression_summary: { positive: 0, stable: 1, negative: 0 },
    top_improvements: [], top_declines: [],
    exercises: [{
      exercise: 'Handstand', current_weight: 0, current_reps: 0, current_volume: 0,
      progression: 'stable', period_description: '1 week', period_days: 7,
      changes: { weight_change_kg: 0, reps_change: 0, volume_change_percent: 0 },
      profile_hint: { exerciseType: 'technique', externalLoadRelevant: false, higherRepsAreProgress: true, trainingVolumeRelevant: false, targetRepRange: null }
    }]
  });
  assert.ok(prompt.includes('Typ "technique"'));
});

test('buildPrompt: bestätigte persistente Notiz erscheint getrennt von Session-Notiz', () => {
  const provider = Object.create(OpenAIProvider.prototype);
  const prompt = provider.buildPrompt({
    total_exercises_analyzed: 1,
    progression_summary: { positive: 1, stable: 0, negative: 0 },
    top_improvements: [], top_declines: [],
    exercises: [{
      exercise: 'Klimmzug', current_weight: 0, current_reps: 6, current_volume: 0,
      progression: 'positive', period_description: '1 week', period_days: 7,
      changes: { weight_change_kg: 0, reps_change: 1, volume_change_percent: 5 },
      note_context: { persistent: { text: 'Schulterproblem, vorsichtig steigern', confirmed: true }, session: null }
    }]
  });
  assert.ok(prompt.includes('Persönliche Notiz (bestätigt)'));
  assert.ok(prompt.includes('Schulterproblem'));
});

// ---------------------------------------------------------------------------
console.log(`\n${passed} bestanden, ${failed} fehlgeschlagen.`);
if (failed > 0) {
  process.exitCode = 1;
}
