<template>
  <div v-if="showSummary" class="post-workout-summary glass">
    <div class="summary-header">
      <h2>{{ t('postWorkout.title') || 'Workout abgeschlossen!' }}</h2>
      <button class="close-btn" type="button" @click="dismissSummary" aria-label="Schließen">×</button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="summary-content loading">
      <div class="spinner"></div>
      <p>{{ t('postWorkout.analyzing') || 'Analysiere deinen Trainingsfortschritt...' }}</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="summary-content error">
      <p class="error-message">{{ error }}</p>
      <button class="secondary" type="button" @click="dismissSummary">{{ t('common.close') || 'Schließen' }}</button>
    </div>

    <!-- Success State -->
    <div v-else-if="feedback" class="summary-content success">
      <div class="feedback-section">
        <h3>{{ t('postWorkout.feedback') || 'Dein Feedback' }}</h3>
        <AiFeedbackDeltaSummary v-if="analysisSnapshot.length > 0" :snapshot="analysisSnapshot" />
        <div class="feedback-text">{{ feedback }}</div>
        <AiFeedbackRatingWidget
          v-if="resolvedWorkoutIdForRating"
          :workout-id="resolvedWorkoutIdForRating"
          :exercise-names="analysisSnapshot.map(e => e.exercise)"
        />
      </div>

      <div class="summary-actions">
        <button class="primary" type="button" @click="dismissSummary">
          {{ t('postWorkout.gotIt') || 'Verstanden' }}
        </button>
        <button class="secondary" type="button" @click="goToAnalytics">
          {{ t('postWorkout.seeDetails') || 'Details anschauen' }}
        </button>
      </div>
    </div>

    <!-- Insufficient History: eine WERTENDE (vergleichende) Analyse braucht entweder genug
         identische Wiederholungen ODER genug verstrichenen Zeitraum (siehe
         AI_FEEDBACK_MIN_REPETITIONS / AI_FEEDBACK_MIN_HISTORY_DAYS serverseitig). -->
    <div v-else-if="insufficientHistory" class="summary-content fallback">
      <p>
        {{ t('postWorkout.insufficientHistoryExplainer') || 'Eine wertende Analyse ist erst nach mindestens 4 Wochen bzw. 8 identischen Workouts aussagekräftig.' }}
      </p>
      <p v-if="remainingCount > 0 || remainingDays > 0">
        {{ remainingCount === 1
          ? (t('postWorkout.insufficientHistorySingle') || 'Noch 1 gleiches Workout, dann bekommst du dein erstes Feedback.')
          : (t('postWorkout.insufficientHistoryMulti', { count: remainingCount }) || `Noch ${remainingCount} gleiche Workouts, dann bekommst du dein erstes Feedback.`)
        }}
        <template v-if="remainingDays > 0">
          {{ t('postWorkout.insufficientHistoryOr') || '(oder' }}
          {{ remainingDays === 1
            ? (t('postWorkout.insufficientHistoryDaySingle') || 'noch 1 Tag)')
            : (t('postWorkout.insufficientHistoryDaysMulti', { days: remainingDays }) || `noch ${remainingDays} Tage)`)
          }}
        </template>
      </p>
      <button class="primary" type="button" @click="dismissSummary">
        {{ t('common.continue') || 'Weiter' }}
      </button>
    </div>

    <!-- Netzwerk nicht erreichbar: Analyse läuft aktuell nur im Heimnetzwerk (Testphase) -->
    <div v-else-if="networkUnavailable" class="summary-content fallback">
      <p>{{ t('postWorkout.networkUnavailable') || 'Dein Workout ist gespeichert. Die Analyse ist gerade nicht erreichbar (Testphase, nur im Heimnetzwerk verfügbar) — du kannst sie später in den Stats nachholen.' }}</p>
      <button class="primary" type="button" @click="dismissSummary">
        {{ t('common.continue') || 'Weiter' }}
      </button>
    </div>

    <!-- Workout wurde noch nicht mit dem Server synchronisiert (z.B. langsames Netz beim
         Speichern) - die echte ID lag beim Laden dieser Ansicht noch nicht vor. -->
    <div v-else-if="syncPending" class="summary-content fallback">
      <p>{{ t('postWorkout.syncPending') || 'Dein Workout wird gerade noch synchronisiert. Das Feedback kannst du in Kürze in den Stats abrufen.' }}</p>
      <button class="primary" type="button" @click="dismissSummary">
        {{ t('common.continue') || 'Weiter' }}
      </button>
    </div>

    <!-- Fallback: No Feedback (AI unavailable but workout saved) -->
    <div v-else class="summary-content fallback">
      <p>{{ t('postWorkout.saved') || 'Dein Workout wurde gespeichert!' }}</p>
      <button class="primary" type="button" @click="dismissSummary">
        {{ t('common.continue') || 'Weiter' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useFirebaseAuth } from '@/utils/firebaseAuth'
import { logger } from '@/utils/logger'
import { apiUrl } from '@/api/http'
import axios from 'axios'
import { acquireKeepAwake, releaseKeepAwake } from '@/utils/keepAwakeGuard'
import { resolveRealIdFromDraftId } from '@/utils/workoutHelpers'
import { logDiagnostic } from '@/utils/diagnosticsLog'
import { OFFLINE_WORKOUTS_UPDATED_EVENT } from '@/utils/offlineStorage'
import AiFeedbackDeltaSummary from '@/components/AiFeedbackDeltaSummary.vue'
import AiFeedbackRatingWidget from '@/components/AiFeedbackRatingWidget.vue'

const props = defineProps({
  workoutId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['close'])

const { t } = useI18n()
const router = useRouter()
const { getIdToken } = useFirebaseAuth()

const showSummary = ref(true)
const loading = ref(true)
const feedback = ref(null)
const analysisSnapshot = ref([])
// Die tatsächlich aufgelöste, echte Workout-ID (nicht die evtl. temporäre offline_/draft-ID
// aus props.workoutId) - die Bewertungs-Route hängt am echten Workout-Dokument.
const resolvedWorkoutIdForRating = ref('')
const error = ref(null)
const insufficientHistory = ref(false)
const remainingCount = ref(0)
const remainingDays = ref(0)
const networkUnavailable = ref(false)
const syncPending = ref(false)

// Reagiert auf verzögerte Reconciliation (siehe resolveWorkoutIdForAnalysis oben): wartet
// dort das 8s-Zeitfenster ohne Erfolg ab (z.B. weil die Netzwerkverbindung beim Speichern
// unterbrochen war, siehe User-Report "Feedback hat nicht beim ersten Mal funktioniert"),
// gibt syncPending bisher endgültig auf - auch wenn der Workout Sekunden später im
// Hintergrund erfolgreich synchronisiert wird. saveWorkoutOffline()/deleteWorkoutOffline()
// feuern bei jeder Änderung (auch bei der Reconciliation selbst) OFFLINE_WORKOUTS_UPDATED_EVENT;
// hier genutzt, um bei syncPending automatisch einen erneuten Versuch zu starten, statt dass
// der Nutzer die Ansicht manuell neu öffnen muss.
const MAX_SYNC_RETRY_ATTEMPTS = 5
let syncRetryAttempts = 0
let retryingAfterSync = false

async function handleOfflineWorkoutsUpdated() {
  if (!syncPending.value || retryingAfterSync) return
  if (syncRetryAttempts >= MAX_SYNC_RETRY_ATTEMPTS) return
  syncRetryAttempts += 1
  retryingAfterSync = true
  logDiagnostic('ai-feedback-retry-after-sync', { workoutId: props.workoutId, attempt: syncRetryAttempts })
  try {
    await loadAIFeedback()
  } finally {
    retryingAfterSync = false
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Wartet kurz auf die Reconciliation einer temporären ID (offline_.../draft-...) zur
 * echten Server-ID. Grund: createWorkout() im userStore kann bei einem langsamen
 * Save (z.B. Render Cold-Start über Funknetz) nach 2s bereits eine temporäre ID
 * zurückgeben, bevor der eigentliche Server-Request abgeschlossen ist (siehe
 * userStore.js, CREATE_RACE_TIMEOUT_MS). Ohne diese Wartung würde hier eine
 * ai-analysis-Anfrage mit einer ungültigen (Nicht-ObjectId) Workout-ID an den
 * Server geschickt und mit einem Fehler abgelehnt.
 */
async function resolveWorkoutIdForAnalysis(rawId) {
  const id = String(rawId || '').trim()
  const isTemp = id.startsWith('offline_') || id.startsWith('draft-')
  if (!isTemp) return id

  const maxWaitMs = 8000
  const intervalMs = 500
  let waited = 0
  while (waited < maxWaitMs) {
    const realId = await resolveRealIdFromDraftId(id).catch(() => '')
    if (realId) {
      logger.debug('[PostWorkoutSummary] Temp-ID aufgelöst', { tempId: id, realId })
      return realId
    }
    await sleep(intervalMs)
    waited += intervalMs
  }
  logger.warn('[PostWorkoutSummary] Temp-ID nach Wartezeit weiterhin ungelöst', { tempId: id })
  return ''
}

/**
 * Lade AI-Feedback nach Workout-Speicherung
 */
async function loadAIFeedback() {
  // DIAGNOSE (User-Report "Feedback hat nicht beim ersten Mal funktioniert"): bisher gab es
  // für diesen kompletten Ablauf keine Einträge im (kopierbaren) Diagnose-Log, nur normale
  // logger.debug()-Aufrufe. Jeder Aufruf (auch Remounts/erneute Versuche) wird jetzt geloggt.
  logDiagnostic('ai-feedback-load-start', { workoutId: props.workoutId })

  if (!props.workoutId) {
    logger.warn('[PostWorkoutSummary] No workoutId provided')
    loading.value = false
    return
  }

  // Bildschirm bleibt an, bis die KI-Analyse abgeschlossen ist (Standby darf sie nicht
  // abbrechen). Übernimmt den 'workout-save'-Tag von WorkoutDetailView.vue (siehe dort) -
  // durch das Referenzzählen im Guard gibt es dabei keine Lücke, in der der Bildschirm
  // zwischenzeitlich einschlafen könnte.
  acquireKeepAwake('ai-feedback')
  releaseKeepAwake('workout-save')

  try {
    loading.value = true
    error.value = null
    feedback.value = null
    analysisSnapshot.value = []
    insufficientHistory.value = false
    remainingDays.value = 0
    networkUnavailable.value = false
    syncPending.value = false

    const resolvedWorkoutId = await resolveWorkoutIdForAnalysis(props.workoutId)
    if (!resolvedWorkoutId) {
      syncPending.value = true
      logDiagnostic('ai-feedback-sync-pending', { workoutId: props.workoutId })
      return
    }
    resolvedWorkoutIdForRating.value = resolvedWorkoutId

    const token = await getIdToken().catch(() => null)

    // Rufe AI-Analysis Endpunkt auf
    const url = `${apiUrl('workouts')}/${resolvedWorkoutId}/ai-analysis`
    logger.debug('[PostWorkoutSummary] Requesting AI analysis', { url })
    logDiagnostic('ai-feedback-request', { workoutId: props.workoutId, resolvedWorkoutId, hasToken: !!token })

    const response = await axios.post(
      url,
      {},
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        // Server macht jetzt einen schnellen Erreichbarkeits-Check (max. 3s) vor dem
        // eigentlichen Generierungs-Aufruf und antwortet bei nicht erreichbarem Provider
        // sofort mit feedback_status: 'network_unavailable' statt lange zu hängen — der
        // Client muss also nicht mehr für den "unerreichbar"-Fall auf ein langes Timeout warten.
        timeout: 60000
      }
    )

    if (response.data?.ai_feedback) {
      feedback.value = response.data.ai_feedback
      analysisSnapshot.value = Array.isArray(response.data?.ai_analysis_snapshot)
        ? response.data.ai_analysis_snapshot
        : []
      logger.debug('[PostWorkoutSummary] Feedback loaded', {
        workoutId: props.workoutId,
        provider: response.data.ai_metadata?.provider
      })
      logDiagnostic('ai-feedback-result', { workoutId: props.workoutId, outcome: 'feedback', provider: response.data.ai_metadata?.provider, cached: !!response.data.cached })
    } else if (response.data?.feedback_status === 'network_unavailable') {
      networkUnavailable.value = true
      logger.debug('[PostWorkoutSummary] AI provider not reachable (network)', {
        workoutId: props.workoutId
      })
      logDiagnostic('ai-feedback-result', { workoutId: props.workoutId, outcome: 'network_unavailable' })
    } else if (response.data?.feedback_status === 'insufficient_history') {
      insufficientHistory.value = true
      remainingCount.value = Number(response.data?.remaining) || 0
      remainingDays.value = Number(response.data?.remaining_days) || 0
      logger.debug('[PostWorkoutSummary] Insufficient history for feedback', {
        workoutId: props.workoutId,
        matchingCount: response.data?.matching_count,
        remaining: remainingCount.value,
        spanDays: response.data?.span_days,
        remainingDays: remainingDays.value
      })
      logDiagnostic('ai-feedback-result', { workoutId: props.workoutId, outcome: 'insufficient_history', remaining: remainingCount.value, remainingDays: remainingDays.value })
    } else {
      // Kein Feedback, aber kein Error
      logger.debug('[PostWorkoutSummary] No feedback in response', { response: response.data })
      logDiagnostic('ai-feedback-result', { workoutId: props.workoutId, outcome: 'empty', response: response.data })
    }

  } catch (err) {
    logger.error('[PostWorkoutSummary] Error loading feedback', {
      workoutId: props.workoutId,
      error: err.message
    })

    // Nicht tödlich - Workout wurde trotzdem gespeichert
    error.value = err.response?.data?.message ||
                  err.message ||
                  t('postWorkout.error') ||
                  'Feedback konnte nicht geladen werden'
    logDiagnostic('ai-feedback-result', {
      workoutId: props.workoutId,
      outcome: 'error',
      status: err?.response?.status ?? null,
      message: err?.message || String(err)
    })
  } finally {
    loading.value = false
    releaseKeepAwake('ai-feedback')
  }
}

function dismissSummary() {
  showSummary.value = false
  emit('close')
}

function goToAnalytics() {
  dismissSummary()
  // Scroll zu Workout-Details oder Analytics
  router.push({
    name: 'stats',
    query: { highlightWorkoutId: props.workoutId }
  })
}

onMounted(() => {
  loadAIFeedback()
  window.addEventListener(OFFLINE_WORKOUTS_UPDATED_EVENT, handleOfflineWorkoutsUpdated)
})

onBeforeUnmount(() => {
  window.removeEventListener(OFFLINE_WORKOUTS_UPDATED_EVENT, handleOfflineWorkoutsUpdated)
})
</script>

<style scoped>
.post-workout-summary {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  max-height: 80vh;
  padding: 2rem 1.5rem calc(1.5rem + 88px + env(safe-area-inset-bottom));
  border-radius: 1rem 1rem 0 0;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
  /* Über der BottomNav (z-index: 1000), sonst verschwindet der untere Bereich dahinter */
  z-index: 1010;
  display: flex;
  flex-direction: column;
  gap: 1rem;

  /* Hintergrund/Rand kommen bewusst NICHT mehr von hier, sondern von der bereits
     vorhandenen .glass-Klasse (var(--bg-panel)/var(--line-soft)) auf demselben Element -
     die ist theme-aware (per [data-theme] am Root, siehe stores/themeStore.js). Vorher
     stand hier ein hart codiertes, immer-weißes Glas + eine separate
     @media (prefers-color-scheme: dark)-Regel, die auf die OS-Einstellung reagierte statt
     auf das tatsächlich im Theme-Store gewählte App-Theme - dadurch war der Text im
     Dark-Mode teils weiß auf weiß (nicht lesbar) bzw. teils grau auf sehr dunklem Grund
     (schwacher Kontrast beim Laden). */
  /* Bug-Fix (App-Absturz beim Fokussieren des Bewertungs-Textfelds, siehe
     AiFeedbackRatingWidget.vue): backdrop-filter auf einem position:fixed-Element, das beim
     Aufklappen der nativen Tastatur neu layoutet, ist auf iOS/WKWebView (Capacitor) ein
     bekanntes Absturzmuster (GPU-Compositing-Konflikt). .glass liefert bereits einen
     deckenden, theme-aware Hintergrund (var(--bg-panel)) ohne Transparenz - der zusätzliche
     Weichzeichner hier war rein kosmetisch und nicht nötig für Lesbarkeit.
  backdrop-filter: blur(10px); */
}

.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.summary-header h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: var(--muted);
  padding: 0;
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  transition: background-color 0.2s;
}

.close-btn:active {
  background-color: rgba(0, 0, 0, 0.05);
}

.summary-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-height: 50vh;
  overflow-y: auto;
}

.summary-content.loading {
  align-items: center;
  justify-content: center;
  padding: 2rem 0;
}

.spinner {
  width: 2rem;
  height: 2rem;
  border: 2px solid var(--border, #ddd);
  border-top-color: var(--primary, #007AFF);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.summary-content.loading p {
  /* var(--text-secondary) existiert im Design-System nicht (siehe style.css: --fg/--muted
     statt --text-primary/--text-secondary) - war dadurch immer der Fallback #666, was auf
     dem jetzt korrekt dunklen Panel im Dark Mode kaum lesbar war. */
  color: var(--muted);
  margin: 0;
  text-align: center;
}

.summary-content.error {
  background-color: rgba(255, 59, 48, 0.05);
  padding: 1rem;
  border-radius: 0.5rem;
}

.error-message {
  color: var(--error, #FF3B30);
  margin: 0 0 1rem 0;
  font-size: 0.95rem;
}

.feedback-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.feedback-section h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.feedback-text {
  color: var(--fg);
  line-height: 1.6;
  font-size: 0.95rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.summary-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.primary, .secondary {
  flex: 1;
  min-width: 120px;
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.primary {
  background-color: var(--primary, #007AFF);
  color: white;
}

.primary:active {
  opacity: 0.8;
}

.secondary {
  background-color: var(--secondary-bg, #f5f5f5);
  color: var(--primary, #007AFF);
  border: 1px solid var(--border, #ddd);
}

.secondary:active {
  background-color: var(--border, #ddd);
}

.summary-content.fallback {
  align-items: center;
  text-align: center;
  padding: 1rem 0;
}

.summary-content.fallback p {
  margin: 0 0 1rem 0;
  color: var(--muted);
}

/* Der vorherige @media (prefers-color-scheme: dark)-Block wurde entfernt: er reagierte auf
   die OS-Einstellung des Geräts, nicht auf das im Theme-Store gewählte App-Theme
   ([data-theme] am Root, siehe stores/themeStore.js). Dadurch konnte er sogar im Light-Mode
   fälschlich zuschlagen (OS auf Dark, App auf Light) oder im Dark-Mode ausbleiben (OS auf
   Light, App auf Dark) - beides Ursache der gemeldeten Lesbarkeitsprobleme. Hintergrund/Rand
   kommen jetzt korrekt theme-aware von der .glass-Klasse, Textfarben von var(--fg)/var(--muted). */

@media (max-height: 600px) {
  .post-workout-summary {
    max-height: 100vh;
    padding: 1.5rem 1rem calc(1rem + 88px + env(safe-area-inset-bottom));
  }

  .summary-content {
    max-height: 30vh;
  }
}
</style>
