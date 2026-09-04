<template>
  <div class="ai-feedback-history glass">
    <div class="header">
      <h3>{{ t('feedbackHistory.title') || 'KI-Feedback Verlauf' }}</h3>
    </div>

    <div v-if="loading && items.length === 0" class="state-message">
      <div class="spinner"></div>
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
            <span class="feedback-date">{{ formatDate(item.ai_generated_at || item.date) }}</span>
          </div>
          <span class="chevron" :class="{ open: expandedId === item.workoutId }">›</span>
        </div>

        <div v-if="expandedId === item.workoutId" class="feedback-text">
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
import { fetchWorkoutFeedbacks } from '@/api/workouts'
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

function toggle(id) {
  expandedId.value = expandedId.value === id ? null : id
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
  color: var(--error, #FF3B30);
  margin: 0;
}

.retry-btn {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid var(--border, #ddd);
  background: var(--secondary-bg, #f5f5f5);
  cursor: pointer;
}

.spinner {
  width: 1.75rem;
  height: 1.75rem;
  border: 2px solid var(--border, #ddd);
  border-top-color: var(--primary, #007AFF);
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
