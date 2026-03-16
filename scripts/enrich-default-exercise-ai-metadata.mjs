import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');

const files = [
  path.join(repoRoot, 'client/public/data/default-exercises.json'),
  path.join(repoRoot, 'client/src/data/default-exercises.json')
];

const hasAny = (text, terms) => terms.some((term) => text.includes(term));

const normalizeDifficulty = (value) => {
  const raw = String(value || '').toLowerCase();
  if (raw.includes('advanced') || raw.includes('fortgeschritten')) return 'advanced';
  if (raw.includes('intermediate') || raw.includes('mittel')) return 'intermediate';
  return 'beginner';
};

function inferMetadata(exercise = {}) {
  const name = String(exercise.name || '').toLowerCase();
  const category = String(exercise.category || '').toLowerCase();
  const categoryRaw = String(exercise.category_raw || '').toLowerCase();
  const target = String(exercise.target || '').toLowerCase();
  const muscle = String(exercise.muscleGroup_en || exercise.muscleGroup || '').toLowerCase();
  const equipment = String(exercise.equipment_en || exercise.equipment || '').toLowerCase();

  const isMobility = categoryRaw.includes('stretch') || hasAny(name, ['stretch', 'dehnen', 'mobility']);
  const isCore = category === 'core' || hasAny(target, ['abs', 'oblique', 'core']) || hasAny(muscle, ['abs', 'oblique', 'core']);
  const isIsolation = hasAny(muscle, ['biceps', 'triceps', 'calves', 'forearm', 'adductor', 'abductor', 'rear delt'])
    || hasAny(target, ['biceps', 'triceps', 'calves', 'adductor', 'abductor']);

  let exerciseType = 'compound';
  if (isMobility) exerciseType = 'mobility';
  else if (isCore) exerciseType = 'core';
  else if (isIsolation) exerciseType = 'isolation';

  let primaryPhase = 'secondary';
  if (exerciseType === 'mobility') primaryPhase = 'warmup';
  else if (exerciseType === 'core') primaryPhase = 'core';
  else if (exerciseType === 'isolation') primaryPhase = 'accessory';
  else primaryPhase = 'main';

  let minDifficulty = normalizeDifficulty(exercise.difficulty);
  if (hasAny(name, ['handstand', 'muscle-up', 'planche', 'pistol squat'])) {
    minDifficulty = 'advanced';
  }

  const isBodyweight = hasAny(equipment, ['body weight', 'bodyweight', 'koerpergewicht', 'körpergewicht']);
  const needsGym = hasAny(equipment, ['machine', 'cable', 'barbell', 'dumbbell', 'kettlebell', 'smith', 'lever']);

  let allowedEquipmentModes = ['gym_only', 'gym_plus_bodyweight', 'bodyweight_only'];
  if (needsGym && !isBodyweight) {
    allowedEquipmentModes = ['gym_only', 'gym_plus_bodyweight'];
  }

  const disallowedGoals = exerciseType === 'mobility' ? ['strength', 'hypertrophy'] : [];

  return {
    exerciseType,
    primaryPhase,
    minDifficulty,
    disallowedGoals,
    allowedEquipmentModes
  };
}

for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected array in ${file}`);
  }

  const enriched = parsed.map((entry) => ({
    ...entry,
    aiMetadata: inferMetadata(entry)
  }));

  fs.writeFileSync(file, `${JSON.stringify(enriched, null, 2)}\n`, 'utf8');
  console.log(`Updated ${file} with ${enriched.length} entries`);
}
