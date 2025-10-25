import { defineStore } from "pinia";
import { fetchWorkouts, fetchWorkoutStats, createWorkout, updateWorkout as apiUpdateWorkout, completeWorkout as apiCompleteWorkout } from "../api/workouts";

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
      const envTtl = Number.parseInt(import.meta.env.VITE_WORKOUTS_CACHE_TTL_MS || '', 10);
      const defaultTtl = Number.isFinite(envTtl) ? envTtl : 120_000; // 2 Minuten Standard-TTL
      const { force = false, maxAgeMs = defaultTtl } = options;
      this.error = null;

      // Caching-Guard: Wenn bereits frisch geladen und nicht erzwungen, nicht erneut laden
      const now = Date.now();
      if (!force && this.workoutsLoaded && (now - this.workoutsLoadedAt) < maxAgeMs) {
        // Sicherstellen, dass kein globales Loading angezeigt wird
        this.loadingWorkouts = false;
        return this.workouts;
      }

      this.loadingWorkouts = true;
      
      try {
        console.log('📡 Loading workouts from backend with token:', !!token);
        if (!token) {
          console.warn('⚠️ Kein Auth-Token für Workouts-GET. UI zeigt leeren Zustand.');
        }
        const result = await fetchWorkouts(token);
        if (Array.isArray(result)) {
          this.workouts = result;
          console.log(`✅ Loaded ${result.length} workouts`);
          this.workoutsLoaded = true;
          this.workoutsLoadedAt = Date.now();
        } else {
          // Defensive: falls Backend kein Array liefert
          this.workouts = [];
          console.warn('⚠️ Backend did not return an array for workouts, defaulting to empty list');
        }
      } catch (error) {
        // Falls es doch eine Exception gibt, logge, aber lasse die UI nicht crashen
        console.error('❌ Error loading workouts (handled):', error);
        // Du kannst hier optional eine freundlichere Fehlermeldung setzen
        this.error = null; // Kein harter Error-State in der UI
        
        // KEINE Fallback-Daten - User soll echte Situation sehen
        this.workouts = [];
        console.log('⚠️ No fallback data - showing empty state');
      } finally {
        this.loadingWorkouts = false;
      }
    },

    async loadStats(token = null) {
      this.loadingStats = true;
      this.error = null;
      
      try {
        console.log('📊 Loading stats from backend with token:', !!token);
        const stats = await fetchWorkoutStats(token);
        this.stats = stats; // kann null sein, UI soll nicht crashen
        console.log('✅ Stats loaded (nullable):', this.stats);
      } catch (error) {
        console.error('❌ Error loading stats (handled):', error);
        // Kein harter Fehler in der UI setzen
        this.error = null;
        this.stats = null;
        console.log('⚠️ Stats unavailable, keeping UI stable');
      } finally {
        this.loadingStats = false;
      }
    },

    async createWorkout(workoutData, token = null) {
      try {
        console.log('💾 Creating new workout:', workoutData);
        // Auth erzwingen: Ohne Token kein Erstellen
        if (!token) {
          console.warn('⛔️ Cannot create workout without auth token');
          const err = new Error('AUTH_REQUIRED');
          err.code = 'AUTH_REQUIRED';
          throw err;
        }
        const newWorkout = await createWorkout(workoutData, token);
        // Erwartet Backend-Response mit _id
        if (newWorkout && newWorkout._id) {
          this.workouts.push(newWorkout);
        } else {
          console.warn('⚠️ Backend did not return created workout with _id, creating draft locally');
          const draft = { ...workoutData, _id: `draft-${Date.now()}`, isDraft: true };
          this.workouts.push(draft);
          console.log('✅ Workout draft created (no _id from backend)');
          return draft;
        }
        console.log('✅ Workout created successfully:', newWorkout);
        return newWorkout;
      } catch (error) {
        console.error('❌ Error creating workout:', error);
        // Bei expliziter Nicht-Autorisierung KEIN Draft erstellen, sondern nach oben melden
        const status = error?.response?.status;
        if (status === 401 || status === 403 || error?.code === 'UNAUTHORIZED') {
          const err = new Error('UNAUTHORIZED');
          err.code = 'UNAUTHORIZED';
          throw err;
        }
        // Bei anderen Backend-Fehlern trotz Token: optionaler Draft-Fallback nur wenn explizit erlaubt
        if (token && import.meta.env.VITE_ALLOW_DRAFT_FALLBACK === '1') {
          const draft = { ...workoutData, _id: `draft-${Date.now()}`, isDraft: true };
          this.workouts.push(draft);
          console.log('✅ Created local draft due to backend error');
          return draft;
        }
        // Ohne Token: Fehler weiterreichen
        throw error;
      }
    },

    async updateWorkout(id, updates, token = null) {
      try {
        console.log('✏️ Updating workout:', id, updates);
        const updated = await apiUpdateWorkout(id, updates, token);
        // Update im lokalen State
        const idx = this.workouts.findIndex(w => w._id === id);
        if (idx !== -1) {
          this.workouts[idx] = { ...this.workouts[idx], ...updated };
        }
        return updated;
      } catch (error) {
        console.error('❌ Error updating workout:', error);
        throw error;
      }
    },

    async markWorkoutCompleted(id, token = null) {
      try {
        console.log('✅ Mark workout completed:', id);
        const updated = await apiCompleteWorkout(id, new Date().toISOString(), token);
        const idx = this.workouts.findIndex(w => w._id === id);
        if (idx !== -1) {
          this.workouts[idx] = {
            ...this.workouts[idx],
            ...updated,
            completed: true,
            completedAt: updated?.completedAt || new Date().toISOString()
          };
        }
        return updated;
      } catch (error) {
        console.error('❌ Error completing workout:', error);
        throw error;
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
