// Freitext-Einstieg, Schritt 2: Synonymtabelle (Deutsch/Englisch/Slang -> Katalogübung).
//
// Der Katalog (client/public/data/default-exercises.json) hat englische Namen und eine maschinell übersetzte deutsche
// Fassung; "Latzug", "Seitheben" oder "Trizeps Pushdown" findet die normale Suche deshalb nicht verlässlich. Diese
// Tabelle ist die kuratierte Brücke. Jede Zeile = ein Begriff aus Nutzersicht ("Konzept") mit seinen Schreibweisen und den
// Katalogübungen, auf die er zeigen darf.
//
//   keys    Schreibweisen (klein, Umlaute egal, Mehrzahl egal). Ein Eintrag kann Merkmale "mitbringen":
//           { key: 'schrägbankdrücken', implies: ['incline'] }
//   targets Katalogübungen (name_en MUSS im Katalog stehen - der Test prüft das) mit Merkmalen (tags).
//           Das erste Ziel ist die Standardwahl.
//   ask     true: Ohne Angabe des Geräts/der Variante nicht raten, sondern nachfragen (Auswahl-Chips).
//   suggest Nur Vorschläge ("Meintest du ...?"), nie automatisch gewählt (Übung fehlt im Katalog, Näherung ist nicht gleich).
//
// Merkmale: barbell dumbbell cable machine smith ez bodyweight band | incline decline flat seated standing lying kneeling |
//           wide close reverse parallel | weighted assisted | onearm rope
// optional (opt): wird nur gewählt, wenn der Nutzer ein passendes Merkmal nennt, nie als Standard.
const t = (name, ...tags) => ({ name, tags })
// Nur wählbar, wenn der Nutzer ein passendes Merkmal nennt (Zusatzgewicht, assistiert, eng ...) - nie als Standard.
const opt = (name, ...tags) => ({ name, tags, optional: true })

