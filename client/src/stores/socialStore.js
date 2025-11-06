/**
 * 👥 Social Features Store für Workout-Sharing und Community
 * 
 * @description
 * Verwaltet Social Features wie:
 * - Workout-Sharing mit Freunden
 * - Friends Feed (Activity Stream)
 * - Likes und Kommentare
 * - Challenges erstellen
 * - Leaderboards
 * 
 * @status 🚧 Future Feature - Noch nicht in Production
 * @requires Premium Subscription für Sharing-Features
 * 
 * @example
 * ```javascript
 * import { useSocialStore } from '@/stores/socialStore'
 * 
 * const social = useSocialStore()
 * await social.shareWorkout(workoutId, 'Neuer PR! 💪')
 * await social.loadFriendsFeed()
 * ```
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getAuthToken } from '@/utils/authToken'

export const useSocialStore = defineStore('social', () => {
  const friends = ref([])
  const sharedWorkouts = ref([])
  const challenges = ref([])
  const leaderboard = ref([])
  
  // Workout teilen
  const shareWorkout = async (workoutId, message = '') => {
    try {
      const response = await fetch('/api/social/share-workout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({
          workoutId,
          message,
          visibility: 'friends' // oder 'public'
        })
      })
      
      if (response.ok) {
        const sharedWorkout = await response.json()
        sharedWorkouts.value.unshift(sharedWorkout)
        return sharedWorkout
      }
    } catch (error) {
      console.error('Share workout error:', error)
      throw error
    }
  }
  
  // Freunde-Feed laden
  const loadFriendsFeed = async () => {
    try {
      const response = await fetch('/api/social/friends-feed', {
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`
        }
      })
      
      if (response.ok) {
        const feed = await response.json()
        sharedWorkouts.value = feed
        return feed
      }
    } catch (error) {
      console.error('Load friends feed error:', error)
    }
  }
  
  // Workout liken
  const likeWorkout = async (sharedWorkoutId) => {
    try {
      const response = await fetch(`/api/social/like/${sharedWorkoutId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`
        }
      })
      
      if (response.ok) {
        // Update lokal
        const workout = sharedWorkouts.value.find(w => w._id === sharedWorkoutId)
        if (workout) {
          workout.likes = (workout.likes || 0) + 1
          workout.isLiked = true
        }
      }
    } catch (error) {
      console.error('Like workout error:', error)
    }
  }
  
  // Weekly Challenge erstellen
  const createChallenge = async (challengeData) => {
    try {
      const response = await fetch('/api/social/challenges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify(challengeData)
      })
      
      if (response.ok) {
        const challenge = await response.json()
        challenges.value.unshift(challenge)
        return challenge
      }
    } catch (error) {
      console.error('Create challenge error:', error)
      throw error
    }
  }
  
  // Leaderboard für Freunde (basierend auf Volume, Frequency, etc.)
  const loadLeaderboard = async (period = 'week') => {
    try {
      const response = await fetch(`/api/social/leaderboard?period=${period}`, {
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        leaderboard.value = data
        return data
      }
    } catch (error) {
      console.error('Load leaderboard error:', error)
    }
  }
  
  // Computed Properties
  const friendsCount = computed(() => friends.value.length)
  const myRank = computed(() => {
    const userRank = leaderboard.value.findIndex(user => user.isCurrentUser)
    return userRank >= 0 ? userRank + 1 : null
  })
  
  return {
    // State
    friends,
    sharedWorkouts,
    challenges,
    leaderboard,
    
    // Actions
    shareWorkout,
    loadFriendsFeed,
    likeWorkout,
    createChallenge,
    loadLeaderboard,
    
    // Computed
    friendsCount,
    myRank
  }
})