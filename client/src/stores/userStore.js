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
        async startWorkout(type, token = null) {
          // Wrapper für createWorkout mit minimalen Daten
          const workoutData = { type, name: `${type.charAt(0).toUpperCase() + type.slice(1)} Day` };
          return await this.createWorkout(workoutData, token);
        },
    async loadWorkouts(token = null, options = {}) {
      // Workouts per API vom Server laden
      this.error = null;
      this.loadingWorkouts = true;
      try {
        const { fetchWorkouts } = await import('@/api/workouts');
        const workouts = await fetchWorkouts(token);
        this.workouts = Array.isArray(workouts) ? workouts : [];
        this.workoutsLoaded = true;
        this.workoutsLoadedAt = Date.now();
        console.log(`✅ [API] Loaded ${this.workouts.length} workouts from server`);
        return this.workouts;
      } catch (error) {
        console.error('❌ [API] Error loading workouts from server:', error);
        this.error = error?.message || 'Fehler beim Laden der Workouts';
        this.workouts = [];
      } finally {
        this.loadingWorkouts = false;
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
      // Workout per API erstellen
      try {
        console.log('DEBUG: createWorkout token:', token, 'data:', workoutData);
        const { createWorkout } = await import('@/api/workouts');
        const newWorkout = await createWorkout(workoutData, token);
        if (newWorkout) {
          this.workouts.push(newWorkout);
          console.log('✅ [API] Workout created:', newWorkout._id);
        }
        return newWorkout;
      } catch (error) {
        console.error('❌ [API] Error creating workout:', error);
        throw error;
      }
    },

    async updateWorkout(id, updates, token = null) {
      // Wenn kein gültiges ObjectId: als neues Workout anlegen (POST)
      const isValidObjectId = typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
      if (!isValidObjectId) {
        try {
          const { createWorkout } = await import('@/api/workouts');
          // type aus vorhandenem Draft holen, falls nicht im updates-Objekt
          let draftType = updates.type;
          if (!draftType) {
            const draft = this.workouts.find(w => w._id === id);
            if (draft && draft.type) draftType = draft.type;
          }
          // Name automatisch nach Typ setzen, falls nicht vorhanden
          let draftName = updates.name;
          if (!draftName && draftType) {
            if (draftType.toLowerCase() === 'push') draftName = 'Push Day';
            else if (draftType.toLowerCase() === 'pull') draftName = 'Pull Day';
            else if (draftType.toLowerCase() === 'legs') draftName = 'Leg Day';
          }
          const newWorkout = await createWorkout({ ...updates, type: draftType, name: draftName }, token);
          // Entferne alle alten Drafts/temporären Workouts aus dem Store
          this.workouts = this.workouts.filter(w => /^[a-f\d]{24}$/i.test(w._id));
          // Füge das neue Workout hinzu
          if (newWorkout) {
            this.workouts.push(newWorkout);
            console.log('✅ [API] Draft als neues Workout gespeichert und alte Drafts entfernt:', newWorkout._id);
            // Lösche Draft aus Offline-DB, falls vorhanden
            try {
              const { db } = await import('@/utils/offlineStorage');
              await db.workouts.delete('draft');
            } catch (e) { /* ignore */ }
          }
          return newWorkout;
        } catch (error) {
          console.error('❌ [API] Error creating workout from draft:', error);
          throw error;
        }
      }
      // Andernfalls normales Update (PUT)
      try {
        const { updateWorkout } = await import('@/api/workouts');
        const updatedWorkout = await updateWorkout(id, updates, token);
        const idx = this.workouts.findIndex(w => w._id === id);
        if (updatedWorkout && idx !== -1) {
          this.workouts[idx] = { ...this.workouts[idx], ...updatedWorkout };
          console.log('✅ [API] Workout updated:', id);
        }
        return updatedWorkout;
      } catch (error) {
        console.error('❌ [API] Error updating workout:', error);
        throw error;
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
