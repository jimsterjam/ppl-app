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
  }
}, {
  timestamps: true
})

const UserProfile = mongoose.model('UserProfile', userProfileSchema)

export default UserProfile
