<template>
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
</template>

<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { submitAppFeedback } from '@/api/feedback'
import { useFirebaseAuth } from '@/utils/firebaseAuth'
import { logger } from '@/utils/logger'

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