export const SYNONYMS = [
  {
    id: 'bench_press',
    keys: ['bankdrücken', 'bank drücken', 'flachbankdrücken', 'bench press', 'bench', 'bankdruecken',
      { key: 'schrägbankdrücken', implies: ['incline'] }, { key: 'schrägbank', implies: ['incline'] }, { key: 'incline bench press', implies: ['incline'] },
      { key: 'incline press', implies: ['incline'] }, { key: 'incline bench', implies: ['incline'] }],
    targets: [
      t('bench press barbell', 'barbell', 'flat'),
      t('dumbbell bench press', 'dumbbell', 'flat'),
      t('barbell incline bench press', 'barbell', 'incline'),
      t('dumbbell incline bench press', 'dumbbell', 'incline')
    ]
  },
  {
    id: 'chest_press',
    keys: ['brustpresse', 'chest press', 'chestpress', 'brustdrücken maschine'],
    targets: [t('lever chest press (weight stack)', 'machine')]
  },
  {
    id: 'squat',
    keys: ['kniebeuge', 'kniebeugen', 'squat', 'squats', 'back squat', 'kb'],
    targets: [
      t('barbell high bar squat', 'barbell'),
      t('barbell low bar squat', 'barbell', 'lowbar'),
      t('dumbbell squat', 'dumbbell'),
      t('bodyweight squat', 'bodyweight'),
      t('smith squat', 'smith')
    ]
  },
  { id: 'front_squat', keys: ['frontkniebeuge', 'front squat', 'frontsquat'], targets: [t('front squat barbell', 'barbell')] },
  { id: 'goblet_squat', keys: ['goblet squat', 'goblet kniebeuge', 'goblet'], targets: [t('dumbbell goblet squat', 'dumbbell')] },
  {
    id: 'hack_squat',
    keys: ['hackenschmidt', 'hack squat', 'hacksquat', 'hackenschmidt kniebeuge'],
    targets: [t('sled hack squat', 'machine'), t('barbell hack squat', 'barbell')]
  },
  {
    id: 'split_squat',
    keys: ['bulgarian split squat', 'bulgarische kniebeuge', 'split squat', 'bulgarian'],
    targets: [t('dumbbell single leg split squat', 'dumbbell'), t('barbell single leg split squat', 'barbell')]
  },
  {
    id: 'deadlift',
    keys: ['kreuzheben', 'deadlift', 'deadlifts', 'kh heben'],
    targets: [t('barbell deadlift', 'barbell'), t('dumbbell deadlift', 'dumbbell')]
  },
  {
    id: 'romanian_deadlift',
    keys: ['rumänisches kreuzheben', 'rumaenisches kreuzheben', 'romanian deadlift', 'rdl', 'rumänisches'],
    targets: [t('barbell romanian deadlift', 'barbell'), t('dumbbell romanian deadlift', 'dumbbell')]
  },
  { id: 'sumo_deadlift', keys: ['sumo kreuzheben', 'sumo deadlift', 'sumo'], targets: [t('barbell sumo deadlift', 'barbell')] },
  { id: 'trap_bar_deadlift', keys: ['trap bar kreuzheben', 'trap bar deadlift', 'hex bar kreuzheben'], targets: [t('trap bar deadlift', 'barbell')] },
  { id: 'good_morning', keys: ['good morning', 'good mornings', 'guten morgen'], targets: [t('barbell good morning', 'barbell')] },
  {
    id: 'shoulder_press',
    ask: true,
    keys: ['schulterdrücken', 'schulterdruecken', 'schulterpresse', 'shoulder press', 'schulter drücken',
      { key: 'overhead press', implies: ['standing'] }, { key: 'ohp', implies: ['standing'] }, { key: 'military press', implies: ['standing'] }, { key: 'militärdrücken', implies: ['standing'] }],
    targets: [
      t('dumbbell seated shoulder press', 'dumbbell', 'seated'),
      t('lever shoulder press', 'machine', 'seated'),
      t('barbell seated overhead press', 'barbell', 'seated'),
      t('smith shoulder press', 'smith'),
      t('barbell standing wide military press', 'barbell', 'standing')
    ]
  },
  {
    id: 'row',
    ask: true,
    keys: ['rudern', 'row', 'rows'],
    targets: [
      t('barbell bent over row', 'barbell'),
      t('dumbbell one arm bent-over row', 'dumbbell', 'onearm'),
      t('cable seated row', 'cable', 'seated'),
      t('lever seated row', 'machine', 'seated')
    ]
  },
  { id: 'barbell_row', keys: ['langhantelrudern', 'bent over row', 'vorgebeugtes rudern', 'barbell row'], targets: [t('barbell bent over row', 'barbell')] },
  {
    id: 'cable_row',
    keys: ['kabelrudern', 'seated row', 'sitzendes rudern', 'rudern am kabel', 'cable row', 'rudern sitzend', 'rudern kabel'],
    targets: [t('cable seated row', 'cable', 'seated'), t('lever seated row', 'machine', 'seated')]
  },
  {
    id: 'one_arm_row',
    keys: ['kurzhantelrudern', 'einarmiges rudern', 'one arm row', 'single arm row', 'dumbbell row'],
    targets: [t('dumbbell one arm bent-over row', 'dumbbell', 'onearm')]
  },
  { id: 't_bar_row', keys: ['t bar rudern', 't-bar row', 't bar row', 't-bar rudern'], targets: [t('lever t bar row', 'machine')] },
  {
    id: 'lat_pulldown',
    keys: ['latzug', 'lat pulldown', 'latziehen', 'lat pull down', 'lat pulldowns', 'latissimuszug', 'breiter latzug'],
    targets: [
      t('lat pulldown wide grip', 'cable', 'wide'),
      t('cable lateral pulldown with v-bar', 'cable', 'close'),
      t('reverse grip machine lat pulldown', 'machine', 'reverse'),
      t('twin handle parallel grip lat pulldown', 'machine', 'parallel')
    ]
  },
  {
    id: 'pull_up',
    keys: ['klimmzug', 'klimmzüge', 'pull up', 'pull ups', 'pullup', 'pullups', 'pull-up', 'klimmzuege'],
    targets: [t('pull-up', 'bodyweight'), opt('weighted pull-up', 'weighted'), opt('assisted pull-up', 'assisted')]
  },
  { id: 'chin_up', keys: ['chin up', 'chin ups', 'chinup', 'chin-up', 'untergriff klimmzug', 'klimmzug untergriff'], targets: [t('chin-up', 'bodyweight')] },
  {
    id: 'dips',
    keys: ['dips', 'dip', 'barrenstütz', 'barrendips', 'brustdips'],
    targets: [t('chest dip', 'bodyweight'), t('triceps dip', 'bodyweight', 'bench')]
  },
  { id: 'triceps_dips', keys: ['trizeps dips', 'bank dips', 'trizepsdips', 'bench dips'], targets: [t('triceps dip', 'bodyweight')] },
  {
    id: 'biceps_curl',
    keys: ['bizepscurl', 'bizeps curl', 'bizepscurls', 'bizeps curls', 'curl', 'curls', 'biceps curl', 'bicep curl', 'armcurl', 'curlen', 'bizeps'],
    targets: [
      t('dumbbell biceps curl', 'dumbbell'),
      t('barbell curl', 'barbell'),
      t('ez barbell curl', 'ez'),
      t('cable curl', 'cable')
    ]
  },
  {
    id: 'hammer_curl',
    keys: ['hammercurl', 'hammer curl', 'hammercurls', 'hammer curls'],
    targets: [t('dumbbell hammer curl', 'dumbbell'), t('cable hammer curl (with rope)', 'cable')]
  },
  {
    id: 'triceps_pushdown',
    keys: ['trizepsdrücken', 'trizeps pushdown', 'pushdown', 'pushdowns', 'trizepsdruecken', 'trizeps am kabel', 'tricep pushdown', 'triceps pushdown', 'trizeps drücken', 'trizepsstrecken'],
    targets: [
      t('cable pushdown', 'cable'),
      t('cable pushdown (with rope attachment)', 'cable', 'rope'),
      t('cable triceps pushdown (v-bar)', 'cable', 'vbar')
    ]
  },
  {
    id: 'skull_crusher',
    keys: ['skullcrusher', 'skull crusher', 'skullcrushers', 'schädelspalter', 'stirndrücken', 'french press', 'liegendes trizepsdrücken'],
    targets: [t('barbell lying triceps extension skull crusher', 'barbell', 'lying')]
  },
  {
    id: 'overhead_triceps',
    keys: ['trizeps überkopf', 'overhead trizeps', 'overhead triceps extension', 'trizepsstrecken überkopf', 'french curl'],
    targets: [t('cable overhead triceps extension (rope attachment)', 'cable'), t('dumbbell standing triceps extension', 'dumbbell', 'standing')]
  },
  {
    id: 'lateral_raise',
    ask: true,
    keys: ['seitheben', 'seitenheben', 'lateral raise', 'lateral raises', 'seitliches heben', 'side raise', 'schulter seitheben'],
    targets: [
      t('dumbbell lateral raise', 'dumbbell', 'standing'),
      t('dumbbell seated lateral raise', 'dumbbell', 'seated'),
      t('cable lateral raise', 'cable'),
      t('lever lateral raise', 'machine')
    ]
  },
  { id: 'front_raise', keys: ['frontheben', 'front raise', 'front raises', 'vorderes heben'], targets: [t('dumbbell front raise', 'dumbbell')] },
  {
    id: 'rear_delt',
    keys: ['reverse fly', 'reverse flys', 'rear delt fly', 'hintere schulter', 'reverse flyes', 'reverse butterfly', 'butterfly reverse', 'hintere schulter fliegende'],
    targets: [t('reverse fly dumbbell', 'dumbbell'), t('reverse fly seated', 'machine', 'seated')]
  },
  {
    id: 'pec_machine',
    keys: ['butterfly', 'pec deck', 'butterfly maschine', 'butterflymaschine', 'brustmaschine'],
    targets: [t('lever seated fly', 'machine', 'seated')]
  },
  {
    id: 'chest_fly',
    ask: true,
    keys: ['fliegende', 'brustfliegende', 'chest fly', 'chest flys', 'fly', 'flys', 'flyes',
      { key: 'cable fly', implies: ['cable'] }, { key: 'cable flys', implies: ['cable'] }, { key: 'kabelzug fliegende', implies: ['cable'] },
      { key: 'crossover', implies: ['cable'] }, { key: 'cable crossover', implies: ['cable'] }],
    targets: [t('dumbbell fly', 'dumbbell', 'flat'), t('cable standing fly', 'cable', 'standing'), t('lever seated fly', 'machine', 'seated')]
  },
  { id: 'leg_press', keys: ['beinpresse', 'leg press', 'legpress'], targets: [t('sled 45° leg press', 'machine')] },
  { id: 'leg_extension', keys: ['beinstrecker', 'leg extension', 'leg extensions', 'beinstreckung'], targets: [t('leg extension', 'machine', 'seated')] },
  {
    id: 'leg_curl',
    keys: ['beinbeuger', 'leg curl', 'leg curls', 'beincurl', 'beinbeugen',
      { key: 'beinbeuger liegend', implies: ['lying'] }, { key: 'liegender beinbeuger', implies: ['lying'] }, { key: 'lying leg curl', implies: ['lying'] },
      { key: 'beinbeuger sitzend', implies: ['seated'] }, { key: 'sitzender beinbeuger', implies: ['seated'] }, { key: 'seated leg curl', implies: ['seated'] }],
    targets: [
      t('lever lying leg curl', 'machine', 'lying'),
      t('lever seated leg curl', 'machine', 'seated'),
      t('lever kneeling leg curl', 'machine', 'kneeling')
    ]
  },
  {
    id: 'calf_raise',
    keys: ['wadenheben', 'calf raise', 'calf raises', 'waden', 'wadenpresse', 'wadenmaschine'],
    targets: [
      t('lever standing calf raise', 'machine', 'standing'),
      t('lever seated calf raise', 'machine', 'seated'),
      t('dumbbell standing calf raise', 'dumbbell', 'standing'),
      t('barbell standing calf raise', 'barbell', 'standing')
    ]
  },
  {
    id: 'lunge',
    keys: ['ausfallschritt', 'ausfallschritte', 'lunge', 'lunges', 'kurzhantel ausfallschritte'],
    targets: [t('dumbbell lunge', 'dumbbell'), t('barbell lunge', 'barbell')]
  },
  { id: 'walking_lunge', keys: ['walking lunge', 'walking lunges', 'gehende ausfallschritte', 'ausfallschritte gehend'], targets: [t('walking lunge', 'bodyweight')] },
  { id: 'step_up', keys: ['step up', 'step ups', 'stepup', 'aufsteiger'], targets: [t('dumbbell step-up', 'dumbbell')] },
  {
    id: 'shrug',
    keys: ['schulterzucken', 'shrug', 'shrugs', 'nackenheben', 'trapezheben'],
    targets: [t('barbell shrug', 'barbell'), t('dumbbell shrug', 'dumbbell')]
  },
  {
    id: 'push_up',
    keys: ['liegestütz', 'liegestütze', 'liegestuetz', 'push up', 'push ups', 'pushup', 'pushups', 'push-up', 'liegestuetze'],
    targets: [t('push-up', 'bodyweight'), opt('close-grip push-up', 'bodyweight', 'close'), opt('diamond push-up', 'bodyweight', 'diamond')]
  },
  { id: 'back_extension', keys: ['rückenstrecker', 'rueckenstrecker', 'hyperextension', 'back extension', 'hyperextensions', 'rückenstrecken'], targets: [t('hyperextension', 'bodyweight')] },
  { id: 'leg_raise', keys: ['beinheben hängend', 'hanging leg raise', 'leg raise', 'leg raises', 'hängendes beinheben', 'beinheben'], targets: [t('hanging leg raise', 'bodyweight')] },
  { id: 'russian_twist', keys: ['russian twist', 'russian twists', 'russischer twist'], targets: [t('russian twist', 'bodyweight')] },
  { id: 'ab_wheel', keys: ['ab wheel', 'bauchroller', 'ab roller', 'wheel rollout'], targets: [t('wheel rollout', 'bodyweight')] },
  { id: 'cable_crunch', keys: ['cable crunch', 'kabel crunch', 'crunch am kabel', 'cable crunches'], targets: [t('cable kneeling crunch', 'cable', 'kneeling')] },
  { id: 'crunch', keys: ['crunch', 'crunches', 'bauchpressen', 'bauchpresse'], targets: [t('crunch floor', 'bodyweight')] },
  { id: 'farmers_walk', keys: ['farmers walk', 'farmer walk', 'farmers carry', 'bauernspaziergang'], targets: [t('farmers walk', 'dumbbell')] },
  { id: 'kettlebell_swing', keys: ['kettlebell swing', 'kettlebell swings', 'kb swing', 'kb swings'], targets: [t('kettlebell swing', 'kettlebell')] },
  { id: 'burpee', keys: ['burpee', 'burpees'], targets: [t('burpee', 'bodyweight')] },
  { id: 'glute_kickback', keys: ['kickback', 'kickbacks', 'glute kickback', 'gesäß kickback', 'po kickback'], targets: [t('cable kickback', 'cable')] },
  // Übungen, die es im Katalog (noch) nicht gibt: nur Vorschläge, nie automatisch gleichgesetzt.
  { id: 'hip_thrust', keys: ['hip thrust', 'hip thrusts', 'hipthrust', 'beckenheben'], targets: [], suggest: ['barbell glute bridge'] }
]

