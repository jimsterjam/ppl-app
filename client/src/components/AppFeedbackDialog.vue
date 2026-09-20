<template>
  <Teleport to="body">
  <div class="modal-overlay" @click.self="!submitting && $emit('close')">
    <div class="modal-content feedback-modal">
      <div class="modal-header">
        <h3>{{ t('appFeedback.dialogTitle') }}</h3>
        <button v-if="!submitting" class="close-btn" @click="$emit('close')">×</button>
      </div>

      <div class="modal-body">
        <template v-if="!success">
          <div class="feedback-categories">
            <p class="hint">{{ t('appFeedback.categoryLabel') }}</p>
            <label v-for="opt in categoryOptions" :key="opt.value" class="feedback-category-opt">
              <input v-model="category" type="radio" name="feedback-category" :value="opt.value" :disabled="submitting" />
              <span>{{ opt.label }}</span>
            </label>
          </div>

          <textarea
            v-model="text"
            class="feedback-textarea"
            :placeholder="t('appFeedback.textPlaceholder')"
            :disabled="submitting"
            rows="4"
            maxlength="2000"
          />

          <label class="feedback-consent-opt">
            <input v-model="consentGiven" type="checkbox" :disabled="submitting" />
            <span>{{ t('appFeedback.consentLabel') }}</span>
          </label>
          <p class="hint tiny">{{ t('appFeedback.consentHint') }}</p>

          <p v-if="errorMessage" class="warning-text">{{ errorMessage }}</p>
        </template>

        <template v-else>
          <p class="warning-text success-text">{{ t('appFeedback.success') }}</p>
        </template>
      </div>

      <div class="modal-actions">
        <template v-if="!success">
          <button class="cancel-btn" :disabled="submitting" @click="$emit('close')">
            {{ t('common.cancel') }}
          </button>
          <button class="confirm-danger-btn feedback-submit-btn" :disabled="!category || submitting" @click="submit">
            <span v-if="submitting" class="spinner spin-indicator" aria-hidden="true"></span>
            <span>{{ submitting ? t('appFeedback.submitting') : t('appFeedback.submit') }}</span>
          </button>
        </template>
        <template v-else>
          <button class="confirm-danger-btn feedback-submit-btn" @click="$emit('close')">
            {{ t('common.done') }}
          </button>
        </template>
      </div>
    </div>
  </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { submitAppFeedback } from '@/api/feedback'
import { useFirebaseAuth } from '@/utils/firebaseAuth'
import { logger } from '@/utils/logger'
import { useScrollLock } from '@/composables/useScrollLock'

// Allgemeiner Feedback-Dialog (Fehler/Idee/Unklarheit) - siehe server/routes/feedback.js,
// server/models/AppFeedback.js. KOMPLETT GETRENNT von der Bewertung einzelner KI-Feedbacks
// (AiFeedbackRatingWidget.vue) - diese Komponente rührt daran nicht an. Wiederverwendbar:
// aus SettingsView.vue (dauerhafter Zugang) UND aus der einmaligen Einladung nach dem ersten
// gespeicherten Workout (siehe OneTimeHint-Trigger in WorkoutDetailView.vue).
defineEmits(['close'])

const { t } = useI18n()
const route = useRoute()

const categoryOptions = computed(() => ([
  { value: 'bug', label: t('appFeedback.categoryBug') },
  { value: 'idea', label: t('appFeedback.categoryIdea') },
  { value: 'unclear', label: t('appFeedback.categoryUnclear') }
]))

const category = ref('')
const text = ref('')
const consentGiven = ref(false)
const submitting = ref(false)
const success = ref(false)
const errorMessage = ref('')

// Diese Komponente wird komplett gemounted/entmountet (v-if am Aufrufer, z.B.
// SettingsView.vue/PostWorkoutSummary.vue), nicht intern ein-/ausgeblendet -
// daher Sperre direkt an den Lifecycle koppeln statt an ein Prop/watch.
const { lock: lockBodyScroll, unlock: unlockBodyScroll } = useScrollLock()
onMounted(lockBodyScroll)
onBeforeUnmount(unlockBodyScroll)

