// Vorlagen für Trainingspläne (Absprache Paul 28.10.): Tage mit Übungen aus dem Katalog (IDs aus data/default-exercises.json).
// Ziel ist immer Muskelaufbau; nur die Sätze sind vorgegeben, Wiederholungen und Gewicht kommen wie bei jedem Workout aus
// dem Ziel bzw. dem letzten Mal. Die Übungen sind Vorschläge für den Einstieg und lassen sich je Tag im Favoriten ändern.
// Beim Anlegen entstehen aus jedem Tag ein Favorit (Typ = type) und ein Plan-Tag, der darauf verweist. Namen und
// Tagbezeichnungen stehen in i18n (plans.templates.<id>.*, plans.dayLabel.<labelKey>).

export const PLAN_TEMPLATE_GOAL = 'hypertrophy'

export const PLAN_TEMPLATES = Object.freeze({
  ppl3: {
    id: 'ppl3',
    days: [
      {
        labelKey: 'pushA',
        type: 'push',
        exercises: [
          { id: 'ex_0025', sets: 4 }, // bench press barbell
          { id: 'ex_0314', sets: 3 }, // dumbbell incline bench press
          { id: 'ex_0405', sets: 3 }, // dumbbell seated shoulder press
          { id: 'ex_0178', sets: 3 }, // cable lateral raise
          { id: 'ex_0200', sets: 3 }, // cable pushdown (with rope attachment)
        ]
      },
      {
        labelKey: 'pullA',
        type: 'pull',
        exercises: [
          { id: 'ex_0197', sets: 3 }, // lat pulldown wide grip
          { id: 'ex_0027', sets: 3 }, // barbell bent over row
          { id: 'ex_0861', sets: 3 }, // cable seated row
          { id: 'ex_0203', sets: 3 }, // cable rear delt row (with rope)
          { id: 'ex_0031', sets: 3 }, // barbell curl
        ]
      },
      {
        labelKey: 'legsA',
        type: 'legs',
        exercises: [
          { id: 'ex_1436', sets: 4 }, // barbell high bar squat
          { id: 'ex_0085', sets: 3 }, // barbell romanian deadlift
          { id: 'ex_0739', sets: 3 }, // sled 45° leg press
          { id: 'ex_0586', sets: 3 }, // lever lying leg curl
          { id: 'ex_0594', sets: 4 }, // lever seated calf raise
        ]
      },
    ]
  },
  ppl6: {
    id: 'ppl6',
    days: [
      {
        labelKey: 'pushA',
        type: 'push',
        exercises: [
          { id: 'ex_0025', sets: 4 }, // bench press barbell
          { id: 'ex_0314', sets: 3 }, // dumbbell incline bench press
          { id: 'ex_0405', sets: 3 }, // dumbbell seated shoulder press
          { id: 'ex_0178', sets: 3 }, // cable lateral raise
          { id: 'ex_0200', sets: 3 }, // cable pushdown (with rope attachment)
        ]
      },
      {
        labelKey: 'pullA',
        type: 'pull',
        exercises: [
          { id: 'ex_0197', sets: 3 }, // lat pulldown wide grip
          { id: 'ex_0027', sets: 3 }, // barbell bent over row
          { id: 'ex_0861', sets: 3 }, // cable seated row
          { id: 'ex_0203', sets: 3 }, // cable rear delt row (with rope)
          { id: 'ex_0031', sets: 3 }, // barbell curl
        ]
      },
      {
        labelKey: 'legsA',
        type: 'legs',
        exercises: [
          { id: 'ex_1436', sets: 4 }, // barbell high bar squat
          { id: 'ex_0085', sets: 3 }, // barbell romanian deadlift
          { id: 'ex_0739', sets: 3 }, // sled 45° leg press
          { id: 'ex_0586', sets: 3 }, // lever lying leg curl
          { id: 'ex_0594', sets: 4 }, // lever seated calf raise
        ]
      },
      {
        labelKey: 'pushB',
        type: 'push',
        exercises: [
          { id: 'ex_0047', sets: 4 }, // barbell incline bench press
          { id: 'ex_0289', sets: 3 }, // dumbbell bench press
          { id: 'ex_0091', sets: 3 }, // barbell seated overhead press
          { id: 'ex_0334', sets: 3 }, // dumbbell lateral raise
          { id: 'ex_0241', sets: 3 }, // cable triceps pushdown (v-bar)
        ]
      },
      {
        labelKey: 'pullB',
        type: 'pull',
        exercises: [
          { id: 'ex_1326', sets: 3 }, // chin-up
          { id: 'ex_0293', sets: 3 }, // dumbbell bent over row
          { id: 'ex_0198', sets: 3 }, // cable pulldown
          { id: 'ex_0406', sets: 3 }, // dumbbell shrug
          { id: 'ex_0294', sets: 3 }, // dumbbell biceps curl
        ]
      },
      {
        labelKey: 'legsB',
        type: 'legs',
        exercises: [
          { id: 'ex_0336', sets: 3 }, // dumbbell lunge
          { id: 'ex_0585', sets: 3 }, // leg extension
          { id: 'ex_1409', sets: 3 }, // barbell glute bridge
          { id: 'ex_0599', sets: 3 }, // lever seated leg curl
          { id: 'ex_1372', sets: 4 }, // barbell standing calf raise
          { id: 'ex_0472', sets: 3 }, // hanging leg raise
        ]
      },
    ]
  },
  ul4: {
    id: 'ul4',
    days: [
      {
        labelKey: 'upperA',
        type: 'fullbody',
        exercises: [
          { id: 'ex_0025', sets: 4 }, // bench press barbell
          { id: 'ex_0027', sets: 4 }, // barbell bent over row
          { id: 'ex_0405', sets: 3 }, // dumbbell seated shoulder press
          { id: 'ex_0197', sets: 3 }, // lat pulldown wide grip
          { id: 'ex_0200', sets: 3 }, // cable pushdown (with rope attachment)
          { id: 'ex_0031', sets: 3 }, // barbell curl
        ]
      },
      {
        labelKey: 'lowerA',
        type: 'fullbody',
        exercises: [
          { id: 'ex_1436', sets: 4 }, // barbell high bar squat
          { id: 'ex_0085', sets: 3 }, // barbell romanian deadlift
          { id: 'ex_0739', sets: 3 }, // sled 45° leg press
          { id: 'ex_0586', sets: 3 }, // lever lying leg curl
          { id: 'ex_0594', sets: 4 }, // lever seated calf raise
          { id: 'ex_0472', sets: 3 }, // hanging leg raise
        ]
      },
      {
        labelKey: 'upperB',
        type: 'fullbody',
        exercises: [
          { id: 'ex_0314', sets: 3 }, // dumbbell incline bench press
          { id: 'ex_0652', sets: 3 }, // pull-up
          { id: 'ex_0334', sets: 3 }, // dumbbell lateral raise
          { id: 'ex_0861', sets: 3 }, // cable seated row
          { id: 'ex_0596', sets: 3 }, // lever seated fly
          { id: 'ex_0313', sets: 3 }, // dumbbell hammer curl
        ]
      },
      {
        labelKey: 'lowerB',
        type: 'fullbody',
        exercises: [
          { id: 'ex_1409', sets: 3 }, // barbell glute bridge
          { id: 'ex_0336', sets: 3 }, // dumbbell lunge
          { id: 'ex_0585', sets: 3 }, // leg extension
          { id: 'ex_0599', sets: 3 }, // lever seated leg curl
          { id: 'ex_1372', sets: 4 }, // barbell standing calf raise
          { id: 'ex_0274', sets: 3 }, // crunch floor
        ]
      },
    ]
  },
  fb3: {
    id: 'fb3',
    days: [
      {
        labelKey: 'fullA',
        type: 'fullbody',
        exercises: [
          { id: 'ex_1436', sets: 3 }, // barbell high bar squat
          { id: 'ex_0025', sets: 3 }, // bench press barbell
          { id: 'ex_0027', sets: 3 }, // barbell bent over row
          { id: 'ex_0405', sets: 3 }, // dumbbell seated shoulder press
          { id: 'ex_0472', sets: 3 }, // hanging leg raise
        ]
      },
      {
        labelKey: 'fullB',
        type: 'fullbody',
        exercises: [
          { id: 'ex_0085', sets: 3 }, // barbell romanian deadlift
          { id: 'ex_0314', sets: 3 }, // dumbbell incline bench press
          { id: 'ex_0197', sets: 3 }, // lat pulldown wide grip
          { id: 'ex_0336', sets: 3 }, // dumbbell lunge
          { id: 'ex_0294', sets: 2 }, // dumbbell biceps curl
          { id: 'ex_0200', sets: 2 }, // cable pushdown (with rope attachment)
        ]
      },
      {
        labelKey: 'fullC',
        type: 'fullbody',
        exercises: [
          { id: 'ex_0739', sets: 3 }, // sled 45° leg press
          { id: 'ex_0662', sets: 3 }, // push-up
          { id: 'ex_0861', sets: 3 }, // cable seated row
          { id: 'ex_0334', sets: 3 }, // dumbbell lateral raise
          { id: 'ex_0586', sets: 3 }, // lever lying leg curl
          { id: 'ex_0274', sets: 3 }, // crunch floor
        ]
      },
    ]
  },
})

export const PLAN_TEMPLATE_IDS = Object.freeze(Object.keys(PLAN_TEMPLATES))
