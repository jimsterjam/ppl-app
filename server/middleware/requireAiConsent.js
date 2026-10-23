import UserProfile from '../models/UserProfile.js'
import { createRequireAiConsent } from '../utils/aiConsent.js'

export const requireAiConsent = createRequireAiConsent({
  loadProfile: (uid) => UserProfile.findOne({ uid }).select('aiConsent').lean()
})
