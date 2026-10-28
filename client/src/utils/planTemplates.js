// Vorlagen für Trainingspläne (Absprache Paul 28.10.): Tage mit Übungen aus dem Katalog (IDs aus data/default-exercises.json).
// Jede Vorlage gibt es in zwei Stufen: Anfänger (Standard: geführte Maschinen, weniger Übungen und Sätze - die Maschine gibt
// die Bewegung vor, man muss nichts ausbalancieren) und Fortgeschritten (freie Gewichte, mehr Umfang). Ziel ist immer
// Muskelaufbau; nur die Sätze sind vorgegeben, Wiederholungen und Gewicht kommen wie bei jedem Workout aus dem Ziel bzw.
// dem letzten Mal. Beim Anlegen werden die Übungen direkt im Plan-Tag gespeichert (kein Favorit). Namen, Erklärungen und
// Tagbezeichnungen stehen in i18n (plans.templates.<id>.*, plans.dayLabel.<labelKey>).

export const PLAN_TEMPLATE_GOAL = 'hypertrophy'
export const PLAN_TEMPLATE_LEVELS = Object.freeze(['beginner', 'advanced'])
export const DEFAULT_PLAN_LEVEL = 'beginner'

const ex = (id, sets) => ({ id, sets })

export const PLAN_TEMPLATES = Object.freeze({
  ppl3: {
    id: 'ppl3',
    days: [
      {
        labelKey: 'pushA',
        type: 'push',
        levels: {
          beginner: [
          ex('ex_0577', 3), // lever chest press (weight stack)
          ex('ex_0603', 3), // lever shoulder press
          ex('ex_1299', 3), // lever incline chest press
          ex('ex_0584', 2), // lever lateral raise
          ex('ex_0607', 3), // lever triceps extension
          ],
          advanced: [
          ex('ex_0025', 4), // bench press barbell
          ex('ex_0314', 3), // dumbbell incline bench press
          ex('ex_0405', 3), // dumbbell seated shoulder press
          ex('ex_0178', 3), // cable lateral raise
          ex('ex_0200', 3), // cable pushdown (with rope attachment)
          ]
        }
      },
      {
        labelKey: 'pullA',
        type: 'pull',
        levels: {
          beginner: [
          ex('ex_0579', 3), // lever front pulldown
          ex('ex_1350', 3), // lever seated row
          ex('ex_0581', 2), // lever high row
          ex('ex_0602', 2), // reverse fly seated
          ex('ex_0575', 3), // lever bicep curl
          ],
          advanced: [
          ex('ex_0197', 3), // lat pulldown wide grip
          ex('ex_0027', 3), // barbell bent over row
          ex('ex_0861', 3), // cable seated row
          ex('ex_0203', 3), // cable rear delt row (with rope)
          ex('ex_0031', 3), // barbell curl
          ]
        }
      },
      {
        labelKey: 'legsA',
        type: 'legs',
        levels: {
          beginner: [
          ex('ex_0739', 3), // sled 45° leg press
          ex('ex_0585', 3), // leg extension
          ex('ex_0599', 3), // lever seated leg curl
          ex('ex_2286', 2), // lever hip extension v. 2
          ex('ex_0594', 3), // lever seated calf raise
          ],
          advanced: [
          ex('ex_1436', 4), // barbell high bar squat
          ex('ex_0085', 3), // barbell romanian deadlift
          ex('ex_0739', 3), // sled 45° leg press
          ex('ex_0586', 3), // lever lying leg curl
          ex('ex_0594', 4), // lever seated calf raise
          ]
        }
      },
    ]
  },
  ppl6: {
    id: 'ppl6',
    days: [
      {
        labelKey: 'pushA',
        type: 'push',
        levels: {
          beginner: [
          ex('ex_0577', 3), // lever chest press (weight stack)
          ex('ex_0603', 3), // lever shoulder press
          ex('ex_1299', 3), // lever incline chest press
          ex('ex_0584', 2), // lever lateral raise
          ex('ex_0607', 3), // lever triceps extension
          ],
          advanced: [
          ex('ex_0025', 4), // bench press barbell
          ex('ex_0314', 3), // dumbbell incline bench press
          ex('ex_0405', 3), // dumbbell seated shoulder press
          ex('ex_0178', 3), // cable lateral raise
          ex('ex_0200', 3), // cable pushdown (with rope attachment)
          ]
        }
      },
      {
        labelKey: 'pullA',
        type: 'pull',
        levels: {
          beginner: [
          ex('ex_0579', 3), // lever front pulldown
          ex('ex_1350', 3), // lever seated row
          ex('ex_0581', 2), // lever high row
          ex('ex_0602', 2), // reverse fly seated
          ex('ex_0575', 3), // lever bicep curl
          ],
          advanced: [
          ex('ex_0197', 3), // lat pulldown wide grip
          ex('ex_0027', 3), // barbell bent over row
          ex('ex_0861', 3), // cable seated row
          ex('ex_0203', 3), // cable rear delt row (with rope)
          ex('ex_0031', 3), // barbell curl
          ]
        }
      },
      {
        labelKey: 'legsA',
        type: 'legs',
        levels: {
          beginner: [
          ex('ex_0739', 3), // sled 45° leg press
          ex('ex_0585', 3), // leg extension
          ex('ex_0599', 3), // lever seated leg curl
          ex('ex_2286', 2), // lever hip extension v. 2
          ex('ex_0594', 3), // lever seated calf raise
          ],
          advanced: [
          ex('ex_1436', 4), // barbell high bar squat
          ex('ex_0085', 3), // barbell romanian deadlift
          ex('ex_0739', 3), // sled 45° leg press
          ex('ex_0586', 3), // lever lying leg curl
          ex('ex_0594', 4), // lever seated calf raise
          ]
        }
      },
      {
        labelKey: 'pushB',
        type: 'push',
        levels: {
          beginner: [
          ex('ex_0576', 3), // lever chest press (plate loaded)
          ex('ex_1479', 3), // lever incline chest press v. 2
          ex('ex_0869', 3), // lever shoulder press v. 2
          ex('ex_0178', 2), // cable lateral raise
          ex('ex_0200', 3), // cable pushdown (with rope attachment)
          ],
          advanced: [
          ex('ex_0047', 4), // barbell incline bench press
          ex('ex_0289', 3), // dumbbell bench press
          ex('ex_0091', 3), // barbell seated overhead press
          ex('ex_0334', 3), // dumbbell lateral raise
          ex('ex_0241', 3), // cable triceps pushdown (v-bar)
          ]
        }
      },
      {
        labelKey: 'pullB',
        type: 'pull',
        levels: {
          beginner: [
          ex('ex_0017', 3), // assisted pull-up
          ex('ex_0588', 3), // lever narrow grip seated row
          ex('ex_0198', 3), // cable pulldown
          ex('ex_0604', 2), // lever shrug
          ex('ex_1641', 3), // cable seated curl
          ],
          advanced: [
          ex('ex_1326', 3), // chin-up
          ex('ex_0293', 3), // dumbbell bent over row
          ex('ex_0198', 3), // cable pulldown
          ex('ex_0406', 3), // dumbbell shrug
          ex('ex_0294', 3), // dumbbell biceps curl
          ]
        }
      },
      {
        labelKey: 'legsB',
        type: 'legs',
        levels: {
          beginner: [
          ex('ex_0770', 3), // smith squat
          ex('ex_0586', 3), // lever lying leg curl
          ex('ex_0740', 3), // sled 45° leg wide press
          ex('ex_0605', 3), // lever standing calf raise
          ex('ex_0175', 2), // cable kneeling crunch
          ],
          advanced: [
          ex('ex_0336', 3), // dumbbell lunge
          ex('ex_0585', 3), // leg extension
          ex('ex_1409', 3), // barbell glute bridge
          ex('ex_0599', 3), // lever seated leg curl
          ex('ex_1372', 4), // barbell standing calf raise
          ex('ex_0472', 3), // hanging leg raise
          ]
        }
      },
    ]
  },
  ul4: {
    id: 'ul4',
    days: [
      {
        labelKey: 'upperA',
        type: 'fullbody',
        levels: {
          beginner: [
          ex('ex_0577', 3), // lever chest press (weight stack)
          ex('ex_1350', 3), // lever seated row
          ex('ex_0603', 3), // lever shoulder press
          ex('ex_0579', 3), // lever front pulldown
          ex('ex_0607', 2), // lever triceps extension
          ex('ex_0575', 2), // lever bicep curl
          ],
          advanced: [
          ex('ex_0025', 4), // bench press barbell
          ex('ex_0027', 4), // barbell bent over row
          ex('ex_0405', 3), // dumbbell seated shoulder press
          ex('ex_0197', 3), // lat pulldown wide grip
          ex('ex_0200', 3), // cable pushdown (with rope attachment)
          ex('ex_0031', 3), // barbell curl
          ]
        }
      },
      {
        labelKey: 'lowerA',
        type: 'fullbody',
        levels: {
          beginner: [
          ex('ex_0739', 3), // sled 45° leg press
          ex('ex_0599', 3), // lever seated leg curl
          ex('ex_0585', 3), // leg extension
          ex('ex_0605', 3), // lever standing calf raise
          ex('ex_0175', 2), // cable kneeling crunch
          ],
          advanced: [
          ex('ex_1436', 4), // barbell high bar squat
          ex('ex_0085', 3), // barbell romanian deadlift
          ex('ex_0739', 3), // sled 45° leg press
          ex('ex_0586', 3), // lever lying leg curl
          ex('ex_0594', 4), // lever seated calf raise
          ex('ex_0472', 3), // hanging leg raise
          ]
        }
      },
      {
        labelKey: 'upperB',
        type: 'fullbody',
        levels: {
          beginner: [
          ex('ex_1299', 3), // lever incline chest press
          ex('ex_0017', 3), // assisted pull-up
          ex('ex_0602', 2), // reverse fly seated
          ex('ex_0581', 3), // lever high row
          ex('ex_0178', 2), // cable lateral raise
          ex('ex_0200', 2), // cable pushdown (with rope attachment)
          ],
          advanced: [
          ex('ex_0314', 3), // dumbbell incline bench press
          ex('ex_0652', 3), // pull-up
          ex('ex_0334', 3), // dumbbell lateral raise
          ex('ex_0861', 3), // cable seated row
          ex('ex_0596', 3), // lever seated fly
          ex('ex_0313', 3), // dumbbell hammer curl
          ]
        }
      },
      {
        labelKey: 'lowerB',
        type: 'fullbody',
        levels: {
          beginner: [
          ex('ex_0770', 3), // smith squat
          ex('ex_2286', 3), // lever hip extension v. 2
          ex('ex_0586', 3), // lever lying leg curl
          ex('ex_0738', 3), // sled 45° calf press
          ex('ex_0274', 2), // crunch floor
          ],
          advanced: [
          ex('ex_1409', 3), // barbell glute bridge
          ex('ex_0336', 3), // dumbbell lunge
          ex('ex_0585', 3), // leg extension
          ex('ex_0599', 3), // lever seated leg curl
          ex('ex_1372', 4), // barbell standing calf raise
          ex('ex_0274', 3), // crunch floor
          ]
        }
      },
    ]
  },
  fb3: {
    id: 'fb3',
    days: [
      {
        labelKey: 'fullA',
        type: 'fullbody',
        levels: {
          beginner: [
          ex('ex_0739', 3), // sled 45° leg press
          ex('ex_0577', 3), // lever chest press (weight stack)
          ex('ex_1350', 3), // lever seated row
          ex('ex_0603', 2), // lever shoulder press
          ex('ex_0274', 2), // crunch floor
          ],
          advanced: [
          ex('ex_1436', 3), // barbell high bar squat
          ex('ex_0025', 3), // bench press barbell
          ex('ex_0027', 3), // barbell bent over row
          ex('ex_0405', 3), // dumbbell seated shoulder press
          ex('ex_0472', 3), // hanging leg raise
          ]
        }
      },
      {
        labelKey: 'fullB',
        type: 'fullbody',
        levels: {
          beginner: [
          ex('ex_2286', 3), // lever hip extension v. 2
          ex('ex_1299', 3), // lever incline chest press
          ex('ex_0579', 3), // lever front pulldown
          ex('ex_0585', 2), // leg extension
          ex('ex_0575', 2), // lever bicep curl
          ex('ex_0607', 2), // lever triceps extension
          ],
          advanced: [
          ex('ex_0085', 3), // barbell romanian deadlift
          ex('ex_0314', 3), // dumbbell incline bench press
          ex('ex_0197', 3), // lat pulldown wide grip
          ex('ex_0336', 3), // dumbbell lunge
          ex('ex_0294', 2), // dumbbell biceps curl
          ex('ex_0200', 2), // cable pushdown (with rope attachment)
          ]
        }
      },
      {
        labelKey: 'fullC',
        type: 'fullbody',
        levels: {
          beginner: [
          ex('ex_0770', 3), // smith squat
          ex('ex_0493', 3), // incline push-up
          ex('ex_0861', 3), // cable seated row
          ex('ex_0178', 2), // cable lateral raise
          ex('ex_0599', 3), // lever seated leg curl
          ex('ex_0175', 2), // cable kneeling crunch
          ],
          advanced: [
          ex('ex_0739', 3), // sled 45° leg press
          ex('ex_0662', 3), // push-up
          ex('ex_0861', 3), // cable seated row
          ex('ex_0334', 3), // dumbbell lateral raise
          ex('ex_0586', 3), // lever lying leg curl
          ex('ex_0274', 3), // crunch floor
          ]
        }
      },
    ]
  },
})

export const PLAN_TEMPLATE_IDS = Object.freeze(Object.keys(PLAN_TEMPLATES))
