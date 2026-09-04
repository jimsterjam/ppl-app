import { createI18n } from 'vue-i18n'

const STORAGE_KEY = 'app-lang'

function detectLocale() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return stored
  } catch {}
  const nav = (typeof navigator !== 'undefined' && navigator.language) || 'de'
  return nav.toLowerCase().startsWith('de') ? 'de' : 'en'
}

export const messages = {
  de: {
    common: {
      updated: 'Aktualisiert',
      confirm: 'Bestätigen',
      cancel: 'Abbrechen',
      done: 'Fertig',
      close: 'Schließen',
      remove: 'Entfernen',
      delete: 'Löschen',
      replace: 'Ersetzen',
      add: 'Hinzufügen',
      save: 'Speichern',
      saving: 'Speichere…',
      loading: 'Lädt…',
      back: 'Zurück',
      error: 'Fehler',
      yesterday: 'Gestern',
      unknown: 'Unbekannt',
      retry: 'Erneut versuchen',
      photo: 'Foto',
      image: 'Bild',
      weight: 'Gewicht',
      sets: 'Sätze',
      reps: 'Wdh.',
      duration: 'Dauer',
      today: 'Heute',
      continue: 'Weiter',
      unknownDuration: '?',
      more: 'weitere',
      select: 'Auswählen'
    },
    auth: {
      signIn: 'Anmelden',
      signOut: 'Abmelden',
      email: 'E-Mail',
      password: 'Passwort',
      signUp: 'Registrieren',
      haveAccount: 'Hast du schon ein Konto? Anmelden',
      noAccount: 'Kein Konto? Registrieren',
      or: 'oder',
      loading: 'Lädt...',
      forgotPassword: 'Passwort vergessen?'
    },
    nav: {
      home: 'Home',
      stats: 'Stats',
      exercises: 'Übungen',
      plan: 'Plan',
      faqs: "FAQ's",
      settings: 'Einst.',
      legal: 'Rechtliches',
      ariaMain: 'Hauptnavigation'
    },
  dashboard: {
      title: 'Startbereich',
      greetingMorning: 'Guten Morgen',
      greetingDay: 'Guten Tag',
      greetingEvening: 'Guten Abend',
      refreshTitle: 'Daten aktualisieren',
      init: 'Initialisiere Dashboard...',
      loading: 'Lade deine Workouts...',
      connectionErrorTitle: 'Verbindungsfehler',
      retry: 'Erneut versuchen',
      noWorkoutsTitle: 'Noch keine Workouts',
      noWorkoutsMsg: "Lies die FAQ's oder starte direkt dein erstes Training und verfolge deinen Fortschritt!'",
      startFirst: 'Erstes Workout starten',
      successCreated: 'Workout gestartet!',
      nextWorkout: 'Nächstes Workout',
      last: 'Zuletzt',
      start: 'Starten',
      continue: 'fortsetzen',
      draftAvailable: 'Entwurf vorhanden',
      deleteDraft: 'Entwurf loeschen',
      startNew: 'Neu beginnen',
      welcome: 'Willkommen!',
  next: 'Nächstes',
  startNext: 'Starte nächstes Workout',
  lastSaved: 'Zuletzt gespeichert',
  resumeDraft: 'Letztes Workout fortsetzen?',
  fullBodyLabel: 'Full Body',
  workoutTypeInfoTitle: 'Workout-Typ erklärt',
  workoutTypeInfo: 'Info zu diesem Workout-Typ',
  pushInfo: 'Push trainiert Brust, Schultern und Trizeps.',
  pullInfo: 'Pull trainiert Rücken und Bizeps.',
  legsInfo: 'Legs trainiert Beine und Gesäß.',
  freestyleInfo: 'Full Body trainiert den ganzen Körper in einer Einheit.'
  ,startModeTitle: 'Workout starten'
  ,startModeText: 'Möchtest du dein Workout selbst zusammenstellen oder generieren lassen?'
  ,startModeManual: 'Selbst zusammenstellen'
  ,startModeGenerate: 'Generieren lassen'
  ,startModeFavorites: 'Favorit auswählen'
  ,startModeTypeTitle: '{type} auswählen'
  ,allFavorites: 'Favoriten'
  ,allFavoritesEmpty: 'Noch keine Favoriten gespeichert.'
  ,favoritesHint: 'Wähle einen Favoriten, um direkt zu starten oder anzupassen.'
  ,favoritesEmpty: 'Noch keine Favoriten für diesen Typ gespeichert.'
  ,favoritesLimitHint: 'Du kannst pro Typ maximal {count} Favoriten speichern.'
  ,favoriteStart: 'Starten'
  ,favoriteAdjust: 'Anpassen'
  ,favoriteRename: 'Namen ändern'
  ,favoriteDelete: 'Löschen'
  ,favoriteDeleteConfirmTitle: 'Favorit löschen?'
  ,favoriteDeleteConfirmMsg: 'Möchtest du diesen Favoriten wirklich löschen?'
  ,discardDraftConfirmTitle: 'Entwurf verwerfen?'
  ,discardDraftConfirmMsg: 'Dein aktueller Entwurf wird unwiderruflich gelöscht.'
  ,favoriteNamePlaceholder: 'Nur Buchstaben und Zahlen'
  ,favoriteStartFailed: 'Favorit konnte nicht gestartet werden.'
  ,favoriteAdjustFailed: 'Favorit konnte nicht geöffnet werden.'
  ,favoriteRenameFailed: 'Favoritenname konnte nicht aktualisiert werden.'
  ,favoriteDeleteFailed: 'Favorit konnte nicht gelöscht werden.'
  ,quickGenIntroTitle: 'Quick Workout Generator'
  ,quickGenIntroText: 'Erstelle dir mit einem Klick ein neues Workout direkt vom Dashboard aus.\n\nDer Quick Workout Generator erstellt dir ein vollständiges Training basierend auf deinen aktuellen Einstellungen wie Ziel, Trainingsart und verfügbarem Equipment.\n\nIn der kostenlosen Version kannst du den Generator 1 Mal pro Woche nutzen.\n\nDer Quick Generator erstellt eigenständige Workouts ohne langfristige Analyse oder Anpassung an deinen Trainingsverlauf.\n\nMit einem Pro-Abo erhältst du Zugriff auf den vollständigen AI Coach. Dieser analysiert deine bisherigen Trainings, erkennt Muster, passt deine Progression an und erstellt personalisierte Empfehlungen.'
  ,quickGenLearnPro: 'Mehr über Pro erfahren'
  ,quickGenGenerateNow: 'Workout generieren'
  ,quickGenLimitTitle: 'Wochenlimit erreicht'
  ,quickGenLimitText: 'Du hast dein wöchentliches Kontingent für den Quick Workout Generator aufgebraucht.\n\nFreischaltung am: {date}.\n\nMit Pro erhältst du unbegrenzte Generierungen sowie personalisierte Trainingsanalyse und automatische Anpassungen.'
  ,quickGenLastHintTitle: 'Nur noch 1 freie Generierung'
  ,quickGenLastHintText: 'Du kannst den Quick Workout Generator nur noch einmal kostenlos diese Woche nutzen.\n\nFreischaltung am: {date}.\n\nMöchtest du lieber jetzt auf Pro upgraden?'
  ,quickGenContinueFree: 'Letzte freie Nutzung starten'
  ,quickGenFormTitle: 'Quick Workout Generator'
  ,quickGenGenerating: 'Workout wird generiert...'
  ,quickGenDuration: 'Workout-Dauer'
  ,quickGenGoal: 'Fokus'
  ,quickGenGoalMuscle: 'Muskelaufbau'
  ,quickGenGoalStrength: 'Kraft'
  ,quickGenGender: 'Geschlecht'
  ,quickGenGenderMale: 'Männlich'
  ,quickGenGenderFemale: 'Weiblich'
  ,quickGenGenderDiverse: 'Divers'
  ,quickGenBodyweight: 'Körpergewicht (kg)'
  ,quickGenLevel: 'Trainingslevel'
  ,quickGenLevelBeginner: 'Anfänger'
  ,quickGenLevelIntermediate: 'Mittelstufe'
  ,quickGenLevelAdvanced: 'Fortgeschrittener'
  ,quickGenFrequency: 'Trainingsfrequenz / Woche'
  ,quickGenEquipment: 'Equipment'
  ,quickGenEquipmentGymOnly: 'Nur Studio Equipment'
  ,quickGenEquipmentBodyweight: 'Studio + Bodyweight'
  ,quickGenEquipmentBodyweightOnly: 'Nur Bodyweight'
  ,quickGenEquipmentAvailable: 'Verfügbare Geräte'
  ,quickGenEquipBarbell: 'Langhantel'
  ,quickGenEquipDumbbells: 'Kurzhanteln'
  ,quickGenEquipMachines: 'Maschinen'
  ,quickGenEquipCable: 'Kabelzug'
  ,quickGenEquipPullupBar: 'Klimmzugstange'
  ,quickGenMaxPullups: 'Max. strikte Klimmzüge'
  ,quickGenMaxDips: 'Max. strikte Dips'
  ,quickGenMaxPushups: 'Max. strikte Liegestütze'
  ,quickGenSquat1RM: 'Squat 1RM (optional, kg)'
  ,quickGenBench1RM: 'Bench 1RM (optional, kg)'
  ,quickGenDeadlift1RM: 'Deadlift 1RM (optional, kg)'
  ,quickGenSquat5RM: 'Squat 5RM (optional, kg)'
  ,quickGenBench5RM: 'Bench 5RM (optional, kg)'
  ,quickGenDeadlift5RM: 'Deadlift 5RM (optional, kg)'
  ,quickGenRestrictions: 'Bewegungseinschränkungen (optional)'
  ,quickGenRestrictionsPlaceholder: 'z. B. keine Overhead-Bewegungen'
  ,quickGenInjuries: 'Verletzungen (optional)'
  ,quickGenInjuriesPlaceholder: 'z. B. Schulterreizung rechts'
  ,quickGenRemaining: 'Verbleibende Generierungen diese Woche: {count}'
  ,quickGenMissingRequired: 'Bitte fülle alle Pflichtfelder aus (inkl. Benchmarks und Equipment-Verfügbarkeit).'
  ,quickGenAuthRequired: 'Bitte melde dich erneut an, um den Quick Workout Generator zu nutzen.'
  ,quickGenRequestFailed: 'Workout konnte gerade nicht generiert werden. Bitte erneut versuchen.'
  ,quickGenFallbackUsed: 'AI aktuell nicht erreichbar – wir haben ein lokales Workout für dich erstellt.'
    },
    settings: {
      title: 'Einstellungen',
      profileSection: 'Profil',
      profilePicture: 'Profilbild',
      profilePictureHint: 'Wird im Dashboard angezeigt. Empfohlen: quadratisches Foto.',
      profilePictureEmpty: 'Kein Foto',
      profilePictureUpload: 'Hochladen',
      profilePictureRules: 'Erlaubt: JPG/PNG/WebP/HEIC · max. 12 MB (wird vor Upload komprimiert)',
      profilePictureInvalidType: 'Bitte nur JPG, PNG, WebP oder HEIC auswählen.',
      profilePictureTooLarge: 'Bild ist zu groß (max. 12 MB).',
      profilePictureCropTitle: 'Profilbild zuschneiden',
      profilePictureCropHint: 'Ziehe das Bild, um den Ausschnitt zu wählen. Mit dem Regler zoomst du hinein.',
      profilePictureCropZoom: 'Zoom',
      profilePicturePick: 'Aus Fotos wählen',
      profilePicturePickFailed: 'Fotoauswahl fehlgeschlagen.',
      profilePictureDecodeFailed: 'Dieses Foto kann nicht verarbeitet werden. Bitte wähle ein anderes Foto oder nutze „Aus Fotos wählen“ (Zuschneiden).',
      profilePictureNativeAutoUploadHint: 'In der App wird das Foto nach der Auswahl automatisch hochgeladen.',
      app: 'App-Einstellungen',
      username: 'Benutzername',
      usernameHint: 'Wird im Dashboard angezeigt (statt deiner Login-E-Mail).',
      usernamePlaceholder: 'z. B. Max',
      copyTokenDev: 'ID-Token kopieren (Dev)',
      theme: 'Theme',
      themeHint: 'Schalte zwischen hellem und dunklem Erscheinungsbild um.',
      colorMode: 'Farbmodus',
      colorModeHint: 'Passe die Akzentfarben der App an (funktioniert in Hell und Dunkel).',
      colorModeLime: 'Lime',
      colorModeOcean: 'Ocean',
      colorModeViolet: 'Violet',
      colorModeSunset: 'Sunset',
      light: 'Hell',
      dark: 'Dunkel',
      weeklyGoal: 'Wochenziel',
      weeklyGoalHint: 'Lege fest, wie viele Workouts du pro Woche schaffen möchtest.',
      perWeek: 'pro Woche',
      language: 'Sprache',
      german: 'Deutsch',
      english: 'Englisch',
      legalTitle: 'ℹ️ Rechtliches',
      legalHint: 'Impressum, Datenschutz, Nutzungsbedingungen',
      legalLink: 'Rechtliche Hinweise',
      dangerZone: 'Gefahrenzone',
      dangerZoneHint: 'Diese Aktion ist unwiderruflich und löscht alle deine Workout-Daten, Einstellungen und Drafts.',
      deleteAllData: 'Alle Daten löschen',
      confirmDelete: 'Alle Daten löschen?',
      confirmDeleteMsg: 'Diese Aktion kann nicht rückgängig gemacht werden. Alle deine Workouts, Fortschritte und Einstellungen werden permanent gelöscht.',
      typeToConfirm: 'Gib "LÖSCHEN" ein um zu bestätigen:',
      deletePlaceholder: 'LÖSCHEN',
      deleteForever: 'Unwiderruflich löschen',
      deleting: 'Lösche...',
      deleteSuccess: 'Alle Daten wurden gelöscht',
      deleteError: 'Fehler beim Löschen der Daten',
      deleteWarning1: 'Alle Workouts werden permanent gelöscht',
      deleteWarning2: 'Statistiken und Fortschritte gehen verloren',
      deleteWarning3: 'Einstellungen werden zurückgesetzt',
      deleteAccount: 'Account löschen',
      confirmDeleteAccount: 'Account löschen?',
      confirmDeleteAccountMsg: 'Diese Aktion kann nicht rückgängig gemacht werden. Dein Account und alle Daten werden permanent gelöscht.',
      typeToConfirmAccount: 'Gib "ACCOUNT LÖSCHEN" ein um zu bestätigen:',
      deleteAccountPlaceholder: 'ACCOUNT LÖSCHEN',
      deleteAccountForever: 'Account unwiderruflich löschen',
      deletingAccount: 'Lösche Account...',
      deleteAccountSuccess: 'Account wurde gelöscht',
      deleteAccountError: 'Fehler beim Löschen des Accounts',
      deleteAccountWarning1: 'Alle Workouts werden permanent gelöscht',
      deleteAccountWarning2: 'Statistiken und Fortschritte gehen verloren',
      deleteAccountWarning3: 'Einstellungen werden zurückgesetzt',
      deleteAccountWarning4: 'Der Account kann nicht wiederhergestellt werden'
    },
    timer: {
      title: 'Timer',
      open: 'Timer',
      modeInterval: 'Intervall',
      modeStopwatch: 'Stoppuhr',
      statusRunning: 'Aktiv',
      statusPaused: 'Pause',
      statusArmed: 'Bereit',
      statusCompleted: 'Fertig',
      statusRest: 'Intervall',
      intervalLabel: 'Intervall {current}/{total}',
      start: 'Start',
      pause: 'Pause',
      resume: 'Weiter',
      end: 'Beenden',
      reset: 'Zuruecksetzen',
      configTitle: 'Timer konfigurieren',
      hours: 'Stunden',
      minutes: 'Minuten',
      seconds: 'Sekunden',
      prepSeconds: 'Vorbereitung',
      prepTime: 'Vorbereitungszeit',
      directionUp: 'Hoch',
      directionDown: 'Runter',
      restSeconds: 'Pausenzeit',
      intervals: 'Intervalle',
      countdown: 'Countdown',
      countdownSound: 'Countdown-Ton',
      soundNone: 'Aus',
      soundBoxGong: 'Box Gong',
      soundChineseGong: 'China Gong',
      soundBell: 'Glocke',
      speech: 'Sprachausgabe',
      vibration: 'Vibration',
      saveStart: 'Speichern & Starten',
      restoreHint: 'Tippen zum Maximieren',
      minimize: 'Minimieren',
      close: 'Schließen',
      closeConfirmTitle: 'Timer beenden?',
      closeConfirmMsg: 'Der aktuelle Timer wird zurückgesetzt.',
      resetConfirmTitle: 'Timer zurücksetzen?',
      resetConfirmMsg: 'Zeit und Fortschritt werden zurückgesetzt.'
    },
    feedback: {
      title: 'Feedback',
      inboxTitle: 'Inbox',
      inboxHint: 'Hier findest du Feedback deines Coaches – pro Workout als Thread.',
      refresh: 'Aktualisieren',
      empty: 'Noch keine Feedback-Threads',
      offlineHint: 'Offline: Feedback-Inbox ist nur online verfügbar.',
      unknownWorkout: 'Workout',
      you: 'Du',
      coach: 'Coach'
    },
  exercises: {
      title: 'Übungen',
      allTitle: 'Übersicht aller Übungen:',
      loading: 'Lade MongoDB-Übungen...',
      none: 'Keine Übungen aus MongoDB gefunden. Backend prüfen!',
      searchPlaceholder: 'Übung suchen…',
      equipment: 'Equipment',
      bodyweight: 'Bodyweight',
      placeholder: 'Übung suchen…',
      // Mapping für Equipment-Übersetzungen
      // Mapping für Muskelgruppen-Übersetzungen
        // equipmentNames und muscleGroupNames entfernt, da Übersetzungen aus default-exercises.json kommen
      addOrChangePhoto: 'Foto hinzufügen/ändern',
      removePhoto: 'Foto entfernen',
      toastUploaded: 'Foto hochgeladen.',
      toastRemoved: 'Foto entfernt.',
      toastRemoveFailed: 'Entfernen fehlgeschlagen.',
      filters: {
        pushDay: 'Push Day',
        pullDay: 'Pull Day',
        legDay: 'Leg Day',
        bodyweight: 'Körpergewicht',
        gym: 'Fitnessstudio',
        all: 'Alle',
        category: 'Kategorie',
        muscleGroup: 'Muskelgruppe',
        reset: 'Zurücksetzen'
      },
      searchLettersOnly: 'Nur Buchstaben erlaubt.',
      addCustom: 'Eigene Übung hinzufügen',
      addCustomTitle: 'Eigene Übung hinzufügen',
      editCustomTitle: 'Übung bearbeiten',
      nameLabel: 'Name der Übung',
      nameRequired: 'Bitte einen Namen eingeben.',
      muscleGroupLabel: 'Muskelgruppe',
      muscleGroupPlaceholder: 'Bitte wählen',
      notesLabel: 'Notiz (optional)',
      notesPlaceholder: 'z.B. Ersatz für Nordic Curls, näher an meiner tatsächlichen Übung',
      imageLabel: 'Bild (optional)',
      imageAdd: 'Bild wählen',
      imageError: 'Bild konnte nicht verarbeitet werden.',
      imageUploadFailed: 'Übung gespeichert, Bild-Upload fehlgeschlagen.',
      imageSyncHint: 'Bild kann erst nach der ersten Synchronisierung hinzugefügt werden.',
      imagePickTitle: 'Bild auswählen',
      imagePickGallery: 'Aus Galerie wählen',
      imagePickCamera: 'Foto aufnehmen',
      deleteCustomTitle: 'Löschen',
      deleteCustomConfirmTitle: 'Übung löschen',
      deleteCustomConfirmMsg: 'Diese eigene Übung wirklich löschen?',
      // Übersetzungsmapping für deutsche → englische Übungsnamen
      names: {
        // PUSH Übungen
        'Bankdrücken': 'Bench Press',
        'Schrägbankdrücken': 'Incline Bench Press',
        'Kurzhantel-Fliegende': 'Dumbbell Flyes',
        'Liegestütze': 'Push-ups',
        'Dips': 'Dips',
        'Schulterdrücken': 'Overhead Press',
        'Kurzhantel-Schulterdrücken': 'Dumbbell Shoulder Press',
        'Seitheben': 'Lateral Raises',
        'Frontheben': 'Front Raises',
        'Trizeps-Kickbacks': 'Triceps Kickbacks',
        'Overhead Trizepsdrücken': 'Overhead Triceps Extension',
        'Kurzhantel Bankdrücken': 'Dumbbell Bench Press',
        'Maschinen-Brustpresse': 'Chest Press Machine',
        'Arnold Press': 'Arnold Press',
        'Maschinen-Schulterdrücken': 'Shoulder Press Machine',
        'Trizeps Seilzug': 'Cable Triceps Pushdown',
        'Brustpresse Kabelzug': 'Cable Chest Press',
        'Liegestütze mit Gewicht': 'Weighted Push-ups',
        'Military Press': 'Military Press',
        'Trizeps Bankdrücken': 'Close-Grip Bench Press',
        
        // PULL Übungen
        'Klimmzüge': 'Pull-ups',
        'Latzug zur Brust': 'Lat Pulldown',
        'Rudern Langhantel': 'Barbell Rows',
        'Kurzhantelrudern': 'Dumbbell Rows',
        'Rudern Kabelzug': 'Cable Rows',
        'Face Pulls': 'Face Pulls',
        'Bizeps Curls Langhantel': 'Barbell Biceps Curls',
        'Kurzhantel Bizeps Curls': 'Dumbbell Biceps Curls',
        'Hammer Curls': 'Hammer Curls',
        'Konzentrationscurls': 'Concentration Curls',
        'Pullovers Langhantel': 'Barbell Pullovers',
        'Pullovers Kurzhantel': 'Dumbbell Pullovers',
        'Shrugs Kurzhantel': 'Dumbbell Shrugs',
        'Shrugs Langhantel': 'Barbell Shrugs',
        'Umgekehrtes Flys': 'Reverse Flyes',
        'Kabelrudern sitzend': 'Seated Cable Rows',
        'Inverted Rows': 'Inverted Rows',
        'Bizeps Seilzug': 'Cable Biceps Curls',
        'Einarmiges Kabelrudern': 'Single-Arm Cable Rows',
        'Latzug eng zur Brust': 'Close-Grip Lat Pulldown',
        
        // LEGS Übungen
        'Kniebeugen Langhantel': 'Barbell Squats',
        'Frontkniebeugen': 'Front Squats',
        'Beinpresse': 'Leg Press',
        'Ausfallschritte Kurzhantel': 'Dumbbell Lunges',
        'Rumänisches Kreuzheben': 'Romanian Deadlifts',
        'Kreuzheben konventionell': 'Conventional Deadlifts',
        'Beincurls liegend': 'Lying Leg Curls',
        'Beinstrecker': 'Leg Extensions',
        'Wadenheben stehend': 'Standing Calf Raises',
        'Wadenheben sitzend': 'Seated Calf Raises',
        'Sumo Kreuzheben': 'Sumo Deadlifts',
        'Bulgarian Split Squats': 'Bulgarian Split Squats',
        'Step Ups Kurzhantel': 'Dumbbell Step-ups',
        'Hip Thrust Langhantel': 'Barbell Hip Thrusts',
        'Glute Bridge': 'Glute Bridges',
        'Good Mornings': 'Good Mornings',
        'Seitheben Waden': 'Lateral Calf Raises',
        'Einbeinige Beincurls': 'Single-Leg Curls',
        'Leg Curl sitzend': 'Seated Leg Curls',
        'Beinpresse einbeinig': 'Single-Leg Press',
        
        // Fallbacks für häufige Variationen
        'Kniebeugen': 'Squats',
        'Kreuzheben': 'Deadlifts',
        'Bizeps Curls': 'Biceps Curls',
        'Trizepsdrücken': 'Triceps Extension',
        'Rudern': 'Rows'
      }
    },
    workoutDetail: {
      loading: 'Lade Workout...',
      loadError: 'Fehler beim Laden des Workouts.',
      notFound: 'Kein Workout gefunden.',
      localDraft: 'Lokaler Entwurf – bitte anmelden, um dauerhaft zu speichern.',
      exercises: 'Übungen',
      completed: 'Abgeschlossen',
      tapImage: 'Tippe auf das Bild, um es zu {action}.',
      enlarge: 'vergrößern',
      add: 'hinzufügen',
      addExercise: 'Übung hinzufügen',
      weight: 'Gewicht',
      removeSet: 'Satz entfernen',
      addSet: 'Working Set',
      addWarmupSet: 'Warm-Up Set',
      removeWarmupSet: 'Aufwärmsatz entfernen',
      warmupSetsLabel: 'Aufwärmen',
      workingSetsLabel: 'Arbeitssätze',
      set: 'Satz',
      reps: 'Reps',
      actions: 'Aktion',
      chatTitle: 'Feedback / Chat',
      chatEmpty: 'Noch keine Nachrichten',
      chatPlaceholder: 'Schreibe Feedback oder Fragen…',
      chatUnavailableDraft: 'Feedback ist verfügbar, sobald das Workout gespeichert und online synchronisiert ist.',
      chatOfflineHint: 'Offline: Chat ist nur online verfügbar.',
      chatSenderYou: 'Du',
      chatSenderCoach: 'Coach',
      chatSend: 'Senden',
      editOrder: 'Reihenfolge bearbeiten',
      done: 'Fertig',
      reorderHint: 'Ziehen und ablegen, um die Reihenfolge zu ändern.',
      dragToReorder: 'Ziehen zum Umordnen',
      save: 'Speichern',
      saveOnly: 'Nur speichern',
      saveAndUpdateFavorite: 'Speichern + Favorit aktualisieren',
      adjustSave: 'Favorit aktualisieren',
      saveAsFavorite: 'Als Favorit speichern',
      favoriteNameTitle: 'Favorit speichern',
      favoriteNamePlaceholder: 'Favoritenname (Buchstaben und Zahlen)',
      favoriteSaved: 'Favorit gespeichert.',
      adjustSaved: 'Favorit wurde aktualisiert.',
      favoriteNotFound: 'Favorit nicht gefunden – wurde er gelöscht?',
      favoriteNameInvalid: 'Ungültiger Favoritenname.',
      favoriteSaveFailed: 'Favorit konnte nicht gespeichert werden.',
      saving: 'Speichere…',
      cancel: 'Abbrechen',
      leaveConfirm: 'Du hast ungespeicherte Änderungen. Wirklich zum Dashboard zurückkehren?',
      leaveConfirmBack: 'Verwerfen und zurück',
      unsaved: 'Ungespeicherte Änderungen',
      missingNotesTitle: 'Notizen unvollständig',
      missingNotesMessage: 'Zu folgenden Übungen fehlt noch eine Notiz. Notizen helfen der AI-Analyse, dein Training besser einzuschätzen.',
      missingNotesConfirm: 'Trotzdem speichern',
      missingNotesCancel: 'Notizen prüfen',
      removeExerciseConfirmTitle: 'Übung entfernen?',
      removeExerciseConfirmMsg: 'Alle Sätze dieser Übung werden unwiderruflich gelöscht.',
      deleteNoteConfirmTitle: 'Notiz löschen?',
      deleteNoteConfirmMsg: 'Die Notiz zu dieser Übung wird gelöscht.',
      progressionHint: '↑ +2.5–5 kg',
      removePhotoTitle: 'Foto entfernen?',
      removePhotoMsg: 'Möchtest du das Foto wirklich entfernen?',
      removeFailedNoId: 'Bild konnte nicht entfernt werden (fehlende Übungs-ID).',
      toastUploaded: 'Foto hochgeladen.',
      toastRemoved: 'Foto entfernt.',
      toastRemoveFailed: 'Entfernen fehlgeschlagen.',
      saveFailed: 'Speichern fehlgeschlagen.',
      uploadFailed: 'Upload fehlgeschlagen.'
    },
    builder: {
      backToDashboard: '← Zurück',
      backToDashboardTitle: 'Zurück zum Dashboard',
      createTitle: 'Workout erstellen',
      authGate: 'Du musst angemeldet sein, um ein Workout zu erstellen.',
      impulseTitle: 'Kurzer Impuls',
      continue: 'Weiter',
      selectType: 'Typ auswählen',
      pickWorkoutType: 'Workout-Typ auswählen',
      done: 'Fertig',
      availableExercises: 'Verfügbare {type} Übungen',
      pickExercises: 'Übungen auswählen',
      selectExercises: 'Übungen auswählen',
      planTitle: 'Workout Plan ({count} Übungen)',
      removeSet: 'Satz entfernen',
      removeExercise: 'Übung entfernen',
      signInFirst: 'Bitte zuerst anmelden',
      pickFirst: 'Wähle Übungen aus',
      searchPlaceholder: 'Übung suchen…',
      createCta: 'Workout starten',
      creating: 'Erstelle…',
      create: 'Starten',
      sessionNotReady: 'Sitzung noch nicht bereit. Bitte kurz warten und erneut versuchen.',
      createFailed: 'Erstellen fehlgeschlagen. Bitte später erneut versuchen.',
      stepType: 'Typ',
      stepExercises: 'Übungen',
      stepReview: 'Review',
      draftRestored: 'Workout-Entwurf wiederhergestellt'
    },
    charts: {
      progressTitle: 'Gewichtsprogression',
      maxWeight: 'Max Gewicht:',
      weightDataset: 'Gewicht (kg)',
      improvement: 'Steigerung:',
      selectExercise: 'Übung wählen...',
      pickToSee: 'Wähle eine Übung um den Fortschritt zu sehen',
      noData: 'Noch keine Workout-Daten für Fortschritt verfügbar',
      last4Weeks: 'Letzte 4 Wochen',
      last3Months: 'Letzte 3 Monate',
      allTime: 'Gesamtverlauf',
      totalVolume: 'Gesamtvolumen',
      avgVolume: 'Ø Volume'
    },
    stats: {
      loading: 'Lade Statistiken...',
      exercises: 'Übungen',
      workouts: 'Workouts',
      minutes: 'Minuten',
      weeklyGoal: 'Wochenziel',
      overview: 'Übersicht',
      emptyTitle: 'Noch keine Workouts',
      emptyMsg: 'Starte dein erstes Workout um Statistiken zu sehen!',
      diagnostics: {
        statusLabel: 'Status',
        biggestIssueLabel: 'Größtes Problem',
        status: {
          good: '🟢 gut',
          caution: '🟡 beachten',
          risk: '🔴 kritisch'
        },
        metrics: {
          frequency: 'Trainingsfrequenz',
          pushPull: 'Push/Pull Verhältnis',
          recovery: 'Recovery-Stress'
        }
      },
      ai: {
        cockpitLabel: 'AI Progress Cockpit',
        monthlyPulse: 'Monatlicher Pulse',
        loadingCopy: 'Wir holen deine KPIs aus der Cloud …',
        weeklyRhythmTitle: 'Weekly Rhythm',
        weeklyRhythmHint: 'letzte {count} Wochen',
        weekAvgIntensity: 'Ø {value}kg / Session',
        weeklyEmpty: 'Noch keine Wochenhistorie',
        topLiftsTitle: 'Top Lifts',
        topLiftsHint: 'persönliche Bestwerte',
        topLiftsEmpty: 'Noch keine PRs geloggt',
        muscleFocusTitle: 'Muscle Focus',
        muscleFocusHint: 'Volumen-Verteilung',
        muscleEmpty: 'Noch keine Volumen-Daten',
        badges: {
          sessions: '{count} Sessions',
          volume: '{value}kg',
          reps: '{count} Wdh.',
          pr: 'PR'
        },
        kpis: {
          sessions: 'Sessions',
          sessionsHint: 'Ø {value}/Woche',
          avgSessions: 'Ø Sessions/Woche',
          avgSessionsHint: 'Ziel ≥ 3',
          volume: 'Gesamtvolumen',
          avgWeeklyVolume: 'Ø Volumen/Woche',
          volumeHint: 'Ø {value}kg/Woche',
          consistency: 'Konstanz'
        },
        consistencyTaglines: {
          machine: 'Machine Mode',
          steady: 'Sehr stabil',
          onTrack: 'Auf Kurs',
          routine: 'Zeit für Routine'
        }
      },
      widget: {
        title: 'Fortschritt',
        offlineTitle: 'Fortschritt (lokal)',
        fallbackCopy: '{completed} / {total} Workouts erledigt',
        draftsHint: 'Entwürfe werden nicht gezählt.'
      }
    },
    quick: {
      title: 'Deine Woche',
      weeklyGoal: 'Wochenziel',
      dayNames: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
      today: 'Heute',
      lastWorkout: 'Letztes Training',
      workout: 'Workout',
      noTraining: 'Kein Training'
    },
    recent: {
      title: 'Letzte Workouts',
      viewAll: 'Alle anzeigen',
      emptyTitle: 'Noch keine Workouts vorhanden',
      emptyMsg: 'Starte dein erstes Workout, um hier etwas zu sehen.',
      exercises: 'Übungen',
      sets: 'Sätze',
      set: 'Satz',
      moreExercises: 'weitere Übungen',
      noData: 'Keine Daten',
      noSetData: 'Keine Set-Daten verfügbar',
      legacyNote: 'Älteres Format - Editiere das Workout für Details pro Satz',
      showLess: 'Weniger',
      showAll: 'Alle anzeigen',
      notes: 'Notizen',
      created: 'Erstellt',
      status: 'Status',
      completed: 'Abgeschlossen',
      editTitle: 'Workout bearbeiten',
      deleteTitle: 'Workout löschen',
      detailsTitle: 'Details anzeigen',
      deleteConfirm: 'Workout "{name}" wirklich löschen?',
      deleteFailed: 'Workout konnte nicht gelöscht werden.',
      unknownDuration: '?'
    },
    postWorkout: {
      title: 'Workout abgeschlossen!',
      analyzing: 'Analysiere deinen Trainingsfortschritt...',
      feedback: 'Dein Feedback',
      gotIt: 'Verstanden',
      seeDetails: 'Details anschauen',
      saved: 'Dein Workout wurde gespeichert!',
      error: 'Feedback konnte nicht geladen werden',
      insufficientHistorySingle: 'Noch 1 gleiches Workout, dann bekommst du dein erstes Feedback.',
      insufficientHistoryMulti: 'Noch {count} gleiche Workouts, dann bekommst du dein erstes Feedback.',
      insufficientHistoryExplainer: 'Eine wertende Analyse ist erst nach mindestens 4 Wochen bzw. 8 identischen Workouts aussagekräftig.',
      insufficientHistoryOr: '(oder',
      insufficientHistoryDaySingle: 'noch 1 Tag)',
      insufficientHistoryDaysMulti: 'noch {days} Tage)',
      networkUnavailable: 'Workout gespeichert. Die Analyse läuft aktuell nur im Heimnetzwerk (Testphase) — du findest sie später in den Stats, sobald du wieder verbunden bist.'
    },
    feedbackHistory: {
      title: 'KI-Feedback Verlauf',
      empty: 'Noch kein KI-Feedback vorhanden. Schließe ein Workout ab, um dein erstes Feedback zu erhalten.',
      error: 'Feedback-Verlauf konnte nicht geladen werden',
      loadMore: 'Mehr laden',
      share: 'Teilen',
      shareTitle: 'KI-Feedback teilen',
      shareError: 'Teilen ist gerade nicht möglich',
      shareFooter: 'Erstellt mit der ppl App',
      copiedToClipboard: 'In die Zwischenablage kopiert',
      deltaSets: 'Sätze',
      deltaReps: 'Wdh.',
      deltaFirstSession: 'Erstes Training',
      deltaTrend: 'Verlauf über die letzten Sessions',
      ratingQuestion: 'War dieses Feedback hilfreich?',
      ratingHelpful: 'Hilfreich',
      ratingNotHelpful: 'Nicht hilfreich',
      ratingSaving: 'Speichere Bewertung…',
      ratingSaveError: 'Bewertung konnte nicht gespeichert werden',
      ratingDeleteError: 'Bewertung konnte nicht entfernt werden',
      ratingSaved: 'Danke für dein Feedback',
      ratingChange: 'Bewertung ändern',
      ratingRemove: 'Bewertung entfernen',
      ratingCorrectionPlaceholder: 'Was wäre richtig gewesen? (optional)',
      ratingSubmit: 'Absenden',
      ratingCancel: 'Abbrechen',
      ratingReasonHelpful_PROGRESS_RECOGNIZED: 'Fortschritt richtig erkannt',
      ratingReasonHelpful_GOOD_RECOMMENDATION: 'Gute Empfehlung',
      ratingReasonHelpful_CLEARLY_EXPLAINED: 'Verständlich erklärt',
      ratingReasonHelpful_NOTES_CONSIDERED: 'Meine Notizen berücksichtigt',
      ratingReasonNotHelpful_INVENTED_INFORMATION: 'Angaben wurden erfunden',
      ratingReasonNotHelpful_USER_NOTES_IGNORED: 'Meine Notizen wurden ignoriert',
      ratingReasonNotHelpful_EXERCISE_OR_GOAL_MISUNDERSTOOD: 'Übung oder Trainingsziel falsch verstanden',
      ratingReasonNotHelpful_PROGRESS_MISJUDGED: 'Fortschritt falsch bewertet',
      ratingReasonNotHelpful_RECOMMENDATION_UNSUITABLE: 'Empfehlung ist unpassend',
      ratingReasonNotHelpful_CONTRADICTS_MY_DATA: 'Aussage widerspricht meinen Daten',
      ratingReasonNotHelpful_TOO_GENERIC: 'Feedback ist zu allgemein',
      ratingReasonNotHelpful_OTHER: 'Sonstiges',
      ratingWhichExercise: 'Auf welche Übung bezieht sich das?',
      ratingConfirmNoteQuestion: 'Soll ich das künftig bei dieser Übung berücksichtigen?',
      ratingConfirmNoteYes: 'Ja, merken',
      ratingConfirmNoteNo: 'Nein, danke',
      ratingNoteSaved: 'Notiz gespeichert',
      ratingNoteSaveError: 'Notiz konnte nicht gespeichert werden'
    },
    quickGenerator: {
      title: 'KI-Workout generieren',
      intro: 'Beantworte ein paar kurze Fragen, dann erstellen wir ein passendes Workout für dich.',
      goalLabel: 'Ziel',
      goalHypertrophy: 'Muskelaufbau',
      goalStrength: 'Kraft',
      levelLabel: 'Erfahrung',
      levelBeginner: 'Anfänger',
      levelIntermediate: 'Fortgeschritten',
      levelAdvanced: 'Erfahren',
      typeLabel: 'Workout-Typ',
      equipmentLabel: 'Equipment',
      equipmentGym: 'Nur Gym',
      equipmentMixed: 'Gym + Bodyweight',
      equipmentBodyweight: 'Nur Körpergewicht',
      bodyweightHint: 'Bei reinem Bodyweight-Training kann die Übungsauswahl noch ungenauer sein — wir verbessern das laufend.',
      durationLabel: 'Zeit pro Einheit',
      restrictionsLabel: 'Einschränkungen (optional)',
      restrictionsPlaceholder: 'z.B. keine Kniebeugen wegen Knieproblemen',
      generate: 'Workout generieren',
      generating: 'Erstelle dein Workout...',
      error: 'Workout konnte nicht generiert werden. Versuch es noch einmal.'
    },
    welcome: {
      title: 'Push-Pull-Legs!\n',
      signInPrompt: 'Bitte melde dich an, um fortzufahren.',
      redirectingTitle: 'Weiterleitung...',
      redirectingMsg: 'Du wirst zum Dashboard weitergeleitet.',
      skip: 'Überspringen'
    },
    motivation: {
      newQuote: 'Neues Zitat'
    },
    faqs: {
      title: "FAQ's",
      selectQuestion: 'Wähle eine Frage aus',
      selectToRead: 'Wähle eine Frage aus, um die Antwort zu sehen',
      gettingStarted: 'Erste Schritte',
      gettingStartedText: 'Öffne den Startbereich und wähle Push, Pull, Legs oder Full Body. Im Builder suchst du Übungen, tippst sie an und sortierst sie nach Wunsch.\n\nIn der Detailansicht loggst du Sätze, Wiederholungen und Gewicht. Speichern markiert das Workout als erledigt und aktualisiert deine Stats.',
      pushPullLegs: 'Was ist Push/Pull/Legs?',
      pushPullLegsText: 'Push steht für Drückübungen (Brust, Schultern, Trizeps). Pull sind Zugübungen (Rücken, Bizeps). Legs umfasst Beine und Gesäß.\n\nDie App hilft dir, diesen Split schnell umzusetzen: Typ wählen, Übungen auswählen, Reihenfolge anpassen und anschließend alles sauber tracken.',
      navigation: 'Navigation',
      navigationText: 'Unten findest du die Hauptnavigation: Startbereich, Stats, Übungen, FAQ’s und Einstellungen. Der aktive Bereich ist immer hervorgehoben.\n\nSobald ein Workout läuft, kommt zusätzlich ein Workout-Tab dazu, über den du jederzeit zu deinem laufenden Training zurückspringst. Damit die Nav dabei nicht zu eng wird, weicht FAQ für die Dauer des Workouts kurz zur Seite – über die Route bleibt der Bereich aber erreichbar, sobald du das Training beendet hast.\n\nAuf größeren Bildschirmen sitzt die Navigation als Seitenleiste links, damit mehr Platz für Inhalte bleibt.',
      workouts: 'Workouts & Favoriten',
      workoutsText: 'Du kannst Workouts als Entwurf starten und später fortsetzen – auch offline.\n\nIm Detail kannst du Reihenfolge per Drag & Drop ändern, Sätze hinzufügen und Notizen festhalten. Beim Abschluss eines Workouts wählst du explizit, ob du nur speicherst oder zusätzlich den verknüpften Favoriten mit den neuen Werten aktualisierst.\n\nFavoriten sind gespeicherte Workout-Vorlagen: Sie merken sich Übungen, Reihenfolge und Zielwerte, damit du ein wiederkehrendes Training nicht jedes Mal neu zusammenstellen musst.',
      progression: 'Gewichtssteigerung – wann und wie?',
      progressionText: 'Wenn du bei einem Satz **6 oder mehr Wiederholungen** schaffst, zeigt die App direkt in dieser Zeile einen kleinen **↑ Pfeil** an – als Hinweis, das Gewicht beim nächsten Training leicht zu erhöhen (typisch: +2,5–5 kg).\n\nDas Prinzip heißt **Progressive Overload**: Kleine, regelmäßige Steigerungen beim Gewicht oder den Wiederholungen sind der sicherste Weg, stärker zu werden und Muskeln aufzubauen.\n\nEine ausführlichere Einordnung deines Trainingsverlaufs über mehrere Einheiten hinweg gibt dir der KI-Coach, siehe „Was macht der KI-Coach?“.',
      aiCoach: 'Was macht der KI-Coach?',
      aiCoachText: 'Nach einem Workout erstellt die App automatisch eine kurze, sachliche Einordnung deines Trainingsverlaufs im Vergleich zu früheren Sessions – anhand der erfassten Zahlen, nicht anhand von Vermutungen über Technik, Tagesform oder Ausführung, die die App gar nicht erfassen kann.\n\nDu kannst jedes Feedback mit Daumen hoch oder runter bewerten und optional einen Grund oder eine kurze Korrektur angeben – das hilft dabei, künftige Analysen passender zu machen. Diese Bewertung ist rein persönlich und freiwillig, sie beeinflusst nicht, ob du Feedback bekommst.\n\nLöschst du ein Workout wieder, wird das dazugehörige Feedback ebenfalls entfernt, und spätere Analysen greifen nicht mehr auf die gelöschten Werte zurück.',
      uploads: 'Bilder & Uploads',
      uploadsText: 'Tippe auf ein Übungsbild, um eine Vorschau zu sehen oder ein eigenes Bild hochzuladen.\n\nBilder werden automatisch verkleinert, damit sie schnell laden und wenig Speicher brauchen.',
      privacy: 'Datenschutz',
      privacyText: 'Für die Nutzung der App ist ein Konto erforderlich (E-Mail, Google oder Apple). Deine Trainingsdaten sind an dieses Konto gebunden und werden automatisch zwischen deinen Geräten synchronisiert; ohne Anmeldung sind die geschützten Bereiche der App nicht nutzbar.\n\nEinmal angemeldet, funktionieren bereits geladene Inhalte auch offline weiter – Änderungen werden synchronisiert, sobald wieder eine Verbindung besteht.\n\nHinweis: Thumbnails und hochgeladene Bilder werden nur zur Darstellung deiner Übungen verwendet.',
      statsReading: 'Stats richtig lesen',
      statsReadingText: 'Im KI-Feedback-Verlauf zeigt eine kompakte Übersicht je Übung, ob du mehr oder weniger Sätze, Wiederholungen oder Gewicht gemacht hast als beim letzten Mal: Blau steht für mehr, Orange für weniger. Das ist bewusst neutral gehalten – weniger Volumen bei gleichzeitig höherem Gewicht ist keine Verschlechterung, sondern kann eine bewusste Verschiebung hin zu mehr Intensität sein.\n\nIm Workout-Vergleich stellt die App pro Trainingstyp (z. B. Push Day, Leg Day Squats) die letzten beiden passenden Sessions je Übung gegenüber: Gewicht, Wiederholungen und geschätztes 1RM (Einwiederholungsmaximum), mit einem ↑/↓-Pfeil für die Richtung der Veränderung beim geschätzten 1RM.\n\nDie Basis-Statistiken zeigen dir zusätzlich einen Kalender deiner Trainingstage der letzten 30 Tage.',
      about: 'Über diese App',
      version: 'Version'
    },
    upgrade: {
      workoutLimitReached: 'Workout-Limit erreicht',
      workoutLimitMsg: 'Du hast dein Limit von {limit} Workouts pro Woche erreicht.',
      exerciseLimitReached: 'Übungs-Limit erreicht',
      exerciseLimitMsg: 'Pro Workout sind nur {limit} Übungen im Free-Plan erlaubt.',
      mostPopular: 'Beliebteste Wahl',
      month: 'Monat',
      monthly: 'Monatlich',
      yearly: 'Jährlich',
      save2Months: '2 Monate sparen',
      upgradeNow: 'Jetzt upgraden',
      continueFree: 'Mit Free fortfahren',
      processing: 'Wird verarbeitet...',
      securePayment: 'Sichere Zahlung',
      cancelAnytime: 'Jederzeit kündbar',
      allDevices: 'Alle Geräte',
      upgradeSuccess: 'Upgrade erfolgreich!',
      upgradeError: 'Upgrade fehlgeschlagen. Bitte erneut versuchen.',
      features: {
        unlimitedWorkouts: 'Unbegrenzte Workouts',
        aiCoach: 'KI-Coach Empfehlungen',
        advancedStats: 'Erweiterte Statistiken',
        workoutSharing: 'Workout-Sharing',
        customTemplates: 'Eigene Vorlagen',
        up50Friends: 'Bis zu 50 Freunde',
        unlimitedFriends: 'Unbegrenzt Freunde',
        prioritySupport: 'Priority Support',
        earlyAccess: 'Early Access',
        exportData: 'Daten exportieren'
      }
    },
    legal: {
      title: 'Impressum',
      section1Title: 'Angaben gemäß § 5 TMG:',
      section1Address: 'Max Mustermann\nMusterstraße 1\n12345 Musterstadt\nDeutschland',
      section1Mail: 'E-Mail: {email}',
      section1ResponsibleTitle: 'Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV:',
      section1Responsible: 'Max Mustermann\nMusterstraße 1\n12345 Musterstadt',
      copyrightTitle: 'Urheberrecht / Copyright',
      copyrightNotice: '© 2025 Bro Split App. Alle Rechte vorbehalten.',
      copyrightLaw: 'Die Inhalte und Werke in dieser App unterliegen dem deutschen Urheberrecht. Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.',
      disclaimerTitle: 'Haftungsausschluss',
      disclaimer1: 'Die Nutzung dieser App erfolgt auf eigene Gefahr. Die bereitgestellten Trainingspläne, Übungen und Empfehlungen dienen ausschließlich allgemeinen Fitness- und Informationszwecken und ersetzen keine ärztliche Untersuchung, Diagnose oder Behandlung.',
      disclaimer2: 'Personen mit gesundheitlichen Einschränkungen, Verletzungen oder Beschwerden sollten vor der Nutzung der App einen Arzt oder qualifizierten Trainer konsultieren. Die Betreiber übernehmen keine Haftung für Verletzungen, Schäden oder Folgeschäden, die aus der Nutzung der App oder der Befolgung der enthaltenen Trainingshinweise entstehen.',
      userHintsTitle: 'Hinweise für Nutzer',
      userHint1: 'Die App richtet sich an gesunde, sporttaugliche Personen.',
      userHint2: 'Vor Trainingsbeginn wird ein ärztlicher Gesundheitscheck empfohlen.',
      userHint3: 'Bei Schmerzen oder Unwohlsein ist das Training sofort abzubrechen.',
      userHint4: 'Die Nutzung der App ist für Minderjährige nur mit Zustimmung der Erziehungsberechtigten gestattet.',
      privacyTitle: 'Datenschutzerklärung',
      privacy1: '1. Verantwortlicher',
      privacy1Text: 'Verantwortlich für die Datenverarbeitung im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:\nMax Mustermann\nMusterstraße 1\n12345 Musterstadt\nE-Mail: {email}',
      privacy2: '2. Erhebung und Verarbeitung personenbezogener Daten',
      privacy2Text: 'Die App verarbeitet personenbezogene Daten nur, soweit dies zur Bereitstellung, Nutzung oder Verbesserung der App erforderlich ist (z. B. Trainingsdaten, App-Statistiken, Fehlerberichte). Eine Weitergabe an Dritte erfolgt ausschließlich, wenn dies technisch notwendig ist (z. B. Apple iCloud, Hosting-Anbieter) oder eine gesetzliche Verpflichtung besteht.',
      privacy3: '3. Zugriffsdaten & Nutzungsanalyse',
      privacy3Text: 'Zur Verbesserung der App können anonyme Nutzungsdaten (z. B. verwendete Funktionen, Geräteinformationen) ausgewertet werden. Eine personenbezogene Auswertung findet nicht statt.',
      privacy4: '4. Rechte der Nutzer',
      privacy4Text: 'Nutzer haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung und Datenübertragbarkeit ihrer personenbezogenen Daten. Anfragen können per E-Mail an {email} gestellt werden.',
      privacy5: '5. Änderungen',
      privacy5Text: 'Diese Datenschutzerklärung kann bei Bedarf angepasst werden, um rechtliche oder technische Änderungen zu berücksichtigen.',
      lastUpdate: 'Letzte Aktualisierung: 11. November 2025'
    },
  },
  en: {
    common: {
      updated: 'Updated',
      confirm: 'Confirm',
      cancel: 'Cancel',
      done: 'Done',
      close: 'Close',
      remove: 'Remove',
      delete: 'Delete',
      replace: 'Replace',
      add: 'Add',
      save: 'Save',
      saving: 'Saving…',
      loading: 'Loading…',
      back: 'Back',
      error: 'Error',
      yesterday: 'Yesterday',
      unknown: 'Unknown',
      retry: 'Try again',
      photo: 'Photo',
      image: 'Image',
      weight: 'Weight',
      sets: 'Sets',
      reps: 'Reps',
      duration: 'Duration',
      today: 'Today',
      unknownDuration: 'Unknown duration',
      more: 'more',
      select: 'Select'
    },
    auth: {
      signIn: 'Sign in',
      signOut: 'Sign out',
      email: 'Email',
      password: 'Password',
      signUp: 'Sign up',
      haveAccount: 'Already have an account? Sign in',
      noAccount: 'No account? Sign up',
      or: 'or',
      loading: 'Loading...',
      forgotPassword: 'Forgot password?'
    },
    nav: {
      home: 'Home',
      stats: 'Stats',
      exercises: 'Exercises',
      plan: 'Plan',
      faqs: "FAQ's",
      settings: 'Settings',
      legal: 'Legal',
      ariaMain: 'Main navigation'
    },
  dashboard: {
      title: 'Launchpad',
      greetingMorning: 'Good morning',
      greetingDay: 'Good day',
      greetingEvening: 'Good evening',
      refreshTitle: 'Refresh data',
      init: 'Initializing dashboard...',
      loading: 'Loading your workouts...',
      connectionErrorTitle: 'Connection error',
      retry: 'Try again',
      noWorkoutsTitle: 'No workouts yet',
      noWorkoutsMsg: 'Start your first workout and track your progress!',
      startFirst: 'Start first workout',
      successCreated: 'Workout started!',
      nextWorkout: 'Next workout',
      last: 'Last',
      start: 'Start',
      continue: 'continue',
      draftAvailable: 'Draft available',
      deleteDraft: 'Delete draft',
      startNew: 'Start new',
      welcome: 'Welcome!',
  next: 'Next',
  startNext: 'Start next workout',
  lastSaved: 'Last saved',
  resumeDraft: 'Resume last workout?',
  fullBodyLabel: 'Full body',
  workoutTypeInfoTitle: 'Workout type explained',
  workoutTypeInfo: 'Info about this workout type',
  pushInfo: 'Push targets chest, shoulders, and triceps.',
  pullInfo: 'Pull targets back and biceps.',
  legsInfo: 'Legs targets lower body and glutes.',
  freestyleInfo: 'Full body trains the entire body in one session.'
  ,startModeTitle: 'Start workout'
  ,startModeText: 'Do you want to build your workout manually or generate one?'
  ,startModeManual: 'Build manually'
  ,startModeGenerate: 'Generate workout'
  ,startModeFavorites: 'Choose favorite'
  ,startModeTypeTitle: 'Choose {type}'
  ,allFavorites: 'Favorites'
  ,allFavoritesEmpty: 'No favorites saved yet.'
  ,favoritesHint: 'Select a favorite to start immediately or adjust it.'
  ,favoritesEmpty: 'No favorites saved for this type yet.'
  ,favoritesLimitHint: 'You can save up to {count} favorites per type.'
  ,favoriteStart: 'Start'
  ,favoriteAdjust: 'Adjust'
  ,favoriteRename: 'Rename'
  ,favoriteDelete: 'Delete'
  ,favoriteDeleteConfirmTitle: 'Delete favorite?'
  ,favoriteDeleteConfirmMsg: 'Do you really want to delete this favorite?'
  ,discardDraftConfirmTitle: 'Discard draft?'
  ,discardDraftConfirmMsg: 'Your current draft will be permanently deleted.'
  ,favoriteNamePlaceholder: 'Letters and numbers only'
  ,favoriteStartFailed: 'Could not start favorite workout.'
  ,favoriteAdjustFailed: 'Could not open favorite workout.'
  ,favoriteRenameFailed: 'Could not rename favorite workout.'
  ,favoriteDeleteFailed: 'Could not delete favorite workout.'
  ,quickGenIntroTitle: 'Quick Workout Generator'
  ,quickGenIntroText: 'Create a new workout with one click directly from the dashboard.\n\nThe Quick Workout Generator builds a complete session based on your current settings like goal, workout mode and available equipment.\n\nIn the free version you can use the generator once per week.\n\nThe Quick Generator creates standalone workouts without long-term analysis or adaptation to your training history.\n\nWith Pro you get access to the full AI Coach. It analyzes your previous sessions, detects patterns, adjusts progression and creates personalized recommendations.'
  ,quickGenLearnPro: 'Learn more about Pro'
  ,quickGenGenerateNow: 'Generate workout'
  ,quickGenLimitTitle: 'Weekly limit reached'
  ,quickGenLimitText: 'You have used up your weekly quota for the Quick Workout Generator.\n\nUnlocked again on: {date}.\n\nWith Pro you get unlimited generations plus personalized training analysis and automatic adjustments.'
  ,quickGenLastHintTitle: 'Only 1 free generation left'
  ,quickGenLastHintText: 'You can use the Quick Workout Generator only one more time for free this week.\n\nUnlocked again on: {date}.\n\nWould you rather upgrade to Pro now?'
  ,quickGenContinueFree: 'Use last free generation'
  ,quickGenFormTitle: 'Quick Workout Generator'
  ,quickGenGenerating: 'Generating workout...'
  ,quickGenDuration: 'Workout duration'
  ,quickGenGoal: 'Focus'
  ,quickGenGoalMuscle: 'Muscle growth'
  ,quickGenGoalStrength: 'Strength'
  ,quickGenGender: 'Gender'
  ,quickGenGenderMale: 'Male'
  ,quickGenGenderFemale: 'Female'
  ,quickGenGenderDiverse: 'Diverse'
  ,quickGenBodyweight: 'Bodyweight (kg)'
  ,quickGenLevel: 'Training level'
  ,quickGenLevelBeginner: 'Beginner'
  ,quickGenLevelIntermediate: 'Intermediate'
  ,quickGenLevelAdvanced: 'Advanced'
  ,quickGenFrequency: 'Training frequency / week'
  ,quickGenEquipment: 'Equipment'
  ,quickGenEquipmentGymOnly: 'Gym equipment only'
  ,quickGenEquipmentBodyweight: 'Gym + bodyweight'
  ,quickGenEquipmentBodyweightOnly: 'Bodyweight only'
  ,quickGenEquipmentAvailable: 'Available equipment'
  ,quickGenEquipBarbell: 'Barbell'
  ,quickGenEquipDumbbells: 'Dumbbells'
  ,quickGenEquipMachines: 'Machines'
  ,quickGenEquipCable: 'Cable station'
  ,quickGenEquipPullupBar: 'Pull-up bar'
  ,quickGenMaxPullups: 'Max strict pull-ups'
  ,quickGenMaxDips: 'Max strict dips'
  ,quickGenMaxPushups: 'Max strict push-ups'
  ,quickGenSquat1RM: 'Squat 1RM (optional, kg)'
  ,quickGenBench1RM: 'Bench 1RM (optional, kg)'
  ,quickGenDeadlift1RM: 'Deadlift 1RM (optional, kg)'
  ,quickGenSquat5RM: 'Squat 5RM (optional, kg)'
  ,quickGenBench5RM: 'Bench 5RM (optional, kg)'
  ,quickGenDeadlift5RM: 'Deadlift 5RM (optional, kg)'
  ,quickGenRestrictions: 'Movement restrictions (optional)'
  ,quickGenRestrictionsPlaceholder: 'e.g. no overhead pressing'
  ,quickGenInjuries: 'Injuries (optional)'
  ,quickGenInjuriesPlaceholder: 'e.g. right shoulder irritation'
  ,quickGenRemaining: 'Remaining generations this week: {count}'
  ,quickGenMissingRequired: 'Please fill all required fields (including benchmarks and equipment availability).'
  ,quickGenAuthRequired: 'Please sign in again to use the Quick Workout Generator.'
  ,quickGenRequestFailed: 'Could not generate workout right now. Please try again.'
  ,quickGenFallbackUsed: 'AI is currently unavailable — we created a local workout for you.'
    },
    settings: {
      title: 'Settings',
      profileSection: 'Profile',
      profilePicture: 'Profile picture',
      profilePictureHint: 'Shown on the dashboard. Tip: use a square photo.',
      profilePictureEmpty: 'No photo',
      profilePictureUpload: 'Upload',
      profilePictureRules: 'Allowed: JPG/PNG/WebP/HEIC · max 12 MB (compressed before upload)',
      profilePictureInvalidType: 'Please select only JPG, PNG, WebP, or HEIC.',
      profilePictureTooLarge: 'Image is too large (max 12 MB).',
      profilePictureCropTitle: 'Crop profile picture',
      profilePictureCropHint: 'Drag to reposition. Use the slider to zoom in.',
      profilePictureCropZoom: 'Zoom',
      profilePicturePick: 'Choose from Photos',
      profilePicturePickFailed: 'Failed to pick a photo.',
      profilePictureDecodeFailed: 'This photo can’t be processed. Please pick a different one or use “Choose from Photos” (crop).',
      profilePictureNativeAutoUploadHint: 'On mobile, the photo uploads automatically after you pick it.',
      app: 'App Settings',
      username: 'Username',
      usernameHint: 'Shown on the dashboard (instead of your login email).',
      usernamePlaceholder: 'e.g. Max',
      copyTokenDev: 'Copy ID token (dev)',
      theme: 'Theme',
      themeHint: 'Switch between light and dark appearance.',
      colorMode: 'Color mode',
      colorModeHint: 'Adjust the app accent colors (works in light and dark mode).',
      colorModeLime: 'Lime',
      colorModeOcean: 'Ocean',
      colorModeViolet: 'Violet',
      colorModeSunset: 'Sunset',
      light: 'Light',
      dark: 'Dark',
      weeklyGoal: 'Weekly Goal',
      weeklyGoalHint: 'Set how many workouts you aim for per week.',
      perWeek: 'per week',
      language: 'Language',
      german: 'German',
      english: 'English',
      legalTitle: 'ℹ️ Legal',
      legalHint: 'Imprint, privacy policy, terms',
      legalLink: 'Open legal notice',
      dangerZone: 'Danger Zone',
      dangerZoneHint: 'This action is irreversible and will delete all your workout data, settings and drafts.',
      deleteAllData: 'Delete all data',
      confirmDelete: 'Delete all data?',
      confirmDeleteMsg: 'This action cannot be undone. All your workouts, progress and settings will be permanently deleted.',
      typeToConfirm: 'Type "DELETE" to confirm:',
      deletePlaceholder: 'DELETE',
      deleteForever: 'Delete forever',
      deleting: 'Deleting...',
      deleteSuccess: 'All data has been deleted',
      deleteError: 'Error deleting data',
      deleteWarning1: 'All workouts will be permanently deleted',
      deleteWarning2: 'Statistics and progress will be lost',
      deleteWarning3: 'Settings will be reset',
      deleteAccount: 'Delete account',
      confirmDeleteAccount: 'Delete account?',
      confirmDeleteAccountMsg: 'This action cannot be undone. Your account and all data will be permanently deleted.',
      typeToConfirmAccount: 'Type "DELETE ACCOUNT" to confirm:',
      deleteAccountPlaceholder: 'DELETE ACCOUNT',
      deleteAccountForever: 'Delete account forever',
      deletingAccount: 'Deleting account...',
      deleteAccountSuccess: 'Account has been deleted',
      deleteAccountError: 'Error deleting account',
      deleteAccountWarning1: 'All workouts will be permanently deleted',
      deleteAccountWarning2: 'Statistics and progress will be lost',
      deleteAccountWarning3: 'Settings will be reset',
      deleteAccountWarning4: 'The account cannot be restored'
    },
    timer: {
      title: 'Timer',
      open: 'Timer',
      modeInterval: 'Interval',
      modeStopwatch: 'Stopwatch',
      statusRunning: 'Active',
      statusPaused: 'Paused',
      statusArmed: 'Ready',
      statusCompleted: 'Done',
      statusRest: 'Interval',
      intervalLabel: 'Interval {current}/{total}',
      start: 'Start',
      pause: 'Pause',
      resume: 'Resume',
      end: 'End',
      reset: 'Reset',
      configTitle: 'Configure timer',
      hours: 'Hours',
      minutes: 'Minutes',
      seconds: 'Seconds',
      prepSeconds: 'Prep',
      prepTime: 'Prep Time',
      directionUp: 'Up',
      directionDown: 'Down',
      restSeconds: 'Rest',
      intervals: 'Intervals',
      countdown: 'Countdown',
      countdownSound: 'Countdown sound',
      soundNone: 'Off',
      soundBoxGong: 'Box Gong',
      soundChineseGong: 'Chinese Gong',
      soundBell: 'Bell',
      speech: 'Voice',
      vibration: 'Vibration',
      saveStart: 'Save & start',
      restoreHint: 'Tap to maximize',
      minimize: 'Minimize',
      close: 'Close',
      closeConfirmTitle: 'End timer?',
      closeConfirmMsg: 'The current timer will be reset.',
      resetConfirmTitle: 'Reset timer?',
      resetConfirmMsg: 'Time and progress will be reset.'
    },
    feedback: {
      title: 'Feedback',
      inboxTitle: 'Inbox',
      inboxHint: 'Your coach feedback – one thread per workout.',
      refresh: 'Refresh',
      empty: 'No feedback threads yet',
      offlineHint: 'Offline: feedback inbox is only available online.',
      unknownWorkout: 'Workout',
      you: 'You',
      coach: 'Coach'
    },
    exercises: {
      title: 'Exercises',
      allTitle: 'All exercises overview:',
      loading: 'Loading MongoDB exercises...',
      none: 'No exercises from MongoDB found. Check backend!',
      searchPlaceholder: 'Search exercise…',
      equipment: 'Equipment',
      bodyweight: 'Bodyweight',
      placeholder: 'Search exercise…',
      addOrChangePhoto: 'Add/Change photo',
      removePhoto: 'Remove photo',
      toastUploaded: 'Photo uploaded.',
      toastRemoved: 'Photo removed.',
      toastRemoveFailed: 'Remove failed.',
      filters: {
        pushDay: 'Push Day',
        pullDay: 'Pull Day',
        legDay: 'Leg Day',
        bodyweight: 'Bodyweight',
        gym: 'Gym',
        all: 'All',
        category: 'Category',
        muscleGroup: 'Muscle group',
        reset: 'Reset'
      },
      searchLettersOnly: 'Letters only, please.',
      addCustom: 'Add Custom Exercise',
      addCustomTitle: 'Add custom exercise',
      editCustomTitle: 'Edit exercise',
      nameLabel: 'Exercise name',
      nameRequired: 'Please enter a name.',
      muscleGroupLabel: 'Muscle group',
      muscleGroupPlaceholder: 'Please select',
      notesLabel: 'Note (optional)',
      notesPlaceholder: 'e.g. Replacement for Nordic Curls, closer to my actual exercise',
      imageLabel: 'Image (optional)',
      imageAdd: 'Choose image',
      imageError: 'Image could not be processed.',
      imageUploadFailed: 'Exercise saved, image upload failed.',
      imageSyncHint: 'Image can only be added after the first sync.',
      imagePickTitle: 'Choose image',
      imagePickGallery: 'Choose from gallery',
      imagePickCamera: 'Take photo',
      deleteCustomTitle: 'Delete',
      deleteCustomConfirmTitle: 'Delete exercise',
      deleteCustomConfirmMsg: 'Really delete this custom exercise?',
      // Exercise name translation mapping (same as German for reference)
      names: {
        // PUSH Exercises
        'Bankdrücken': 'Bench Press',
        'Schrägbankdrücken': 'Incline Bench Press',
        'Kurzhantel-Fliegende': 'Dumbbell Flyes',
        'Liegestütze': 'Push-ups',
        'Dips': 'Dips',
        'Schulterdrücken': 'Overhead Press',
        'Kurzhantel-Schulterdrücken': 'Dumbbell Shoulder Press',
        'Seitheben': 'Lateral Raises',
        'Frontheben': 'Front Raises',
        'Trizeps-Kickbacks': 'Triceps Kickbacks',
        'Overhead Trizepsdrücken': 'Overhead Triceps Extension',
        'Kurzhantel Bankdrücken': 'Dumbbell Bench Press',
        'Maschinen-Brustpresse': 'Chest Press Machine',
        'Arnold Press': 'Arnold Press',
        'Maschinen-Schulterdrücken': 'Shoulder Press Machine',
        'Trizeps Seilzug': 'Cable Triceps Pushdown',
        'Brustpresse Kabelzug': 'Cable Chest Press',
        'Liegestütze mit Gewicht': 'Weighted Push-ups',
        'Military Press': 'Military Press',
        'Trizeps Bankdrücken': 'Close-Grip Bench Press',
        
        // PULL Exercises
        'Klimmzüge': 'Pull-ups',
        'Latzug zur Brust': 'Lat Pulldown',
        'Rudern Langhantel': 'Barbell Rows',
        'Kurzhantelrudern': 'Dumbbell Rows',
        'Rudern Kabelzug': 'Cable Rows',
        'Face Pulls': 'Face Pulls',
        'Bizeps Curls Langhantel': 'Barbell Biceps Curls',
        'Kurzhantel Bizeps Curls': 'Dumbbell Biceps Curls',
        'Hammer Curls': 'Hammer Curls',
        'Konzentrationscurls': 'Concentration Curls',
        'Pullovers Langhantel': 'Barbell Pullovers',
        'Pullovers Kurzhantel': 'Dumbbell Pullovers',
        'Shrugs Kurzhantel': 'Dumbbell Shrugs',
        'Shrugs Langhantel': 'Barbell Shrugs',
        'Umgekehrtes Flys': 'Reverse Flyes',
        'Kabelrudern sitzend': 'Seated Cable Rows',
        'Inverted Rows': 'Inverted Rows',
        'Bizeps Seilzug': 'Cable Biceps Curls',
        'Einarmiges Kabelrudern': 'Single-Arm Cable Rows',
        'Latzug eng zur Brust': 'Close-Grip Lat Pulldown',
        
        // LEGS Exercises
        'Kniebeugen Langhantel': 'Barbell Squats',
        'Frontkniebeugen': 'Front Squats',
        'Beinpresse': 'Leg Press',
        'Ausfallschritte Kurzhantel': 'Dumbbell Lunges',
        'Rumänisches Kreuzheben': 'Romanian Deadlifts',
        'Kreuzheben konventionell': 'Conventional Deadlifts',
        'Beincurls liegend': 'Lying Leg Curls',
        'Beinstrecker': 'Leg Extensions',
        'Wadenheben stehend': 'Standing Calf Raises',
        'Wadenheben sitzend': 'Seated Calf Raises',
        'Sumo Kreuzheben': 'Sumo Deadlifts',
        'Bulgarian Split Squats': 'Bulgarian Split Squats',
        'Step Ups Kurzhantel': 'Dumbbell Step-ups',
        'Hip Thrust Langhantel': 'Barbell Hip Thrusts',
        'Glute Bridge': 'Glute Bridges',
        'Good Mornings': 'Good Mornings',
        'Seitheben Waden': 'Lateral Calf Raises',
        'Einbeinige Beincurls': 'Single-Leg Curls',
        'Leg Curl sitzend': 'Seated Leg Curls',
        'Beinpresse einbeinig': 'Single-Leg Press',
        
        // Fallbacks for common variations
        'Kniebeugen': 'Squats',
        'Kreuzheben': 'Deadlifts',
        'Bizeps Curls': 'Biceps Curls',
        'Trizepsdrücken': 'Triceps Extension',
        'Rudern': 'Rows'
      }
    },
    workoutDetail: {
      loading: 'Loading workout...',
      loadError: 'Failed to load workout.',
      notFound: 'No workout found.',
      localDraft: 'Local draft — please sign in to save permanently.',
      exercises: 'Exercises',
      completed: 'Completed',
      tapImage: 'Tap the image to {action}.',
      enlarge: 'enlarge',
      add: 'add',
      weight: 'Weight',
      removeSet: 'Remove set',
      addSet: 'Add working set',
      addWarmupSet: 'Add warm-up set',
      removeWarmupSet: 'Remove warm-up set',
      warmupSetsLabel: 'Warm-up',
      workingSetsLabel: 'Working sets',
      set: 'Set',
      reps: 'Reps',
      actions: 'Actions',
      editOrder: 'Edit order',
      done: 'Done',
      reorderHint: 'Drag and drop to change the order.',
      dragToReorder: 'Drag to reorder',
      save: 'Save',
      saveOnly: 'Save only',
      saveAndUpdateFavorite: 'Save + update favorite',
      adjustSave: 'Update favorite',
      saveAsFavorite: 'Save as favorite',
      favoriteNameTitle: 'Save favorite',
      favoriteNamePlaceholder: 'Favorite name (letters and numbers)',
      favoriteSaved: 'Favorite saved.',
      adjustSaved: 'Favorite updated.',
      favoriteNotFound: 'Favorite not found – was it deleted?',
      favoriteNameInvalid: 'Invalid favorite name.',
      favoriteSaveFailed: 'Could not save favorite.',
      saving: 'Saving…',
      cancel: 'Cancel',
      leaveConfirm: 'You have unsaved changes. Really go back to dashboard?',
      leaveConfirmBack: 'Discard and go back',
      unsaved: 'Unsaved changes',
      missingNotesTitle: 'Notes incomplete',
      missingNotesMessage: 'A note is still missing for the following exercises. Notes help the AI analysis better assess your training.',
      missingNotesConfirm: 'Save anyway',
      missingNotesCancel: 'Check notes',
      removeExerciseConfirmTitle: 'Remove exercise?',
      removeExerciseConfirmMsg: 'All sets of this exercise will be permanently deleted.',
      deleteNoteConfirmTitle: 'Delete note?',
      deleteNoteConfirmMsg: 'The note for this exercise will be deleted.',
      progressionHint: '↑ +2.5–5 kg',
      removePhotoTitle: 'Remove photo?',
      removePhotoMsg: 'Do you really want to remove the photo?',
      removeFailedNoId: 'Could not remove image (missing exercise id).',
      toastUploaded: 'Photo uploaded.',
      toastRemoved: 'Photo removed.',
      toastRemoveFailed: 'Remove failed.',
      saveFailed: 'Save failed.',
      uploadFailed: 'Upload failed.',
      addExercise: 'Add Exercise'
    },
    builder: {
      backToDashboard: '← Back',
      backToDashboardTitle: 'Back to dashboard',
      createTitle: 'Create workout',
      authGate: 'You must be signed in to create a workout.',
      impulseTitle: 'Quick boost',
      continue: 'Continue',
      selectType: 'Select type',
      pickWorkoutType: 'Choose workout type',
      done: 'Done',
      availableExercises: 'Available {type} exercises',
      pickExercises: 'Pick exercises',
      selectExercises: 'Select exercises',
      planTitle: 'Workout plan ({count} exercises)',
      removeSet: 'Remove set',
      removeExercise: 'Remove exercise',
      signInFirst: 'Please sign in first',
      pickFirst: 'Pick exercises',
      searchPlaceholder: 'Search exercise…',
      createCta: 'Start workout',
      creating: 'Creating…',
      create: 'Start',
      sessionNotReady: 'Session not ready yet. Please wait a moment and try again.',
      createFailed: 'Creation failed. Please try again later.',
      stepType: 'Type',
      stepExercises: 'Exercises',
      stepReview: 'Review',
      draftRestored: 'Workout draft restored'
    },
    charts: {
      progressTitle: 'Weight progression',
      maxWeight: 'Max weight:',
      weightDataset: 'Weight (kg)',
      improvement: 'Improvement:',
      selectExercise: 'Select exercise...',
      pickToSee: 'Pick an exercise to see progress',
      noData: 'No workout data for progress yet',
      last4Weeks: 'Last 4 weeks',
      last3Months: 'Last 3 months',
      allTime: 'All time',
      totalVolume: 'Total volume',
      avgVolume: 'Avg volume'
    },
    stats: {
      loading: 'Loading statistics...',
      exercises: 'Exercises',
      workouts: 'Workouts',
      minutes: 'Minutes',
      weeklyGoal: 'Weekly goal',
      overview: 'Overview',
      emptyTitle: 'No workouts yet',
      emptyMsg: 'Start your first workout to see statistics!',
      diagnostics: {
        statusLabel: 'Status',
        biggestIssueLabel: 'Biggest issue',
        status: {
          good: '🟢 good',
          caution: '🟡 watch',
          risk: '🔴 critical'
        },
        metrics: {
          frequency: 'Training frequency',
          muscleVolume: 'Muscle volume',
          pushPull: 'Push/Pull ratio',
          progression: 'Progression',
          recovery: 'Recovery stress'
        }
      },
      ai: {
        cockpitLabel: 'AI Progress Cockpit',
        monthlyPulse: 'Monthly Pulse',
        loadingCopy: "We're fetching your KPIs from the cloud…",
        weeklyRhythmTitle: 'Weekly Rhythm',
        weeklyRhythmHint: 'last {count} weeks',
        weekAvgIntensity: 'Ø {value}kg / session',
        weeklyEmpty: 'No weekly history yet',
        topLiftsTitle: 'Top Lifts',
        topLiftsHint: 'personal bests',
        topLiftsEmpty: 'No PRs logged yet',
        muscleFocusTitle: 'Muscle Focus',
        muscleFocusHint: 'Volume split',
        muscleEmpty: 'No volume data yet',
        badges: {
          sessions: '{count} sessions',
          volume: '{value}kg',
          reps: '{count} reps',
          pr: 'PR'
        },
        kpis: {
          sessions: 'Sessions',
          sessionsHint: 'Avg {value}/week',
          avgSessions: 'Avg Sessions/Week',
          avgSessionsHint: 'Target ≥ 3',
          volume: 'Total Volume',
          avgWeeklyVolume: 'Avg Volume/Week',
          volumeHint: 'Avg {value}kg/week',
          consistency: 'Consistency'
        },
        consistencyTaglines: {
          machine: 'Machine mode',
          steady: 'Very steady',
          onTrack: 'On track',
          routine: 'Build the habit'
        }
      },
      widget: {
        title: 'Progress',
        offlineTitle: 'Progress (local)',
        fallbackCopy: '{completed} / {total} workouts completed',
        draftsHint: 'Drafts are not counted.'
      }
    },
    quick: {
      title: 'Your week',
      weeklyGoal: 'Weekly goal',
      dayNames: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
      today: 'Today',
      lastWorkout: 'Last workout',
      workout: 'Workout',
      noTraining: 'No training'
    },
    recent: {
      title: 'Recent workouts',
      viewAll: 'View all',
      emptyTitle: 'No workouts yet',
      emptyMsg: 'Start your first workout to see something here.',
      exercises: 'exercises',
      sets: 'sets',
      set: 'set',
      moreExercises: 'more exercises',
      noData: 'No data',
      noSetData: 'No set data available',
      legacyNote: 'Legacy format - edit workout to see per-set details',
      showLess: 'Less',
      showAll: 'Show all',
      notes: 'Notes',
      created: 'Created',
      status: 'Status',
      completed: 'Completed',
      editTitle: 'Edit workout',
      deleteTitle: 'Delete workout',
      detailsTitle: 'Show details',
      deleteConfirm: 'Do you really want to delete "{name}"?',
      deleteFailed: 'Workout could not be deleted.',
      unknownDuration: 'Unknown duration'
    },
    postWorkout: {
      title: 'Workout complete!',
      analyzing: 'Analyzing your training progress...',
      feedback: 'Your feedback',
      gotIt: 'Got it',
      seeDetails: 'See details',
      saved: 'Your workout has been saved!',
      error: 'Could not load feedback',
      insufficientHistorySingle: '1 more identical workout, then you\'ll get your first feedback.',
      insufficientHistoryMulti: '{count} more identical workouts, then you\'ll get your first feedback.',
      insufficientHistoryExplainer: 'A meaningful, evaluative analysis needs at least 4 weeks or 8 identical workouts.',
      insufficientHistoryOr: '(or',
      insufficientHistoryDaySingle: '1 more day)',
      insufficientHistoryDaysMulti: '{days} more days)',
      networkUnavailable: 'Workout saved. Analysis currently only works on the home network (test phase) — you\'ll find it later in Stats once you\'re reconnected.'
    },
    feedbackHistory: {
      title: 'AI Feedback History',
      empty: 'No AI feedback yet. Complete a workout to get your first feedback.',
      error: 'Could not load feedback history',
      loadMore: 'Load more',
      share: 'Share',
      shareTitle: 'Share AI feedback',
      shareError: 'Sharing is not available right now',
      shareFooter: 'Made with the ppl app',
      copiedToClipboard: 'Copied to clipboard',
      deltaSets: 'sets',
      deltaReps: 'reps',
      deltaFirstSession: 'First session',
      deltaTrend: 'Trend over recent sessions',
      ratingQuestion: 'Was this feedback helpful?',
      ratingHelpful: 'Helpful',
      ratingNotHelpful: 'Not helpful',
      ratingSaving: 'Saving rating…',
      ratingSaveError: 'Could not save rating',
      ratingDeleteError: 'Could not remove rating',
      ratingSaved: 'Thanks for your feedback',
      ratingChange: 'Change rating',
      ratingRemove: 'Remove rating',
      ratingCorrectionPlaceholder: 'What would have been correct? (optional)',
      ratingSubmit: 'Submit',
      ratingCancel: 'Cancel',
      ratingReasonHelpful_PROGRESS_RECOGNIZED: 'Progress recognized correctly',
      ratingReasonHelpful_GOOD_RECOMMENDATION: 'Good recommendation',
      ratingReasonHelpful_CLEARLY_EXPLAINED: 'Clearly explained',
      ratingReasonHelpful_NOTES_CONSIDERED: 'My notes were considered',
      ratingReasonNotHelpful_INVENTED_INFORMATION: 'Information was made up',
      ratingReasonNotHelpful_USER_NOTES_IGNORED: 'My notes were ignored',
      ratingReasonNotHelpful_EXERCISE_OR_GOAL_MISUNDERSTOOD: 'Exercise or training goal misunderstood',
      ratingReasonNotHelpful_PROGRESS_MISJUDGED: 'Progress misjudged',
      ratingReasonNotHelpful_RECOMMENDATION_UNSUITABLE: 'Recommendation is unsuitable',
      ratingReasonNotHelpful_CONTRADICTS_MY_DATA: 'Statement contradicts my data',
      ratingReasonNotHelpful_TOO_GENERIC: 'Feedback is too generic',
      ratingReasonNotHelpful_OTHER: 'Other',
      ratingWhichExercise: 'Which exercise does this refer to?',
      ratingConfirmNoteQuestion: 'Should I take this into account for this exercise going forward?',
      ratingConfirmNoteYes: 'Yes, remember it',
      ratingConfirmNoteNo: 'No, thanks',
      ratingNoteSaved: 'Note saved',
      ratingNoteSaveError: 'Could not save note'
    },
    quickGenerator: {
      title: 'Generate AI Workout',
      intro: 'Answer a few short questions and we\'ll put together a workout for you.',
      goalLabel: 'Goal',
      goalHypertrophy: 'Muscle growth',
      goalStrength: 'Strength',
      levelLabel: 'Experience',
      levelBeginner: 'Beginner',
      levelIntermediate: 'Intermediate',
      levelAdvanced: 'Advanced',
      typeLabel: 'Workout type',
      equipmentLabel: 'Equipment',
      equipmentGym: 'Gym only',
      equipmentMixed: 'Gym + bodyweight',
      equipmentBodyweight: 'Bodyweight only',
      bodyweightHint: 'For bodyweight-only training the exercise selection may still be less precise — we\'re improving this continuously.',
      durationLabel: 'Time per session',
      restrictionsLabel: 'Restrictions (optional)',
      restrictionsPlaceholder: 'e.g. no squats due to knee issues',
      generate: 'Generate workout',
      generating: 'Generating your workout...',
      error: 'Workout could not be generated. Please try again.'
    },
    welcome: {
      title: 'Welcome to the Bro Split App!',
      signInPrompt: 'Please sign in to continue.',
      redirectingTitle: 'Redirecting...',
      redirectingMsg: 'You will be redirected to the dashboard.',
      skip: 'Skip'
    },
    motivation: {
      newQuote: 'New quote'
    },
    faqs: {
      title: "FAQ's",
      selectQuestion: 'Select a question',
      selectToRead: 'Select a question to see the answer',
      gettingStarted: 'Getting started',
      gettingStartedText: 'Open the launchpad and choose Push, Pull, Legs, or Full body. In the builder, search exercises, tap to add, and reorder as needed.\n\nIn the detail view, log sets, reps, and weight. Saving marks the workout complete and updates your stats.',
      pushPullLegs: 'What is Push/Pull/Legs?',
      pushPullLegsText: 'Push covers pressing work (chest, shoulders, triceps). Pull is for pulling work (back, biceps). Legs focuses on lower body and glutes.\n\nThe app helps you run this split fast: choose a type, build your list, and track everything cleanly.',
      navigation: 'Navigation',
      navigationText: 'Use the bottom navigation for the main areas: Launchpad, Stats, Exercises, FAQ’s, and Settings. The active section is always highlighted.\n\nOnce a workout is running, a Workout tab appears so you can jump back to it at any time. To keep the bar from getting too cramped, FAQ steps aside for the duration of the workout — it stays reachable via its route, and returns as a tab as soon as the workout ends.\n\nOn larger screens, navigation moves to a left sidebar to keep content in focus.',
      workouts: 'Workouts & favorites',
      workoutsText: 'You can start workouts as drafts and continue later — even offline.\n\nIn the detail view, reorder with drag & drop, add sets, and leave notes. When you finish a workout, you explicitly choose whether to just save it or also update the linked favorite with the new values.\n\nFavorites are saved workout templates: they remember exercises, order, and target values so you don\'t have to rebuild a recurring workout from scratch every time.',
      progression: 'Weight progression – when and how?',
      progressionText: 'When you complete **6 or more reps** in a set, the app shows a small **↑ arrow** directly in that row — as a reminder to increase the weight slightly next time (typically +2.5–5 kg / +5–10 lbs).\n\nThis principle is called **Progressive Overload**: small, regular increases in weight or reps are the most reliable way to get stronger and build muscle.\n\nFor a more detailed read on your training over multiple sessions, see the AI Coach, described in "What does the AI Coach do?".',
      aiCoach: 'What does the AI Coach do?',
      aiCoachText: 'After a workout, the app automatically creates a short, factual summary of your training compared to earlier sessions — based on the recorded numbers, not on guesses about technique, form, or how you felt that day, none of which the app can actually measure.\n\nYou can rate each piece of feedback with a thumbs up or down and optionally add a reason or a short correction — this helps make future analyses more relevant to you. This rating is purely personal and optional; it does not affect whether you receive feedback.\n\nIf you delete a workout, its feedback is removed along with it, and later analyses no longer draw on the deleted values.',
      uploads: 'Images & uploads',
      uploadsText: 'Tap an exercise image to preview it or upload your own.\n\nImages are resized automatically for fast loading and smaller storage use.',
      privacy: 'Privacy',
      privacyText: 'Using the app requires an account (email, Google, or Apple). Your training data is tied to that account and syncs automatically across your devices; the protected areas of the app aren\'t usable without signing in.\n\nOnce signed in, content you\'ve already loaded keeps working offline — changes sync again once you\'re back online.\n\nNote: Thumbnails and uploaded images are only used to display your exercises.',
      statsReading: 'How to read your stats',
      statsReadingText: 'In the AI feedback history, a compact summary per exercise shows whether you did more or fewer sets, reps, or weight than last time: blue means more, orange means less. This is deliberately kept neutral — less volume alongside higher weight isn\'t a decline, it can be a deliberate shift toward more intensity.\n\nIn the workout comparison, the app compares the last two matching sessions per exercise for each training type (e.g. Push Day, Leg Day Squats): weight, reps, and estimated 1RM (one-rep max), with a ↑/↓ arrow showing the direction of change in estimated 1RM.\n\nThe basic stats also show you a calendar of your training days over the last 30 days.',
      about: 'About this App',
      version: 'Version'
    },
    upgrade: {
      workoutLimitReached: 'Workout Limit Reached',
      workoutLimitMsg: 'You\'ve reached your limit of {limit} workouts per week.',
      exerciseLimitReached: 'Exercise Limit Reached',
      exerciseLimitMsg: 'Only {limit} exercises per workout are allowed in the free plan.',
      mostPopular: 'Most Popular',
      month: 'month',
      monthly: 'Monthly',
      yearly: 'Yearly',
      save2Months: 'Save 2 months',
      upgradeNow: 'Upgrade Now',
      continueFree: 'Continue with Free',
      processing: 'Processing...',
      securePayment: 'Secure Payment',
      cancelAnytime: 'Cancel Anytime',
      allDevices: 'All Devices',
      upgradeSuccess: 'Upgrade successful!',
      upgradeError: 'Upgrade failed. Please try again.',
      features: {
        unlimitedWorkouts: 'Unlimited Workouts',
        aiCoach: 'AI Coach Recommendations',
        advancedStats: 'Advanced Statistics',
        workoutSharing: 'Workout Sharing',
        customTemplates: 'Custom Templates',
        up50Friends: 'Up to 50 Friends',
        everythingPro: 'Everything in Pro',
        unlimitedFriends: 'Unlimited Friends',
        personalCoaching: 'Personal Coaching',
        prioritySupport: 'Priority Support',
        earlyAccess: 'Early Access',
        exportData: 'Export Data'
      }
    },
    legal: {
      title: 'Legal Notice',
      section1Title: 'Information according to § 5 TMG:',
      section1Address: 'Max Mustermann\nMusterstraße 1\n12345 Musterstadt\nGermany',
      section1Mail: 'E-mail: {email}',
      section1ResponsibleTitle: 'Responsible for content according to § 55 Abs. 2 RStV:',
      section1Responsible: 'Max Mustermann\nMusterstraße 1\n12345 Musterstadt',
      copyrightTitle: 'Copyright',
      copyrightNotice: '© 2025 Bro Split App. All rights reserved.',
      copyrightLaw: 'The content and works in this app are subject to German copyright law. Duplication, processing, distribution and any kind of exploitation outside the limits of copyright require the written consent of the respective author or creator.',
      disclaimerTitle: 'Disclaimer',
      disclaimer1: 'Use of this app is at your own risk. The provided training plans, exercises and recommendations are for general fitness and informational purposes only and do not replace medical examination, diagnosis or treatment.',
      disclaimer2: 'Persons with health restrictions, injuries or complaints should consult a doctor or qualified trainer before using the app. The operators accept no liability for injuries, damages or consequential damages resulting from the use of the app or following the training instructions contained therein.',
      userHintsTitle: 'User Guidance',
      userHint1: 'The app is intended for healthy, physically fit persons.',
      userHint2: 'A medical health check is recommended before starting training.',
      userHint3: 'If you experience pain or discomfort, stop training immediately.',
      userHint4: 'Use of the app by minors is only permitted with the consent of their legal guardians.',
      privacyTitle: 'Privacy Policy',
      privacy1: '1. Controller',
      privacy1Text: 'The controller for data processing within the meaning of the GDPR is:\nMax Mustermann\nMusterstraße 1\n12345 Musterstadt\nE-mail: {email}',
      privacy2: '2. Collection and processing of personal data',
      privacy2Text: 'The app processes personal data only to the extent necessary to provide, use or improve the app (e.g. training data, app statistics, error reports). Data is only passed on to third parties if this is technically necessary (e.g. Apple iCloud, hosting provider) or if there is a legal obligation.',
      privacy3: '3. Access data & usage analysis',
      privacy3Text: 'To improve the app, anonymous usage data (e.g. used features, device information) may be evaluated. No personal evaluation takes place.',
      privacy4: '4. User rights',
      privacy4Text: 'Users have the right to information, correction, deletion, restriction of processing and data portability of their personal data. Requests can be sent by e-mail to {email}.',
      privacy5: '5. Changes',
      privacy5Text: 'This privacy policy may be adapted as necessary to take account of legal or technical changes.',
      lastUpdate: 'Last update: 11 November 2025'
    },
  }
}

export function createI18nInstance() {
  const locale = detectLocale()
  return createI18n({
    legacy: false,
    locale,
    fallbackLocale: 'en',
    messages,
    missingWarn: false,
    fallbackWarn: false,
    linkKey: '$:' // avoid conflicts with literal @ in translations
  })
}

export function setLocale(i18n, locale) {
  i18n.global.locale.value = locale
  try { localStorage.setItem(STORAGE_KEY, locale) } catch {}
}

export function getStoredLocale() {
  try { return localStorage.getItem(STORAGE_KEY) || detectLocale() } catch { return detectLocale() }
}
