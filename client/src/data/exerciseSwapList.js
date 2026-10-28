// Austausch-Liste (Absprache Paul 28.10., Version 2): Ersatz-Vorschläge für die Grundübungen, Einsteiger-freundlich zuerst.
// Bei freien Gewichten (Lang-/Kurzhantel) stehen geführte Maschinen vorn: die Maschine gibt die Bewegung vor, man muss
// nichts ausbalancieren. Alle Namen sind englische Katalognamen (`name_en`); Test: exerciseSwaps.test.js prüft sie gegen den Katalog.
export const CURATED_SWAPS = Object.freeze({
  // Brust
  'bench press barbell': ['lever chest press (weight stack)', 'lever chest press (plate loaded)', 'lever incline chest press', 'smith bench press', 'dumbbell bench press', 'push-up'],
  'barbell incline bench press': ['lever incline chest press', 'lever incline chest press v. 2', 'smith incline bench press', 'dumbbell incline bench press', 'incline push-up'],
  'dumbbell bench press': ['lever chest press (weight stack)', 'lever chest press (plate loaded)', 'cable seated chest press', 'smith bench press', 'push-up'],
  'dumbbell incline bench press': ['lever incline chest press', 'lever incline chest press v. 2', 'cable incline bench press', 'smith incline bench press', 'incline push-up'],
  'dumbbell fly': ['lever seated fly', 'cable standing fly', 'cable low fly'],
  'push-up': ['incline push-up', 'close-grip push-up (on knees)', 'lever chest press (weight stack)', 'lever standing chest press'],
  // Schulter
  'barbell seated overhead press': ['lever shoulder press', 'lever shoulder press v. 2', 'smith seated shoulder press', 'dumbbell seated shoulder press'],
  'dumbbell seated shoulder press': ['lever shoulder press', 'lever shoulder press v. 2', 'smith seated shoulder press', 'cable shoulder press'],
  'dumbbell lateral raise': ['lever lateral raise', 'cable lateral raise'],
  'cable rear delt row (with rope)': ['reverse fly seated', 'reverse fly seated parallel grip', 'cable seated rear lateral raise'],
  // Trizeps
  'cable pushdown (with rope attachment)': ['cable triceps pushdown (v-bar)', 'lever triceps extension', 'cable one arm tricep pushdown', 'lever seated dip'],
  'cable triceps pushdown (v-bar)': ['cable pushdown (with rope attachment)', 'lever triceps extension', 'cable one arm tricep pushdown'],
  'cable overhead triceps extension (rope attachment)': ['lever triceps extension', 'cable pushdown (with rope attachment)', 'barbell standing overhead triceps extension'],
  // Rücken
  'barbell bent over row': ['lever seated row', 'lever narrow grip seated row', 'lever high row', 'cable seated row', 'smith narrow row', 'dumbbell bent over row'],
  'dumbbell bent over row': ['lever seated row', 'lever unilateral row', 'lever high row', 'cable seated row', 'smith narrow row'],
  'cable seated row': ['lever seated row', 'lever narrow grip seated row', 'lever high row', 'lever t bar row'],
  'lat pulldown wide grip': ['lever front pulldown', 'assisted pull-up', 'cable pulldown', 'twin handle parallel grip lat pulldown'],
  'pull-up': ['assisted pull-up', 'assisted standing pull-up', 'lever front pulldown', 'lat pulldown wide grip'],
  'chin-up': ['assisted pull-up', 'assisted standing pull-up', 'reverse grip machine lat pulldown', 'lat pulldown wide grip'],
  'dumbbell shrug': ['lever shrug', 'smith shrug', 'cable shrug'],
  // Bizeps
  'barbell curl': ['lever bicep curl', 'lever preacher curl', 'cable seated curl', 'ez barbell curl', 'dumbbell biceps curl'],
  'dumbbell biceps curl': ['lever bicep curl', 'lever preacher curl', 'cable seated curl', 'dumbbell seated curl'],
  'dumbbell hammer curl': ['lever hammer grip preacher curl', 'cable hammer curl (with rope)', 'dumbbell cross body hammer curl'],
  // Beine
  'barbell high bar squat': ['sled 45° leg press', 'sled lying squat', 'smith squat', 'smith full squat', 'dumbbell goblet squat'],
  'barbell romanian deadlift': ['lever deadlift', 'lever hip extension v. 2', 'cable deadlift', 'dumbbell romanian deadlift'],
  'sled 45° leg press': ['sled 45° leg wide press', 'smith leg press', 'leg extension', 'dumbbell goblet squat'],
  'dumbbell lunge': ['sled 45° leg press', 'smith squat', 'dumbbell step-up', 'dumbbell single leg split squat'],
  'leg extension': ['sled 45° leg press', 'smith chair squat', 'dumbbell goblet squat'],
  'lever lying leg curl': ['lever seated leg curl', 'lever kneeling leg curl', 'dumbbell romanian deadlift'],
  'barbell standing calf raise': ['lever standing calf raise', 'lever seated calf raise', 'sled 45° calf press', 'bodyweight standing calf raise'],
  'barbell glute bridge': ['lever hip extension v. 2', 'lever reverse hyperextension', 'glute bridge two legs on bench (male)', 'low glute bridge on floor'],
  // Bauch
  'hanging leg raise': ['lying leg raise flat bench', 'captains chair straight leg raise', 'crunch floor'],
  'crunch floor': ['cable kneeling crunch', 'decline crunch', 'sit-up v. 2'],
})
