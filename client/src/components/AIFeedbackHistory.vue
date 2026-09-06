<template>
  <div class="ai-feedback-history glass">
    <div class="header">
      <h3>{{ t('feedbackHistory.title') || 'KI-Feedback Verlauf' }}</h3>
    </div>

    <div v-if="loading && items.length === 0" class="state-message">
      <div class="spinner spin-indicator"></div>
    </div>

    <div v-else-if="error" class="state-message error">
      <p>{{ error }}</p>
      <button class="retry-btn" type="button" @click="load(1)">
        {{ t('common.retry') || 'Erneut versuchen' }}
      </button>
    </div>

    <div v-else-if="items.length === 0" class="empty-state">
      <div class="empty-icon">🤖</div>
      <p>{{ t('feedbackHistory.empty') || 'Noch kein KI-Feedback vorhanden. Schließe ein Workout ab, um dein erstes Feedback zu erhalten.' }}</p>
    </div>

    <div v-else class="feedback-list">
      <div
        v-for="item in items"
        :key="item.workoutId"
        class="feedback-item"
        :class="{ expanded: expandedId === item.workoutId }"
        @click="toggle(item.workoutId)"
      >
        <div class="feedback-summary">
          <div class="feedback-info">
            <span class="feedback-name">{{ item.name || 'Workout' }}</span>
            <span class="feedback-date">
              {{ formatDate(item.ai_generated_at || item.date) }}
              <span v-if="item.ai_feedback_status === 'deferred'" class="pending-badge">
                {{ t('feedbackHistory.pendingBadge') || 'Ausstehend' }}
              </span>
            </span>
          </div>
          <span class="chevron" :class="{ open: expandedId === item.workoutId }">›</span>
        </div>

        <!-- Feature "Feedback später bewerten": noch kein ai_feedback vorhanden, Nutzer hat die
             Analyse beim Speichern bewusst zurückgestellt (siehe ai_feedback_status in
             models/Workout.js) - eigener Zustand mit "Jetzt generieren"-Button statt des
             normalen Feedback-Texts, der hier ja noch gar nicht existiert. -->
        <div v-if="expandedId === item.workoutId && item.ai_feedback_status === 'deferred'" class="feedback-text pending" @click.stop>
          <p class="pending-hint">{{ t('feedbackHistory.pendingHint') || 'Für dieses Workout wurde noch kein KI-Feedback angefordert. Falls du inzwischen Notizen ergänzt hast, kannst du es jetzt generieren.' }}</p>
          <p v-if="generateError === item.workoutId" class="generate-error">{{ t('feedbackHistory.generateError') || 'Feedback konnte gerade nicht generiert werden. Bitte später erneut versuchen.' }}</p>
          <button
            class="generate-now-btn"
            type="button"
            :disabled="generatingId === item.workoutId"
            @click.stop="generateNow(item)"
          >
            <span v-if="generatingId === item.workoutId" class="generate-spinner spin-indicator" aria-hidden="true"></span>
            {{ generatingId === item.workoutId ? (t('feedbackHistory.generating') || 'Generiere…') : (t('feedbackHistory.generateNow') || 'Jetzt generieren') }}
          </button>
        </div>

        <div v-else-if="expandedId === item.workoutId" class="feedback-text" @click.stop>
          <AiFeedbackDeltaSummary
            v-if="item.ai_analysis_snapshot?.length > 0"
            class="feedback-delta-summary"
            :snapshot="item.ai_analysis_snapshot"
          />
          {{ item.ai_feedback }}

          <AiFeedbackRatingWidget
            :workout-id="String(item.workoutId)"
            :exercise-names="(item.ai_analysis_snapshot || []).map(e => e.exercise)"
          />

          <button
            class="share-btn"
            type="button"
            :aria-label="t('feedbackHistory.share') || 'Analyse teilen'"
            @click.stop="shareFeedback(item)"
          >
            <Share2 class="share-icon" aria-hidden="true" />
            <span>{{ t('feedbackHistory.share') || 'Teilen' }}</span>
          </button>
        </div>
      </div>

      <button
        v-if="hasMore"
        class="load-more-btn"
        type="button"
        :disabled="loading"
        @click.stop="loadMore"
      >
        {{ loading ? (t('common.loading') || 'Lädt…') : (t('feedbackHistory.loadMore') || 'Mehr laden') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Share2 } from 'lucide-vue-next'
import { Share } from '@capacitor/share'
import { generateFeedbackShareImage } from '@/utils/feedbackShareImage'
import AiFeedbackDeltaSummary from '@/components/AiFeedbackDeltaSummary.vue'
import AiFeedbackRatingWidget from '@/components/AiFeedbackRatingWidget.vue'
import { useFirebaseAuth } from '@/utils/firebaseAuth'
import { fetchWorkoutFeedbacks, requestAiAnalysis } from '@/api/workouts'
import { logger } from '@/utils/logger'
import { getMetadata, setMetadata } from '@/utils/offlineStorage'
import { useToastStore } from '@/stores/toastStore'
import { logDiagnostic } from '@/utils/diagnosticsLog'

const { t, locale } = useI18n()
const { getIdToken, getCurrentUser } = useFirebaseAuth()
const toast = useToastStore()

// Initial nur die letzten 5 Analysen laden - abgeschlossene Analysen ändern sich nie wieder,
// ältere holt sich der Nutzer bei Bedarf explizit über "Mehr laden" (loadMore()).
const FEEDBACK_PAGE_SIZE = 5

// Kürzerer Timeout als der globale 25s-Default (siehe api/workouts.js) - diese Liste läuft
// hier meist als Hintergrund-Refresh hinter bereits sichtbaren Cache-Daten, es lohnt sich
// nicht, bei einem kalt startenden Server minutenlang zu warten, bevor der Nutzer eine
// Fehler-/Retry-Möglichkeit sieht.
const FEEDBACK_TIMEOUT_MS = 12000

const items = ref([])
const loading = ref(false)
const error = ref(null)
const page = ref(1)
const hasMore = ref(false)
const expandedId = ref(null)
// Feature "Feedback später bewerten": Zustand für den manuellen "Jetzt generieren"-Button.
const generatingId = ref(null)
const generateError = ref(null)

function toggle(id) {
  expandedId.value = expandedId.value === id ? null : id
}

// Stößt die KI-Analyse manuell für ein zuvor zurückgestelltes Workout an (siehe
// ai_feedback_status === 'deferred') und aktualisiert den Eintrag in-place, sobald das
// Ergebnis da ist - kein erneutes Laden der ganzen Liste nötig.
async function generateNow(item) {
  if (generatingId.value) return
  generatingId.value = item.workoutId
  generateError.value = null
  try {
    const token = await getIdToken().catch(() => null)
    const data = await requestAiAnalysis(String(item.workoutId), token, { timeoutMs: 60000 })
    if (data?.ai_feedback) {
      item.ai_feedback = data.ai_feedback
      item.ai_generated_at = new Date().toISOString()
      item.ai_metadata = data.ai_metadata
      item.ai_analysis_snapshot = data.ai_analysis_snapshot || []
      item.ai_feedback_status = 'generated'
      logDiagnostic('feedback-history-generate-now', { workoutId: item.workoutId, outcome: 'feedback' })
    } else if (data?.feedback_status === 'insufficient_history') {
      // Bleibt "ausstehend" (kein Fehler) - nur noch nicht genug Trainingshistorie für eine
      // wertende Analyse. Gleicher Hinweistext wie in PostWorkoutSummary.vue.
      toast.show(
        t('postWorkout.insufficientHistoryExplainer') || 'Eine wertende Analyse ist erst nach mindestens 4 Wochen bzw. 8 identischen Workouts aussagekräftig.',
        { type: 'info', duration: 4000 }
      )
      logDiagnostic('feedback-history-generate-now', { workoutId: item.workoutId, outcome: 'insufficient_history' })
    } else if (data?.feedback_status === 'network_unavailable') {
      generateError.value = item.workoutId
      logDiagnostic('feedback-history-generate-now', { workoutId: item.workoutId, outcome: 'network_unavailable' })
    } else {
      generateError.value = item.workoutId
      logDiagnostic('feedback-history-generate-now', { workoutId: item.workoutId, outcome: 'empty' })
    }
  } catch (err) {
    logger.warn('[AIFeedbackHistory] generateNow failed', err?.message)
    generateError.value = item.workoutId
    logDiagnostic('feedback-history-generate-now', { workoutId: item.workoutId, outcome: 'error', message: err?.message })
  } finally {
    generatingId.value = null
  }
}

// Nutzt den nativen Share-Sheet (@capacitor/share) statt eines eigenen E-Mail-Versands zu
// bauen - der Nutzer kann darüber selbst "An Mail senden" o.ä. wählen. Auf Web fällt das
// Plugin auf die Web-Share-API zurück, die aber (a) einen sicheren Kontext (HTTPS) UND
// (b) Browser-Unterstützung braucht - in vielen Desktop-Browsern (z.B. beim lokalen Testen
// über `npm run dev`) fehlt navigator.share komplett, dann wirft Share.share() sofort.
// Deshalb vorher mit canShare() prüfen und in dem Fall in die Zwischenablage kopieren statt
// nur einen "geht nicht"-Fehler zu zeigen.
async function shareFeedback(item) {
  const dateLabel = formatDate(item?.ai_generated_at || item?.date)
  const text = [item?.name || 'Workout', dateLabel, '', item?.ai_feedback || '']
    .filter(Boolean)
    .join('\n')

  let canShare = false
  try {
    canShare = Boolean((await Share.canShare())?.value)
  } catch (err) {
    // canShare() selbst sollte eigentlich nicht werfen, aber sicherheitshalber wie
    // "nicht verfügbar" behandeln statt die Funktion abzubrechen.
    logger.debug('[AIFeedbackHistory] Share.canShare check failed', err?.message)
  }

  if (!canShare) {
    await copyFeedbackToClipboard(text)
    return
  }

  // Zusätzlich ein Bild rendern ("Stufe 1" der Instagram-Anbindung, siehe
  // utils/feedbackShareImage.js), damit Instagram-Stories/-Reels als Ziel im Share-Sheet
  // auftauchen (die verlangen Bild-/Videoinhalt, reiner Text reicht ihnen nicht). Rein additiv:
  // schlägt die Erzeugung fehl, bleibt es beim bisherigen Text-Only-Share, kein Fehler sichtbar.
  const imageUri = await generateFeedbackShareImage(item, {
    dateLabel,
    footerText: t('feedbackHistory.shareFooter') || 'Erstellt mit der ppl App'
  }).catch((err) => {
    logger.debug('[AIFeedbackHistory] Share-Bild-Erzeugung fehlgeschlagen', err?.message)
    return null
  })

  try {
    await Share.share({
      title: t('feedbackHistory.shareTitle') || 'KI-Feedback',
      text,
      ...(imageUri ? { files: [imageUri] } : {}),
      dialogTitle: t('feedbackHistory.shareTitle') || 'KI-Feedback teilen'
    })
  } catch (err) {
    // Nutzer hat den Share-Sheet einfach abgebrochen - das ist kein Fehler, kein Toast.
    const message = String(err?.message || '')
    if (/cancel/i.test(message)) return
    logger.warn('[AIFeedbackHistory] shareFeedback failed', message)
    // Fallback statt hartem Fehler: wenn der native Share-Sheet aus irgendeinem Grund doch
    // scheitert (z.B. Plugin auf iOS noch nicht per `pod install` eingebunden), versuchen
    // wir trotzdem noch die Zwischenablage, bevor wir wirklich aufgeben.
    await copyFeedbackToClipboard(text)
  }
}

async function copyFeedbackToClipboard(text) {
  try {
    if (!navigator?.clipboard?.writeText) throw new Error('clipboard-unavailable')
    await navigator.clipboard.writeText(text)
    toast.success(t('feedbackHistory.copiedToClipboard') || 'In die Zwischenablage kopiert')
  } catch (err) {
    logger.warn('[AIFeedbackHistory] clipboard fallback failed', err?.message)
    toast.error(t('feedbackHistory.shareError') || 'Teilen ist gerade nicht möglich')
  }
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return ''
  const loc = String(locale.value).startsWith('de') ? 'de-DE' : 'en-US'
  return date.toLocaleDateString(loc, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Cache-Key pro Nutzer (nicht global), damit auf einem geteilten Gerät nach Account-Wechsel
// nicht versehentlich der Feedback-Verlauf des vorherigen Nutzers aufblitzt. Wird zusätzlich
// beim Logout ohnehin über clearAllOfflineData() komplett geleert (firebaseAuth.js).
function getCacheKey() {
  const uid = getCurrentUser?.()?.uid
  return uid ? `ai_feedback_history_cache_${uid}` : null
}

// Lädt die zuletzt angezeigten (letzten 5) Analysen aus dem IndexedDB-Cache
// (utils/offlineStorage.js), damit fertige Analysen beim App-Start SOFORT sichtbar sind,
// statt bei jedem Start erneut hinter einem Spinner zu verschwinden.
async function loadFromCache() {
  const cacheKey = getCacheKey()
  if (!cacheKey) return false
  try {
    const cached = await getMetadata(cacheKey)
    if (!cached || !Array.isArray(cached.items) || cached.items.length === 0) return false
    items.value = cached.items
    hasMore.value = Boolean(cached.hasMore)
    page.value = 1
    return true
  } catch (err) {
    logger.warn('[AIFeedbackHistory] loadFromCache failed', err?.message)
    return false
  }
}

async function cacheFirstPage(newItems, hasMoreValue) {
  const cacheKey = getCacheKey()
  if (!cacheKey) return
  try {
    await setMetadata(cacheKey, { items: newItems, hasMore: hasMoreValue, cachedAt: Date.now() })
  } catch (err) {
    logger.warn('[AIFeedbackHistory] cacheFirstPage failed', err?.message)
  }
}

// silent: true unterdrückt Spinner/Fehleranzeige, wenn bereits Cache-Daten sichtbar sind -
// ein Hintergrund-Refresh soll nicht mit dem, was der Nutzer schon sieht, "flackern".
async function load(targetPage = 1, { silent = false } = {}) {
  if (!silent) {
    loading.value = true
    error.value = null
  }
  const startedAt = Date.now()
  try {
    const token = await getIdToken().catch(() => null)
    const res = await fetchWorkoutFeedbacks(token, {
      page: targetPage,
      limit: FEEDBACK_PAGE_SIZE,
      timeoutMs: FEEDBACK_TIMEOUT_MS
    })
    const newItems = Array.isArray(res?.items) ? res.items : []
    items.value = targetPage === 1 ? newItems : [...items.value, ...newItems]
    hasMore.value = Boolean(res?.hasMore)
    page.value = targetPage
    if (targetPage === 1) {
      cacheFirstPage(newItems, hasMore.value)
    }
    logDiagnostic('feedback-history-load', {
      page: targetPage, silent, ms: Date.now() - startedAt, count: newItems.length
    })
  } catch (err) {
    logger.error('[AIFeedbackHistory] load failed', err?.message)
    logDiagnostic('feedback-history-load-failed', {
      page: targetPage, silent, ms: Date.now() - startedAt, error: err?.message || String(err)
    })
    // Im Hintergrund-Refresh (silent) bleibt der bereits sichtbare Cache-Stand einfach stehen,
    // statt ihn durch eine Fehlermeldung zu ersetzen - der Nutzer hat ja etwas Nützliches vor
    // sich, auch wenn der aktuelle Netzwerk-Versuch fehlschlägt.
    if (!silent) {
      error.value = t('feedbackHistory.error') || 'Feedback-Verlauf konnte nicht geladen werden'
    }
  } finally {
    if (!silent) {
      loading.value = false
    }
  }
}

function loadMore() {
  if (loading.value || !hasMore.value) return
  load(page.value + 1)
}

onMounted(() => {
  // Cache-Lesen (schnelles IndexedDB) und Netzwerk-Refresh bewusst NICHT nacheinander
  // (await ... dann erst starten), sondern parallel anstoßen - der Netzwerk-Request ist der
  // eigentlich langsame Teil (v.a. bei einem kalt startenden Server), da soll nicht noch
  // zusätzlich auf den (i.d.R. sehr schnellen) Cache-Read gewartet werden, bevor er überhaupt
  // losgeht. loadFromCache() setzt items/hasMore direkt bei einem Treffer; egal ob das VOR
  // oder NACH dem Start des Netzwerk-Requests passiert, das silent-Flag unten entscheidet nur
  // darüber, ob load() einen Spinner zeigt.
  const cachePromise = loadFromCache()
  loading.value = true
  cachePromise.then((hadCache) => {
    logDiagnostic('feedback-history-cache', { hit: hadCache })
    // Sobald der Cache-Status feststeht: bei Treffer sofort den Spinner wegnehmen (Cache-Daten
    // sind ja schon in items) und den Netzwerk-Request nur noch still im Hintergrund laufen
    // lassen; ohne Treffer bleibt der Spinner bis der Netzwerk-Request selbst fertig ist.
    if (hadCache) loading.value = false
    load(1, { silent: hadCache })
  })
})
</script>

<style scoped>
.ai-feedback-history {
  padding: 1.25rem;
  border-radius: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.state-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1.5rem 0;
  text-align: center;
}

.state-message.error p {
  /* War var(--error, #FF3B30) - --error existiert im Design-System nicht (siehe style.css:
     --danger/--danger-text), fiel also IMMER auf die feste Farbe zurück statt sich dem
     gewählten Theme anzupassen. */
  color: var(--danger-text, var(--danger, #ff5f5f));
  margin: 0;
}

.retry-btn {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  /* War var(--border, #ddd) / var(--secondary-bg, #f5f5f5) - beide Variablen existieren im
     Design-System nicht, der Button blieb dadurch immer hellgrau/hell umrandet, auch im
     Dark Mode. */
  border: 1px solid var(--card-border);
  background: var(--surface);
  color: var(--fg);
  cursor: pointer;
}

.spinner {
  width: 1.75rem;
  height: 1.75rem;
  /* War var(--border, #ddd) / var(--primary, #007AFF) - beide Variablen existieren im
     Design-System nicht (siehe style.css: --card-border/--accent). */
  border: 2px solid var(--card-border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.5rem;
  padding: 1.5rem 0.5rem;
  color: var(--muted);
}

.empty-icon {
  font-size: 2rem;
}

.feedback-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.feedback-item {
  border-radius: 0.75rem;
  background: var(--surface);
  padding: 0.85rem 1rem;
  cursor: pointer;
  transition: background-color 0.15s;
}

.feedback-item:active {
  background: var(--surface-strong);
}

.feedback-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.feedback-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.feedback-name {
  font-weight: 600;
  font-size: 0.95rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.feedback-date {
  font-size: 0.8rem;
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

/* Feature "Feedback später bewerten": Hinweis-Badge für Workouts, die beim Speichern bewusst
   ohne KI-Analyse gespeichert wurden (siehe ai_feedback_status in models/Workout.js). Warm/
   auffällig, aber nicht "Fehler"-rot - es ist ja kein Problem, sondern eine offene, vom Nutzer
   selbst gewählte Aufgabe. */
.pending-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--warning) 20%, transparent);
  border: 1px solid color-mix(in srgb, var(--warning) 45%, transparent);
  color: var(--warning-text);
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.feedback-text.pending {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.6rem;
}

.pending-hint {
  margin: 0;
  color: var(--muted);
  font-size: 0.88rem;
  line-height: 1.5;
}

.generate-error {
  margin: 0;
  color: var(--danger-text, var(--danger));
  font-size: 0.85rem;
}

.generate-now-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 0.9rem;
  border-radius: 0.6rem;
  border: none;
  background: var(--accent);
  color: var(--accent-contrast);
  font-weight: 600;
  font-size: 0.88rem;
  cursor: pointer;
}

.generate-now-btn:disabled {
  opacity: 0.65;
  cursor: default;
}

.generate-spinner {
  width: 0.9rem;
  height: 0.9rem;
  border: 2px solid color-mix(in srgb, var(--accent-contrast) 35%, transparent);
  border-top-color: var(--accent-contrast);
  border-radius: 50%;
  flex-shrink: 0;
  animation: generate-spin 0.8s linear infinite;
}

@keyframes generate-spin {
  to { transform: rotate(360deg); }
}

.chevron {
  font-size: 1.4rem;
  color: var(--muted);
  transform: rotate(90deg);
  transition: transform 0.2s;
  flex-shrink: 0;
}

.chevron.open {
  transform: rotate(-90deg);
}

.feedback-text {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--line-soft);
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.9rem;
  line-height: 1.6;
  /* War fest auf var(--text-primary, #000) - diese Variable existiert im Design-System
     nicht (style.css definiert --fg/--muted), fiel also immer auf schwarz zurück. Auf dem
     im Dark Mode dunklen .glass-Panel-Hintergrund war der aufgeklappte Feedback-Text dadurch
     schwarz auf dunkel - nicht lesbar. */
  color: var(--fg);
}

.feedback-delta-summary {
  margin-bottom: 0.85rem;
}

.share-btn {
  margin-top: 0.75rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.75rem;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--line-strong));
  background: var(--accent-soft);
  color: var(--fg);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
}

.share-btn:active {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 40%, transparent);
}

.share-icon {
  width: 16px;
  height: 16px;
  stroke: var(--fg);
  stroke-width: 1.8;
  fill: none;
}

.load-more-btn {
  margin-top: 0.25rem;
  padding: 0.65rem;
  border-radius: 0.5rem;
  border: 1px solid var(--line-soft);
  background: transparent;
  color: var(--fg);
  font-weight: 500;
  cursor: pointer;
}

.load-more-btn:disabled {
  opacity: 0.6;
}

/* Der vorherige @media (prefers-color-scheme: dark)-Block wurde entfernt: er reagierte auf
   die OS-Einstellung statt auf das im Theme-Store gewählte App-Theme ([data-theme] am Root)
   und deckte ohnehin nicht die eigentliche Ursache ab (siehe .feedback-text oben). Hintergründe
   kommen jetzt direkt über var(--surface)/var(--surface-strong) theme-aware. */
</style>
