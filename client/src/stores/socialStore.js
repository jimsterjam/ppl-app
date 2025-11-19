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
// Avoid useClerk/useAuth in stores (would call inject() outside setup).

export const useSocialStore = defineStore('social', () => {
  // Do not call useClerk/useAuth here. Use getAuthToken() when needed.
  const friends = ref([])
  const sharedWorkouts = ref([])
  const challenges = ref([])
  const leaderboard = ref([])
  
  // Offline/Demo: Workout teilen lokal simulieren
  const shareWorkout = async (workoutId, message = '') => {
    const sharedWorkout = {
      _id: `${workoutId}-${Date.now()}`,
      workoutId,
      message,
      visibility: 'friends',
      createdAt: new Date().toISOString(),
      likes: 0,
      isLiked: false
    }
    sharedWorkouts.value.unshift(sharedWorkout)
    localStorage.setItem('bro_split_shared_workouts', JSON.stringify(sharedWorkouts.value))
    return sharedWorkout
  }
  
  // Offline/Demo: Freunde-Feed aus localStorage laden
  const loadFriendsFeed = async () => {
    const feed = JSON.parse(localStorage.getItem('bro_split_shared_workouts') || '[]')
    sharedWorkouts.value = feed
    return feed
  }
  
  // Offline/Demo: Workout liken lokal simulieren
  const likeWorkout = async (sharedWorkoutId) => {
    const workout = sharedWorkouts.value.find(w => w._id === sharedWorkoutId)
    if (workout) {
      workout.likes = (workout.likes || 0) + 1
      workout.isLiked = true
      localStorage.setItem('bro_split_shared_workouts', JSON.stringify(sharedWorkouts.value))
    }
  }
  
  // Offline/Demo: Challenge lokal erstellen
  const createChallenge = async (challengeData) => {
    const challenge = {
      ...challengeData,
      _id: `challenge-${Date.now()}`,
      createdAt: new Date().toISOString()
    }
    challenges.value.unshift(challenge)
    localStorage.setItem('bro_split_challenges', JSON.stringify(challenges.value))
    return challenge
  }
  
  // Offline/Demo: Leaderboard lokal simulieren
  const loadLeaderboard = async (period = 'week') => {
    // Demo-Daten für Leaderboard
    const demoLeaderboard = [
      { name: 'Du', isCurrentUser: true, volume: 12000, rank: 1 },
      { name: 'Anna', isCurrentUser: false, volume: 11000, rank: 2 },
      { name: 'Ben', isCurrentUser: false, volume: 9500, rank: 3 }
    ]
    leaderboard.value = demoLeaderboard
    return demoLeaderboard
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