async function getIdTokenSafe() {
  try {
    const { getIdToken } = useFirebaseAuth()
    return await getIdToken().catch(() => null)
  } catch (e) {
    logger.warn('[AppFeedbackDialog] getIdTokenSafe failed:', e?.message || e)
    return null
  }
}

// Nur die vier vorgesehenen technischen Felder - NIEMALS Trainingsdaten/Notizen/KI-Feedback-
// Inhalte (siehe Datenschutz-Vorgabe). Jeder Aufruf ist defensiv try/catch-umschlossen, da die
// zugrunde liegenden Capacitor-Plugins im Web-Kontext (Browser-Preview) teils nicht
// implementiert sind und werfen können.
async function collectDeviceContext() {
  const context = {
    appVersion: null,
    platform: null,
    osVersion: null,
    deviceModel: null,
    screenContext: String(route?.name || '') || null
  }

  try {
    context.platform = Capacitor.getPlatform()
  } catch {}

  try {
    const info = await CapacitorApp.getInfo()
    context.appVersion = info?.version || null
  } catch {
    // Web/Dev-Umgebung: App.getInfo() ist dort nicht implementiert - kein Fehlerfall.
  }

  try {
    const { Device } = await import('@capacitor/device')
    const info = await Device.getInfo()
    context.osVersion = info?.osVersion || null
    context.deviceModel = info?.model || null
  } catch {
    // Web/Dev-Umgebung oder Plugin nicht verfügbar - Felder bleiben null.
  }

  return context
}

async function submit() {
  if (!category.value || submitting.value) return
  submitting.value = true
  errorMessage.value = ''

  try {
    const token = await getIdTokenSafe()
    const context = consentGiven.value ? await collectDeviceContext() : null

    await submitAppFeedback(token, {
      category: category.value,
      text: text.value,
      context,
      consentGiven: consentGiven.value
    })

    success.value = true
  } catch (error) {
    logger.warn('[AppFeedbackDialog] submit fehlgeschlagen:', error?.message || error)
    errorMessage.value = t('appFeedback.error')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
/* Eigenständige Modal-Chrome-Styles (Overlay/Content/Header/Actions/Buttons) statt wie zuvor
   implizit von Klassen des Aufrufers (SettingsView.vue) mitzuerben: über Vue's Scoped-CSS-
   Vererbung auf Root-Elemente von Kindkomponenten wirkte das dort zufällig, war aber beim
   zweiten Aufrufer (PostWorkoutSummary.vue, definiert dort kein .modal-overlay) komplett
   ungestylt - das Dialogfenster hätte dort ohne echtes Overlay/Fixed-Positioning gerendert. */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  max-width: 500px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  max-height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 24px 0;
  margin-bottom: 16px;
}

.modal-header h3 {
  color: var(--fg);
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 1.5rem;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: var(--surface);
  color: var(--fg);
}

.modal-body {
  padding: 0 24px 24px;
  overflow: auto;
}

.warning-text {
  color: var(--muted);
  margin-bottom: 20px;
  line-height: 1.5;
  font-size: 0.95rem;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 0 24px 24px;
}

.cancel-btn {
  background: var(--surface);
  border: 1px solid var(--card-border);
  color: var(--fg);
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cancel-btn:hover {
  background: color-mix(in srgb, var(--fg) 10%, var(--surface));
}

.confirm-danger-btn {
  background: var(--danger);
  border: none;
  color: white;
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.confirm-danger-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--danger) 85%, black);
  transform: translateY(-1px);
}

.confirm-danger-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.feedback-categories {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.feedback-category-opt {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.75rem;
  border-radius: 12px;
  border: 1px solid var(--line-soft);
  cursor: pointer;
  min-height: 44px;
}

.feedback-textarea {
  width: 100%;
  min-height: 96px;
  padding: 0.75rem;
  border-radius: 12px;
  border: 1px solid var(--line-soft);
  background: var(--bg-panel);
  color: var(--fg);
  font-family: inherit;
  font-size: 0.95rem;
  resize: vertical;
  margin-bottom: 1rem;
}

.feedback-consent-opt {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  cursor: pointer;
  margin-bottom: 0.25rem;
}

.feedback-submit-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.success-text {
  color: var(--fg);
}
</style>