// Merkmal-Wörter in Nutzereingaben (Teilwörter am Anfang zählen: "kurzhantelrudern", "einarmiges").
export const QUALIFIERS = [
  ['barbell', ['langhantel', 'lh', 'barbell', 'bb', 'langhanteln']],
  ['dumbbell', ['kurzhantel', 'kurzhanteln', 'kh', 'dumbbell', 'dumbbells', 'db', 'hantel']],
  ['cable', ['kabel', 'kabelzug', 'seilzug', 'cable', 'kabelturm']],
  ['machine', ['maschine', 'gerät', 'geraet', 'machine', 'lever']],
  ['smith', ['smith', 'multipresse', 'smithmaschine']],
  ['ez', ['sz', 'ez', 'szstange', 'sz-stange', 'ez-stange']],
  ['bodyweight', ['körpergewicht', 'koerpergewicht', 'bodyweight', 'bw']],
  ['band', ['band', 'theraband', 'widerstandsband']],
  ['rope', ['seil', 'rope', 'tau']],
  ['incline', ['schräg', 'schraeg', 'incline']],
  ['decline', ['negativ', 'decline']],
  ['flat', ['flach', 'flat']],
  ['seated', ['sitzend', 'sitzende', 'sitzender', 'sitzendes', 'seated']],
  ['standing', ['stehend', 'stehende', 'stehender', 'stehendes', 'standing']],
  ['lying', ['liegend', 'liegende', 'liegender', 'liegendes', 'lying']],
  ['wide', ['breit', 'breiter', 'wide', 'weit']],
  ['close', ['eng', 'enger', 'close', 'narrow']],
  ['reverse', ['umgriff', 'untergriff', 'reverse', 'underhand']],
  ['parallel', ['parallel', 'neutral']],
  ['onearm', ['einarmig', 'einarmige', 'einarmiges', 'einarmiger', 'onearm']],
  ['weighted', ['weighted', 'zusatzgewicht', 'beschwert']],
  ['assisted', ['assisted', 'assistiert', 'unterstützt', 'unterstuetzt']]
]
