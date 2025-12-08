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
      const workout = state.workouts.find(w => 
        (w?.date || '').startsWith(today) && (w.completed === false || w.completed === undefined) && !w.isDraft
      );
      console.log('🧠 [userStore] todaysWorkout:', workout ? { _id: workout._id, name: workout.name, completed: workout.completed, isDraft: workout.isDraft } : null);
      return workout;
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
    isStatsLoading: (state) => state.loadingStats,

    hasDraft: (state) => {
      const has = state.workouts.some(w => w.isDraft);
      console.log('🧠 [userStore] hasDraft:', has, 'drafts:', state.workouts.filter(w => w.isDraft).map(w => ({ _id: w._id, name: w.name })));
      return has;
    },

    draftType: (state) => state.workouts.find(w => w.isDraft)?.type,

    draftTimestamp: (state) => {
      const draft = state.workouts.find(w => w.isDraft);
      if (!draft) return null;
      const ts = draft.updatedAt || draft.date || draft._syncedAt || draft.createdAt;
      const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
      return isNaN(d.getTime()) ? null : d;
    }
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
        // Setze completed: false für Workouts ohne completed Feld (Migration)
        this.workouts = this.workouts.map(w => ({
          ...w,
          completed: w.completed !== undefined ? w.completed : false
        }));
        this.workoutsLoaded = true;
        this.workoutsLoadedAt = Date.now();
        console.log(`✅ [API] Loaded ${this.workouts.length} workouts from server:`, this.workouts.map(w => ({ _id: w._id, name: w.name, completed: w.completed, isDraft: w.isDraft })));

        // Lokale Drafts laden und hinzufügen
        try {
          const { getWorkoutOffline } = await import('@/utils/offlineStorage');
          const localDraft = await getWorkoutOffline('draft');
          if (localDraft) {
            // Stelle sicher, dass isDraft gesetzt ist
            localDraft.isDraft = true;
            this.workouts.push(localDraft);
            console.log('✅ [Offline] Draft geladen und hinzugefügt:', { _id: localDraft._id, name: localDraft.name });
          } else {
            console.log('ℹ️ [Offline] Kein lokaler Draft gefunden');
          }
        } catch (e) {
          console.warn('⚠️ Fehler beim Laden des lokalen Drafts:', e);
        }

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
      console.log('🏗️ [userStore] createWorkout called:', workoutData, 'token:', !!token);
      try {
        console.log('DEBUG: createWorkout token:', token, 'data:', workoutData);
        const { createWorkout } = await import('@/api/workouts');
        const newWorkout = await createWorkout(workoutData, token);
        console.log('🏗️ [userStore] API returned:', newWorkout);
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
      console.log('📡 [userStore] updateWorkout called:', id, updates);
      // Wenn kein gültiges ObjectId: als neues Workout anlegen (POST)
      const isValidObjectId = typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
      if (!isValidObjectId) {
        console.log('📡 [userStore] Invalid ObjectId, creating new workout');
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
            console.log('✅ [userStore] New workout created:', newWorkout._id, 'completed:', newWorkout.completed);
            // Lösche Draft aus Offline-DB, falls vorhanden
            try {
              const { db } = await import('@/utils/offlineStorage');
              await db.workouts.delete('draft');
            } catch (e) { /* ignore */ }
          }
          return newWorkout;
        } catch (error) {
          console.error('❌ [userStore] Error creating workout from draft:', error);
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
          // Sicherstellen, dass completed gesetzt wird, falls der Server es nicht zurückgibt
          if (updates.completed !== undefined) {
            this.workouts[idx].completed = updates.completed;
          }
        }
        return updatedWorkout;
      } catch (error) {
        console.error('❌ [userStore] Error updating workout:', error);
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

    async clearDraft() {
      try {
        const { deleteWorkoutOffline } = await import('@/utils/offlineStorage')
        await deleteWorkoutOffline('draft')
      } catch (e) {
        console.warn('⚠️ [userStore] Konnte Offline-Draft nicht löschen:', e)
      }
      try {
        const before = this.workouts.length
        this.workouts = this.workouts.filter(w => !w.isDraft)
        const after = this.workouts.length
        console.log('🧹 [userStore] Draft aus Store entfernt. Workouts:', before, '→', after)
      } catch (e) {
        // ignore
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
