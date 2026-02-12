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
  coaches: {
    type: [String],
    default: []
  }
}, {
  timestamps: true
})

userProfileSchema.index({ coaches: 1 })

const UserProfile = mongoose.model('UserProfile', userProfileSchema)

export default UserProfile
