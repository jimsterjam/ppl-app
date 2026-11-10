// Texte der Website (Deutsch/Englisch). Freigegeben von Paul am 09.11.2026 (Startseite, 1RM-Rechner, Wiederholungen).
// Der Name bleibt in beiden Sprachen "Form Beats Ego". Aussagen über die App stammen aus den Store-Texten und der App.
export const APP_STORE_URL = 'https://apps.apple.com/app/fbe-form-beats-ego/id6808702632'
export const APP_ID = '6808702632'
export const BRAND = 'fbe'
export const SLOGAN = 'Form Beats Ego'

export const content = {
  de: {
    lang: 'de',
    langName: 'Deutsch',
    nav: { rm: '1RM-Rechner', reps: 'Wiederholungen', plans: 'Pläne', support: 'Support', menu: 'Hauptmenü', home: 'fbe Startseite' },
    cta: { store: 'Im App Store laden', storeAria: 'fbe im App Store laden', small: 'Kostenlos. Für iPhone. Ohne Abo, ohne Werbung.' },
    footer: {
      legal: 'Impressum', privacy: 'Datenschutz', support: 'Support',
      note: 'Hinweis: fbe ersetzt keine fachliche Beratung. Bei gesundheitlichen Fragen wende dich bitte an qualifizierte Fachleute.',
      copyright: '© 2026 fbe', language: 'Sprache', skip: 'Zum Inhalt springen'
    },
    home: {
      title: 'fbe – Form Beats Ego | Trainingsplan, Workout-Tracker und KI-Coach für iPhone',
      description: 'Trainingsplan, Satz-für-Satz-Tracking, Pausentimer und KI-Coach nach dem Workout. Kostenlos, ohne Abo, ohne Werbung. Für iPhone.',
      h1: 'Form Beats Ego.',
      lead: 'Erst die saubere Ausführung, dann das Gewicht. fbe ist dein Trainingstagebuch mit Plan, Pausentimer und einem KI-Coach, der dir nach jedem Workout sagt, was als Nächstes dran ist.',
      whatTitle: 'Was fbe für dich tut',
      what: [
        ['Dein Plan sagt, was heute dran ist.', 'Starte mit Vorlagen wie Push/Pull/Legs, Ober-/Unterkörper oder Ganzkörper, für Anfänger oder Fortgeschrittene. Auf dem Startbildschirm siehst du das nächste Training.'],
        ['Ein Satz. Voller Fokus.', 'Die Großansicht zeigt dir nur den aktuellen Satz. Wiederholungen und Gewicht trägst du mit wenigen Tipps ein, auch Aufwärmsätze und Notizen zu jeder Übung.'],
        ['Pause im Griff.', 'Der Pausentimer startet, wenn du einen Satz abhakst. Mit Plus und Minus passt du ihn in 15-Sekunden-Schritten an und bekommst am Ende ein Signal.'],
        ['Ein Coach, der nur deine Zahlen kennt.', 'Nach dem Workout bekommst du eine kurze, sachliche Einordnung und einen konkreten Vorschlag für das nächste Mal, zum Beispiel erst Wiederholungen steigern, dann das Gewicht.']
      ],
      shotsLabel: 'Bilder aus der App',
      shotsAlt: ['Startbildschirm mit dem heutigen Training', 'Großansicht mit einem Satz', 'Pausentimer mit Countdown', 'KI-Feedback nach dem Training'],
      honestTitle: 'Feedback ohne Show',
      honest: 'Der KI-Coach arbeitet nur mit dem, was du einträgst: Übungen, Sätze, Gewichte, Wiederholungen und Notizen. Er kann deine Technik und deine Tagesform nicht beurteilen, und er tut nicht so. Daten gehen nur an die KI, wenn du es ausdrücklich erlaubt hast. Dein Name und deine E-Mail-Adresse werden nicht mitgesendet.',
      moreTitle: 'Mehr drin',
      more: [
        'Über 1.100 Übungen mit Bildern, dazu eigene Übungen',
        'Ziel pro Workout oder pro Übung: Muskelaufbau oder Kraft, mit passenden Wiederholungsbereichen',
        'Workout-Generator, der ein Training zu deiner Zeit plant',
        'Statistiken und Verlauf für Sätze, Volumen und Bestleistungen',
        'Favoriten für deine eigenen Workouts',
        'Deutsch und Englisch'
      ],
      freeTitle: 'Kostenlos, ohne Abo, ohne Werbung',
      free: 'Du lädst fbe, meldest dich mit E-Mail, Google oder Apple an und trainierst. In den ersten 30 Tagen nach deiner Registrierung sind 30 KI-Anfragen enthalten, danach 10 pro Monat. Das Kontingent gilt für das KI-Feedback und den KI-Workout-Generator.',
      toolsTitle: 'Kostenlose Werkzeuge für dein Training',
      tools: [
        ['rm', '1RM-Rechner', 'Schätze dein Maximalgewicht aus einem harten Satz.'],
        ['reps', 'Wiederholungen: Kraft oder Muskelaufbau?', 'Welche Bereiche zu welchem Ziel passen.'],
        ['ppl3', 'Push/Pull/Legs, 3 Tage', 'Ein Plan für Anfänger und Fortgeschrittene.'],
        ['plans', 'Alle Pläne ansehen', '6 Tage, Ober-/Unterkörper, Ganzkörper.']
      ],
      faqTitle: 'Häufige Fragen',
      faq: [
        ['Kostet fbe etwas?', 'Nein. fbe ist kostenlos, ohne Abo und ohne Werbung.'],
        ['Brauche ich ein Konto?', 'Ja. Du meldest dich mit E-Mail, Google oder Apple an. So bleiben deine Trainingsdaten an dein Konto gebunden und werden zwischen deinen Geräten synchronisiert.'],
        ['Welche Daten gehen an die KI?', 'Nur wenn du es erlaubt hast: Übungen, Sätze, Gewichte, Wiederholungen und deine Notizen gehen an den KI-Dienst OpenAI (USA). Name und E-Mail-Adresse werden nicht mitgesendet. Ohne Erlaubnis gibt es kein KI-Feedback und keine KI-Workouts.'],
        ['Funktioniert fbe offline?', 'Bereits geladene Inhalte ja. Änderungen werden synchronisiert, sobald du wieder verbunden bist.'],
        ['Gibt es fbe für Android?', 'Aktuell nur für iPhone.'],
        ['Kann ich mein Konto löschen?', 'Ja, in den Einstellungen der App.']
      ]
    },
    rm: {
      title: '1RM-Rechner: Maximalgewicht schätzen | fbe',
      description: 'Gewicht und Wiederholungen eingeben, geschätztes Maximum ablesen (Epley-Formel), dazu eine Tabelle für 1 bis 12 Wiederholungen. Kostenlos, ohne Anmeldung.',
      h1: '1RM-Rechner: Dein Maximalgewicht schätzen',
      intro: 'Dein 1RM („One-Rep-Max“, dein Wiederholungsmaximum) ist das Gewicht, das du gerade noch einmal sauber bewegen kannst. Du musst es nicht testen. Trage das Gewicht und die Wiederholungen eines harten Satzes ein, der Rechner schätzt den Rest.',
      weight: 'Gewicht in kg', reps: 'Wiederholungen (1 bis 12)', button: 'Berechnen',
      result: 'Geschätztes 1RM', tableTitle: 'Dein Gewicht für 1 bis 12 Wiederholungen',
      cols: ['Wiederholungen', 'Gewicht (kg)', 'Anteil vom 1RM'],
      error: 'Bitte gib ein Gewicht größer als 0 und 1 bis 12 Wiederholungen ein.',
      howTitle: 'So rechnet der Rechner',
      how: 'Wir nutzen die Formel nach Epley: 1RM = Gewicht × (1 + Wiederholungen ÷ 30). Bei einer Wiederholung ist das 1RM das Gewicht selbst.',
      example: 'Beispiel: 80 kg × 8 Wiederholungen ergibt 80 × (1 + 8 ÷ 30) = 101,3 kg.',
      goodTitle: 'Gut zu wissen',
      good: [
        'Je mehr Wiederholungen du eingibst, desto ungenauer wird die Schätzung. Meist passt sie bei 3 bis 8 Wiederholungen am besten.',
        'Tagesform, Technik und Ermüdung verändern das Ergebnis. Es ist eine Schätzung, keine Messung.',
        'Wenn du dein echtes Maximum testen willst, tu es mit Sicherung und nach gutem Aufwärmen.'
      ],
      useTitle: 'Wofür du es brauchst',
      use: 'Mit dem 1RM kannst du Gewichte für ein Ziel planen: schwerere Sätze mit wenigen Wiederholungen für Kraft, mittlere Gewichte mit mehr Wiederholungen für Muskelaufbau. Welche Bereiche zu welchem Ziel passen, steht auf der Seite',
      useLink: 'Wiederholungen: Kraft oder Muskelaufbau?',
      appTitle: 'Halte deine Sätze fest',
      app: 'In fbe trägst du jeden Satz ein und siehst deinen Verlauf. So erkennst du, ob Gewicht oder Wiederholungen von Woche zu Woche steigen.'
    },
    reps: {
      title: 'Wiederholungen für Kraft oder Muskelaufbau? Die Bereiche | fbe',
      description: 'Wie viele Wiederholungen pro Satz passen zu Kraft und wie viele zu Muskelaufbau? Bereiche, Pausen und wie du sie im Training nutzt.',
      h1: 'Wie viele Wiederholungen pro Satz: Kraft oder Muskelaufbau?',
      shortTitle: 'Kurz gesagt',
      short: ['Kraft: 1 bis 6 Wiederholungen mit schweren Gewichten', 'Muskelaufbau: 8 bis 12 Wiederholungen mit mittleren Gewichten', '7 Wiederholungen liegen dazwischen und zählen für keines der beiden Ziele'],
      cols: ['Ziel', 'Wiederholungen pro Satz', 'Typisches Gewicht', 'Pause bei Grundübungen', 'Pause bei Isolationsübungen'],
      rows: [['Kraft', '1 bis 6', 'schwer', '3 Minuten', '2 Minuten'], ['Muskelaufbau', '8 bis 12', 'mittel', '2 Minuten', '1,5 Minuten']],
      tableNote: 'Die Pausen sind die Standardwerte von fbe, du kannst sie dort ändern. Grundübungen bewegen mehrere Gelenke, zum Beispiel Bankdrücken oder Kniebeuge. Isolationsübungen trainieren ein Gelenk, zum Beispiel Bizeps-Curls.',
      meanTitle: 'Was bedeutet das?',
      mean: [
        'Für Kraft übst du, ein schweres Gewicht zu bewegen. Dafür nimmst du wenige Wiederholungen und ruhst länger, damit der nächste Satz wieder schwer sein kann.',
        'Für Muskelaufbau setzt du Reize mit mittleren Gewichten und mehr Wiederholungen. Der Bereich 8 bis 12 ist ein praktischer Rahmen, in dem das Gewicht schwer genug ist, ohne dass du zu schnell ermüdest. Muskeln wachsen auch in anderen Bereichen, wenn die Sätze anstrengend genug sind.'
      ],
      mixTitle: 'Du darfst mischen.',
      mix: 'Kraft und Muskelaufbau lassen sich in einem Training mischen, zum Beispiel erst schwere Sätze mit wenigen Wiederholungen, danach Ergänzungsübungen mit mehr Wiederholungen. In fbe legst du das Ziel pro Workout oder pro Übung fest.',
      useTitle: 'So nutzt du die Bereiche',
      use: [
        'Such dir für die Übung einen Bereich, der zu deinem Ziel passt.',
        'Wähle ein Gewicht, mit dem du die Wiederholungen sauber schaffst. Wenn du zu leicht liegst, steigere. Wenn du zu schwer liegst, geh runter. Hilfe dabei gibt der 1RM-Rechner.',
        'Steigere erst die Wiederholungen im Bereich, dann das Gewicht. Wenn du am oberen Ende des Bereichs bist, nimm etwas mehr Gewicht und fang unten wieder an.'
      ],
      appTitle: 'Die passenden Bereiche, automatisch',
      app: 'fbe kennt diese Bereiche. Wenn du das Ziel pro Workout oder Übung festlegst, bekommst du Vorschläge für Wiederholungen und Gewicht. Nach dem Training sagt dir der KI-Coach, was als Nächstes dran ist.'
    },
    plans: {
      title: 'Trainingspläne: Push/Pull/Legs, Ober-/Unterkörper, Ganzkörper | fbe',
      description: 'Fertige Trainingspläne mit Übungen und Sätzen für Anfänger und Fortgeschrittene: Push/Pull/Legs, Ober-/Unterkörper und Ganzkörper.',
      h1: 'Trainingspläne für Anfänger und Fortgeschrittene',
      intro: 'Das sind die Vorlagen aus fbe. Du siehst vorher, was drinsteckt, und entscheidest dann, ob du sie wählst. In der App startest du einen Plan mit wenigen Tipps.',
      open: 'Plan ansehen',
      levelTitle: 'Stufe', beginner: 'Anfänger', advanced: 'Fortgeschrittene',
      levelHintBeginner: 'Geführte Maschinen, weniger Übungen und Sätze.',
      levelHintAdvanced: 'Freie Gewichte, mehr Umfang.',
      dayCols: ['Übung', 'Sätze'],
      repsLine: 'Wiederholungen: 8–12 pro Satz (Ziel Muskelaufbau, wie die Vorlage in der App).',
      tips: 'Pause: 2 Minuten bei Grundübungen und 1,5 Minuten bei Isolationsübungen (Standard der App für Muskelaufbau, dort anpassbar). Steigere zuerst die Wiederholungen, dann das Gewicht, so schlägt es der KI-Coach in der App vor.',
      startTitle: 'So startest du den Plan in fbe',
      start: 'Home → Trainingspläne → Vorlage wählen → Stufe wählen. Dein Startbildschirm zeigt danach, was heute dran ist.',
      back: 'Alle Pläne', otherPlans: 'Weitere Pläne',
      titleSuffix: 'Übungen und Sätze'
    },
    support: {
      title: 'Support | fbe', description: 'Hilfe und Kontakt zu fbe.', h1: 'Support',
      contact: 'Kontakt', contactText: 'Schreib uns per E-Mail:',
      delTitle: 'Konto und Daten', del: 'Du kannst dein Konto in den Einstellungen der App löschen und deine Daten herunterladen.',
      faqTitle: 'Häufige Fragen', faqLink: 'Antworten findest du auf der Startseite.'
    },
    notFound: { title: 'Seite nicht gefunden | fbe', h1: 'Seite nicht gefunden', text: 'Diese Seite gibt es nicht. Zur Startseite:', link: 'fbe Startseite' }
  },
  en: {
    lang: 'en',
    langName: 'English',
    nav: { rm: '1RM calculator', reps: 'Reps', plans: 'Plans', support: 'Support', menu: 'Main menu', home: 'fbe home' },
    cta: { store: 'Download on the App Store', storeAria: 'Download fbe on the App Store', small: 'Free. For iPhone. No subscription, no ads.' },
    footer: {
      legal: 'Legal notice', privacy: 'Privacy', support: 'Support',
      note: 'Note: fbe does not replace professional advice. For health questions please consult qualified professionals.',
      copyright: '© 2026 fbe', language: 'Language', skip: 'Skip to content'
    },
    home: {
      title: 'fbe – Form Beats Ego | Workout planner, gym log and AI coach for iPhone',
      description: 'Workout plan, set-by-set tracking, rest timer and an AI coach after your workout. Free, no subscription, no ads. For iPhone.',
      h1: 'Form Beats Ego.',
      lead: 'Clean reps first, weight second. fbe is your training log with a plan, a rest timer and an AI coach that tells you what to do next after every workout.',
      whatTitle: 'What fbe does for you',
      what: [
        ['Your plan knows what’s next.', 'Start from templates like Push/Pull/Legs, Upper/Lower or Full Body, for beginners or advanced lifters. Your home screen shows your next workout.'],
        ['One set. Full focus.', 'The large view shows only your current set. Enter reps and weight with a few taps, including warm-up sets and notes for each exercise.'],
        ['Rest under control.', 'The rest timer starts when you check off a set. Adjust it in 15-second steps with plus and minus and get a signal at the end.'],
        ['A coach that only knows your numbers.', 'After your workout you get a short, factual summary and a concrete suggestion for next time, for example add reps first, then weight.']
      ],
      shotsLabel: 'Screenshots from the app',
      shotsAlt: ['AI feedback after the workout', 'Workout complete with next-time suggestion', 'Warm-up plan for the session', 'Rest timer with countdown'],
      honestTitle: 'Feedback without the show',
      honest: 'The AI coach works only with what you enter: exercises, sets, weights, reps and notes. It cannot judge your technique or how you feel, and it does not pretend to. Data goes to the AI only if you have explicitly allowed it. Your name and email address are not sent.',
      moreTitle: 'More inside',
      more: [
        'Over 1,100 exercises with images, plus your own exercises',
        'Goal per workout or per exercise: muscle building or strength, with matching rep ranges',
        'Workout generator that plans a session to fit your time',
        'Stats and history for sets, volume and personal bests',
        'Favorites for your own workouts',
        'German and English'
      ],
      freeTitle: 'Free, no subscription, no ads',
      free: 'Download fbe, sign in with email, Google or Apple and train. In the first 30 days after you register, 30 AI requests are included, then 10 per month. The allowance covers AI feedback and the AI workout generator.',
      toolsTitle: 'Free tools for your training',
      tools: [
        ['rm', '1RM calculator', 'Estimate your max from one hard set.'],
        ['reps', 'Reps for strength or muscle?', 'Which ranges fit which goal.'],
        ['ppl3', 'Push/Pull/Legs, 3 days', 'A plan for beginners and advanced lifters.'],
        ['plans', 'See all plans', '6 days, upper/lower, full body.']
      ],
      faqTitle: 'FAQ',
      faq: [
        ['Does fbe cost anything?', 'No. fbe is free, with no subscription and no ads.'],
        ['Do I need an account?', 'Yes. You sign in with email, Google or Apple. That keeps your training data tied to your account and synced between your devices.'],
        ['What data goes to the AI?', 'Only if you have allowed it: exercises, sets, weights, reps and your notes go to the AI service OpenAI (USA). Your name and email address are not sent. Without permission there is no AI feedback and no AI workouts.'],
        ['Does fbe work offline?', 'Content you have already loaded does. Changes sync when you are connected again.'],
        ['Is there an Android version?', 'For now, iPhone only.'],
        ['Can I delete my account?', 'Yes, in the app settings.']
      ]
    },
    rm: {
      title: '1RM calculator: estimate your one-rep max | fbe',
      description: 'Enter weight and reps, read your estimated max (Epley formula) and a table for 1 to 12 reps. Free, no sign-up.',
      h1: '1RM calculator: estimate your one-rep max',
      intro: 'Your 1RM (one-rep max) is the heaviest weight you can lift once with good form. You don’t have to test it. Enter the weight and the reps of one hard set and the calculator estimates the rest.',
      weight: 'Weight in kg', reps: 'Reps (1 to 12)', button: 'Calculate',
      result: 'Estimated 1RM', tableTitle: 'Your weight for 1 to 12 reps',
      cols: ['Reps', 'Weight (kg)', 'Share of 1RM'],
      error: 'Please enter a weight above 0 and 1 to 12 reps.',
      howTitle: 'How it is calculated',
      how: 'We use the Epley formula: 1RM = weight × (1 + reps ÷ 30). For one rep, the 1RM is the weight itself.',
      example: 'Example: 80 kg × 8 reps gives 80 × (1 + 8 ÷ 30) = 101.3 kg.',
      goodTitle: 'Good to know',
      good: [
        'The more reps you enter, the less accurate the estimate. It usually fits best at 3 to 8 reps.',
        'Your daily form, technique and fatigue change the result. It is an estimate, not a measurement.',
        'If you want to test your true max, do it with a spotter and after a good warm-up.'
      ],
      useTitle: 'What you need it for',
      use: 'With your 1RM you can plan weights for a goal: heavier sets with few reps for strength, moderate weights with more reps for muscle building. Which ranges fit which goal is on the page',
      useLink: 'Reps for strength or muscle?',
      appTitle: 'Keep track of your sets',
      app: 'In fbe you log every set and see your history. That way you can tell whether weight or reps go up from week to week.'
    },
    reps: {
      title: 'Reps for strength or muscle building? The ranges | fbe',
      description: 'How many reps per set fit strength and how many fit muscle building? Ranges, rest times and how to use them in your training.',
      h1: 'How many reps per set: strength or muscle building?',
      shortTitle: 'In short',
      short: ['Strength: 1 to 6 reps with heavy weights', 'Muscle building: 8 to 12 reps with moderate weights', '7 reps sit in between and count for neither goal'],
      cols: ['Goal', 'Reps per set', 'Typical weight', 'Rest, compound lifts', 'Rest, isolation lifts'],
      rows: [['Strength', '1 to 6', 'heavy', '3 minutes', '2 minutes'], ['Muscle building', '8 to 12', 'moderate', '2 minutes', '1.5 minutes']],
      tableNote: 'The rest times are fbe’s defaults, and you can change them in the app. Compound lifts use several joints, for example bench press or squat. Isolation lifts train one joint, for example biceps curls.',
      meanTitle: 'What does it mean?',
      mean: [
        'For strength you practise moving a heavy weight. You use few reps and rest longer so the next set can be heavy again.',
        'For muscle building you create stimulus with moderate weights and more reps. The 8 to 12 range is a practical frame where the weight is heavy enough without tiring you too quickly. Muscles also grow in other ranges when the sets are hard enough.'
      ],
      mixTitle: 'You can mix.',
      mix: 'You can mix strength and muscle building in one workout, for example heavy sets with few reps first, then accessory lifts with more reps. In fbe you set the goal per workout or per exercise.',
      useTitle: 'How to use the ranges',
      use: [
        'Pick a range for the exercise that fits your goal.',
        'Choose a weight you can lift cleanly for those reps. If it is too light, go up. If it is too heavy, go down. The 1RM calculator can help.',
        'Add reps within the range first, then weight. When you reach the top of the range, add a little weight and start at the bottom again.'
      ],
      appTitle: 'The right ranges, automatically',
      app: 'fbe knows these ranges. When you set the goal per workout or exercise, you get suggestions for reps and weight. After training the AI coach tells you what to do next.'
    },
    plans: {
      title: 'Workout plans: Push/Pull/Legs, Upper/Lower, Full Body | fbe',
      description: 'Ready-made workout plans with exercises and sets for beginners and advanced lifters: Push/Pull/Legs, Upper/Lower and Full Body.',
      h1: 'Workout plans for beginners and advanced lifters',
      intro: 'These are the templates from fbe. You see what is inside before you choose. In the app you start a plan with a few taps.',
      open: 'View plan',
      levelTitle: 'Level', beginner: 'Beginner', advanced: 'Advanced',
      levelHintBeginner: 'Guided machines, fewer exercises and sets.',
      levelHintAdvanced: 'Free weights, more volume.',
      dayCols: ['Exercise', 'Sets'],
      repsLine: 'Reps: 8–12 per set (goal muscle building, like the template in the app).',
      tips: 'Rest: 2 minutes for compound lifts and 1.5 minutes for isolation lifts (the app’s default for muscle building, adjustable there). Add reps first, then weight, as the AI coach in the app suggests.',
      startTitle: 'How to start the plan in fbe',
      start: 'Home → Training plans → pick a template → pick a level. Your home screen then shows what is on today.',
      back: 'All plans', otherPlans: 'More plans',
      titleSuffix: 'exercises and sets'
    },
    support: {
      title: 'Support | fbe', description: 'Help and contact for fbe.', h1: 'Support',
      contact: 'Contact', contactText: 'Write to us by email:',
      delTitle: 'Account and data', del: 'You can delete your account and download your data in the app settings.',
      faqTitle: 'FAQ', faqLink: 'You will find answers on the home page.'
    },
    notFound: { title: 'Page not found | fbe', h1: 'Page not found', text: 'This page does not exist. Back to the home page:', link: 'fbe home' }
  }
}

