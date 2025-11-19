import { defineStore } from "pinia";


export const useUserStore = defineStore("user", {
  state: () => ({
    user: null,
    workouts: [],
    stats: null,
    // Separate Lade-Flags und Cache-Metadaten
    loadingWorkouts: false,
    loadingStats: false,
    workoutsLoaded: false,
    workoutsLoadedAt: 0,
    error: null
  }),

  getters: {
    // Computed properties für die UI
    totalWorkouts: (state) => state.workouts.filter(w => !w.isDraft).length,
    
    completedWorkoutsCount: (state) => 
      state.workouts.filter(w => {
        if (w.isDraft) return false;
        if (w.completed) return true;
        const hasSets = (w?.exercises || []).some(ex => {
          const sets = ex?.setDetails?.length ?? ex?.sets ?? 0;
          return sets > 0;
        });
        return hasSets;
      }).length,
    
    todaysWorkout: (state) => {
      const today = new Date().toISOString().split('T')[0];
      return state.workouts.find(w => 
        (w?.date || '').startsWith(today) && !w.completed && !w.isDraft
      );
    },

    // Letztes gespeichertes Workout (kein Draft), nach updatedAt oder date
    lastSavedWorkout: (state) => {
      const list = state.workouts.filter(w => !w.isDraft);
      if (list.length === 0) return null;
      return [...list].sort((a, b) => {
        const ad = new Date(a.updatedAt || a.date || 0).getTime();
        const bd = new Date(b.updatedAt || b.date || 0).getTime();
        return bd - ad;
      })[0] || null;
    },

    workoutsByType: (state) => (type) => 
      state.workouts.filter(w => !w.isDraft && w.type === type),

    hasError: (state) => !!state.error,

    // Für kompatible Nutzung im Dashboard
    isLoading: (state) => state.loadingWorkouts,
    isWorkoutsLoading: (state) => state.loadingWorkouts,
    isStatsLoading: (state) => state.loadingStats
  },

  actions: {
    async loadWorkouts(token = null, options = {}) {
      // Offline/Demo: Workouts aus localStorage laden
      this.error = null;
      this.loadingWorkouts = true;
      try {
        const data = localStorage.getItem('bro_split_workouts')
        if (data) {
          this.workouts = JSON.parse(data)
          this.workoutsLoaded = true
          this.workoutsLoadedAt = Date.now()
          console.log(`✅ [Demo] Loaded ${this.workouts.length} workouts from localStorage`)
        } else {
          this.workouts = []
          this.workoutsLoaded = true
          this.workoutsLoadedAt = Date.now()
          console.log('⚠️ [Demo] No workouts in localStorage, empty list')
        }
        return this.workouts
      } catch (error) {
        console.error('❌ [Demo] Error loading workouts from localStorage:', error)
        this.error = null
        this.workouts = []
      } finally {
        this.loadingWorkouts = false
      }
    },

    async loadStats(token = null) {
      // Offline/Demo: Stats aus localStorage laden
      this.loadingStats = true
      this.error = null
      try {
        const data = localStorage.getItem('bro_split_stats')
        if (data) {
          this.stats = JSON.parse(data)
          console.log('✅ [Demo] Stats loaded from localStorage:', this.stats)
        } else {
          this.stats = null
          console.log('⚠️ [Demo] No stats in localStorage')
        }
      } catch (error) {
        console.error('❌ [Demo] Error loading stats from localStorage:', error)
        this.stats = null
      } finally {
        this.loadingStats = false
      }
    },

    async createWorkout(workoutData, token = null) {
      // Offline/Demo: Workout lokal erstellen
      try {
        const newWorkout = {
          ...workoutData,
          _id: `offline_${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        this.workouts.push(newWorkout)
        localStorage.setItem('bro_split_workouts', JSON.stringify(this.workouts))
        console.log('✅ [Demo] Workout created offline:', newWorkout._id)
        return newWorkout
      } catch (error) {
        console.error('❌ [Demo] Error creating workout:', error)
        throw error
      }
    },

    async updateWorkout(id, updates, token = null) {
      // Offline/Demo: Workout lokal updaten
      try {
        const idx = this.workouts.findIndex(w => w._id === id)
        if (idx !== -1) {
          this.workouts[idx] = { ...this.workouts[idx], ...updates, updatedAt: new Date().toISOString() }
          localStorage.setItem('bro_split_workouts', JSON.stringify(this.workouts))
          console.log('✅ [Demo] Workout updated offline:', id)
          return this.workouts[idx]
        }
        return null
      } catch (error) {
        console.error('❌ [Demo] Error updating workout:', error)
        throw error
      }
    },

    async markWorkoutCompleted(id, token = null) {
      // Offline/Demo: Workout lokal als abgeschlossen markieren
      try {
        const idx = this.workouts.findIndex(w => w._id === id)
        if (idx !== -1) {
          this.workouts[idx] = {
            ...this.workouts[idx],
            completed: true,
            completedAt: new Date().toISOString()
          }
          localStorage.setItem('bro_split_workouts', JSON.stringify(this.workouts))
          console.log('✅ [Demo] Workout marked completed offline:', id)
          return this.workouts[idx]
        }
        return null
      } catch (error) {
        console.error('❌ [Demo] Error completing workout:', error)
        throw error
      }
    },

    // Hilfsmethoden
    getTodaysWorkout() {
      const today = new Date().toISOString().split('T')[0];
      return this.workouts.find(w => 
        w.date.startsWith(today) && !w.completed
      );
    },

    getCompletedWorkouts() {
      return this.workouts.filter(w => {
        if (w.isDraft) return false;
        if (w.completed) return true;
        const hasSets = (w?.exercises || []).some(ex => {
          const sets = ex?.setDetails?.length ?? ex?.sets ?? 0;
          return sets > 0;
        });
        return hasSets;
      });
    },

    getWorkoutsByType(type) {
      return this.workouts.filter(w => w.type === type);
    }
  }
});
