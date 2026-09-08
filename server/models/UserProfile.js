import mongoose from 'mongoose'

const userProfileSchema = new mongoose.Schema({
  uid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  username: {
    type: String,
    default: ''
  },
  avatarUrl: {
    // Stored as relative path under /uploads (e.g. /uploads/avatars/<uid>.jpg)
    type: String,
    default: ''
  },
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'pro', 'elite'],
      default: 'free'
    },
    status: {
      type: String,
      enum: ['active', 'canceled', 'past_due'],
      default: 'active'
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'yearly', null],
      default: null
    },
    expiresAt: {
      type: Date,
      default: null
    }
  },
  // Umgestellt von wöchentlichem auf monatliches Kontingent-Fenster (Feld hieß vorher
  // weekWindowStart/weeklyCount) - bestehende Dokumente mit den alten Feldnamen starten dadurch
  // einmalig wieder bei 0 Aufrufen in diesem Monat, was unkritisch ist (reine Nutzungszählung,
  // keine Trainingsdaten).
  aiUsage: {
    monthWindowStart: {
      type: Date,
      default: null
    },
    monthlyCount: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  analyticsEnabled: {
    type: Boolean,
    default: false
  },
  // Onboarding-Flow (5-seitige Einführung nach erstem Login, siehe OnboardingFlow.vue) +
  // einmalige kontextuelle Hinweise (siehe OneTimeHint.vue). Server-seitig statt nur lokal
  // gespeichert, damit der Status geräteübergreifend konsistent ist (z.B. Login auf neuem
  // iPhone zeigt den Flow nicht erneut) - orientiert sich an derselben
  // getOrCreateUserProfile()-Architektur wie subscription/aiUsage oben. completedAt und
  // skippedAt sind beide additiv (kein Enum-Status), damit unterscheidbar bleibt, ob der
  // Nutzer den Flow bewusst durchlaufen oder übersprungen hat, ohne das Kern-Verhalten
  // ("nicht erneut automatisch zeigen") zu verkomplizieren - beide zählen gleichwertig als
  // "erledigt" (siehe hasCompletedOnboarding in routes/account.js).
  onboarding: {
    completedAt: {
      type: Date,
      default: null
    },
    skippedAt: {
      type: Date,
      default: null
    },
    // IDs der einzeln dauerhaft ausgeblendeten kontextuellen Hinweise (z.B. 'first-workout-open',
    // 'first-exercise-note', 'first-workout-saved') - freie Strings statt Enum, damit neue
    // Hinweise ohne Schema-Migration ergänzt werden können.
    dismissedHints: {
      type: [String],
      default: []
    }
  }
}, {
  timestamps: true
})

const UserProfile = mongoose.model('UserProfile', userProfileSchema)

export default UserProfile
