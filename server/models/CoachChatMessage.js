import mongoose from 'mongoose'

const coachChatMessageSchema = new mongoose.Schema({
  clientUid: {
    type: String,
    required: true,
    index: true
  },
  // Optional: for messages written by a specific coach. Client messages can be broadcast (empty).
  coachUid: {
    type: String,
    default: '',
    index: true
  },
  workoutId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  sender: {
    type: String,
    enum: ['client', 'coach'],
    required: true,
    index: true
  },
  text: {
    type: String,
    required: true
  }
}, {
  timestamps: true
})

coachChatMessageSchema.index({ clientUid: 1, workoutId: 1, createdAt: 1 })
coachChatMessageSchema.index({ coachUid: 1, workoutId: 1, createdAt: 1 })

const CoachChatMessage = mongoose.model('CoachChatMessage', coachChatMessageSchema)

export default CoachChatMessage
