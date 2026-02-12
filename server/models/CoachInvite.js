import mongoose from 'mongoose'

const coachInviteSchema = new mongoose.Schema({
  clientUid: {
    type: String,
    required: true,
    index: true
  },
  coachUid: {
    type: String,
    required: true,
    index: true
  },
  coachEmailLower: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'revoked', 'canceled', 'expired'],
    default: 'pending',
    index: true
  },
  consentTextVersion: {
    type: String,
    default: ''
  },
  consentLocale: {
    type: String,
    default: ''
  },
  consentGivenAt: {
    type: Date
  },
  expiresAt: {
    type: Date,
    index: true
  },
  acceptedAt: {
    type: Date
  },
  revokedAt: {
    type: Date
  },
  canceledAt: {
    type: Date
  }
}, {
  timestamps: true
})

coachInviteSchema.index({ clientUid: 1, coachUid: 1, status: 1 })
coachInviteSchema.index({ coachUid: 1, status: 1, createdAt: -1 })

const CoachInvite = mongoose.model('CoachInvite', coachInviteSchema)

export default CoachInvite