// Seiten: id → Adresse je Sprache (Verzeichnis mit index.html)
export const PAGES = [
  { id: 'home', de: '/', en: '/en/' },
  { id: 'rm', de: '/werkzeuge/1rm-rechner/', en: '/en/tools/1rm-calculator/' },
  { id: 'reps', de: '/werkzeuge/wiederholungen-kraft-muskelaufbau/', en: '/en/tools/reps-strength-vs-muscle/' },
  { id: 'plans', de: '/plaene/', en: '/en/plans/' },
  { id: 'ppl3', de: '/plaene/push-pull-legs-3-tage/', en: '/en/plans/push-pull-legs-3-day/' },
  { id: 'ppl6', de: '/plaene/push-pull-legs-6-tage/', en: '/en/plans/push-pull-legs-6-day/' },
  { id: 'ul4', de: '/plaene/ober-unterkoerper-4-tage/', en: '/en/plans/upper-lower-4-day/' },
  { id: 'fb3', de: '/plaene/ganzkoerper-3-tage/', en: '/en/plans/full-body-3-day/' },
  { id: 'support', de: '/support/', en: '/en/support/' },
  { id: 'impressum', de: '/impressum/', en: '/en/legal-notice/' },
  { id: 'datenschutz', de: '/datenschutz/', en: '/en/privacy/' }
]
