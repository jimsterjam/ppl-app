<template>
  <div class="timer-config-overlay" @click.self="close">
    <div class="timer-config">
      <header class="timer-config-header">
        <h3>{{ t('timer.configTitle') }}</h3>
        <button class="close-btn" type="button" @click="close">x</button>
      </header>

      <div class="timer-config-body">
        <div class="config-grid">
          <!-- Stunden-Eingabe entfernt -->
          <label>
            <span>{{ t('timer.minutes') }}</span>
            <div class="number-with-spinner">
              <input
                class="number-input"
                :value="minutes"
                readonly
                inputmode="numeric"
                @click="openPicker('minutes')"
              />
              <div v-if="!isMobile" class="spinner-vertical">
                <button class="spin-btn up" type="button" @click="adjustValue('minutes', 1)">▲</button>
                <button class="spin-btn down" type="button" @click="adjustValue('minutes', -1)">▼</button>
              </div>
            </div>
          </label>
          <label>
            <span>{{ t('timer.seconds') }}</span>
            <div class="number-with-spinner">
              <input
                class="number-input"
                :value="seconds"
                readonly
                inputmode="numeric"
                @click="openPicker('seconds')"
              />
              <div v-if="!isMobile" class="spinner-vertical">
                <button class="spin-btn up" type="button" @click="adjustValue('seconds', 1)">▲</button>
                <button class="spin-btn down" type="button" @click="adjustValue('seconds', -1)">▼</button>
              </div>
            </div>
          </label>
        </div>

        <div class="config-grid">
          <label>
            <span>{{ t('timer.restSeconds') }}</span>
            <div class="number-with-spinner">
              <input
                class="number-input"
                :value="restSeconds"
                readonly
                inputmode="numeric"
                @click="openPicker('restSeconds')"
              />
              <div v-if="!isMobile" class="spinner-vertical">
                <button class="spin-btn up" type="button" @click="adjustValue('restSeconds', 5)">▲</button>
                <button class="spin-btn down" type="button" @click="adjustValue('restSeconds', -5)">▼</button>
              </div>
            </div>
          </label>
          <label>
            <span>{{ t('timer.intervals') }}</span>
            <div class="number-with-spinner">
              <input
                class="number-input"
                :value="intervals"
                readonly
                inputmode="numeric"
                @click="openPicker('intervals')"
              />
              <div v-if="!isMobile" class="spinner-vertical">
                <button class="spin-btn up" type="button" @click="adjustValue('intervals', 1)">▲</button>
                <button class="spin-btn down" type="button" @click="adjustValue('intervals', -1)">▼</button>
              </div>
            </div>
          </label>
          <label>
            <span>{{ t('timer.prepSeconds') }}</span>
            <div class="number-with-spinner">
              <input
                class="number-input"
                :value="prepSeconds"
                readonly
                inputmode="numeric"
                @click="openPicker('prepSeconds')"
              />
              <div v-if="!isMobile" class="spinner-vertical">
                <button class="spin-btn up" type="button" @click="adjustValue('prepSeconds', 5)">▲</button>
                <button class="spin-btn down" type="button" @click="adjustValue('prepSeconds', -5)">▼</button>
              </div>
            </div>
          </label>
        </div>

        <div class="toggle-grid">
          <label class="toggle">
            <input v-model="countdownSound" type="checkbox" :disabled="speechEnabled" />
            <span>{{ t('timer.countdownSound') }}</span>
          </label>
          <label class="toggle">
            <input v-model="speechEnabled" type="checkbox" />
            <span>{{ t('timer.speech') }}</span>
          </label>
          <label class="toggle">
            <input v-model="vibration" type="checkbox" />
            <span>{{ t('timer.vibration') }}</span>
          </label>
        </div>
      </div>

      <footer class="timer-config-footer">
        <button class="ghost-btn" type="button" @click="close">{{ t('common.cancel') }}</button>
        <button class="primary-btn" type="button" :disabled="!isValid" @click="saveAndStart">
          {{ t('timer.saveStart') }}
        </button>
      </footer>
    </div>
  </div>

  <NumberPicker
    :visible="pickerVisible"
    :value="pickerValue"
    :min="pickerConfig.min"
    :max="pickerConfig.max"
    :step="pickerConfig.step"
    :title="pickerConfig.title"
    :confirmText="pickerConfig.confirmText"
    :cancelText="pickerConfig.cancelText"
    @update:value="pickerValue = $event"
    @confirm="onPickerConfirm"
    @cancel="onPickerCancel"
  />
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTimerStore } from '@/stores/timerStore'
import { useToastStore } from '@/stores/toastStore'
import NumberPicker from '@/components/NumberPicker.vue'

const emit = defineEmits(['close'])
const { t, locale } = useI18n()
const timerStore = useTimerStore()
const toast = useToastStore()

// Stunden-Eingabe entfernt
const minutes = ref(timerStore.config.minutes)
const seconds = ref(timerStore.config.seconds)
const prepSeconds = ref(timerStore.config.prepSeconds ?? 0)
const restSeconds = ref(timerStore.config.restSeconds)
const intervals = ref(timerStore.config.intervals)
const countdownSound = ref(timerStore.config.countdownSound)
const speechEnabled = ref(timerStore.config.speechEnabled)
const vibration = ref(timerStore.config.vibration)

const isMobile = ref(typeof window !== 'undefined' && ('ontouchstart' in window || window.innerWidth <= 768))
const pickerVisible = ref(false)
const pickerValue = ref(0)
const pickerTarget = ref('')
const pickerConfig = reactive({ min: 0, max: 60, step: 1, title: '', confirmText: 'OK', cancelText: 'Abbrechen' })

const limits = {
  // hours entfernt
  minutes: { min: 0, max: 59, step: 1, label: () => t('timer.minutes') },
  seconds: { min: 0, max: 59, step: 1, label: () => t('timer.seconds') },
  prepSeconds: { min: 0, max: 300, step: 5, label: () => t('timer.prepSeconds') },
  restSeconds: { min: 0, max: 300, step: 5, label: () => t('timer.restSeconds') },
  intervals: { min: 1, max: 50, step: 1, label: () => t('timer.intervals') }
}

const fieldRefs = {
  // hours entfernt
  minutes,
  seconds,
  prepSeconds,
  restSeconds,
  intervals
}

function clampValue(key, value) {
  const limit = limits[key]
  const next = Math.min(limit.max, Math.max(limit.min, value))
  return next
}

function adjustValue(key, delta) {
  const limit = limits[key]
  const refValue = fieldRefs[key]
  const next = clampValue(key, refValue.value + delta)
  refValue.value = next
}

function openPicker(key) {
  if (!isMobile.value) return
  const limit = limits[key]
  pickerTarget.value = key
  pickerValue.value = fieldRefs[key].value
  pickerConfig.min = limit.min
  pickerConfig.max = limit.max
  pickerConfig.step = limit.step
  pickerConfig.title = limit.label()
  pickerConfig.confirmText = t('common.done') || 'OK'
  pickerConfig.cancelText = t('common.cancel') || 'Abbrechen'
  pickerVisible.value = true
}

function onPickerConfirm(value) {
  const key = pickerTarget.value
  if (!key) return
  fieldRefs[key].value = clampValue(key, value)
  pickerVisible.value = false
  pickerTarget.value = ''
}

function onPickerCancel() {
  pickerVisible.value = false
  pickerTarget.value = ''
}

const isValid = computed(() => {
  const totalSeconds = (minutes.value * 60) + seconds.value
  return totalSeconds > 0
})

function close() {
  emit('close')
}

function saveAndStart() {
  if (!isValid.value) return
  timerStore.unlockAudio()
  timerStore.unlockSpeech()
  timerStore.start({
    // hours entfernt
    minutes: minutes.value,
    seconds: seconds.value,
    prepSeconds: prepSeconds.value,
    restSeconds: restSeconds.value,
    intervals: intervals.value,
    countdown: true,
    countdownSound: speechEnabled.value ? false : countdownSound.value,
    speechEnabled: speechEnabled.value,
    speechLocale: String(locale?.value || 'de-DE'),
    vibration: vibration.value
  })
  if (speechEnabled.value) {
    const backend = timerStore.ttsBackend()
    const label = backend === 'native' ? 'Native TTS' : backend === 'web' ? 'Web Speech' : 'No TTS'
    toast.info(`TTS: ${label}`, { duration: 2500 })
  }
  emit('close')
}
</script>

<style scoped>
.timer-config-overlay {
  position: fixed;
  inset: 0;
  background: rgba(5, 7, 10, 0.72);
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.timer-config {
  width: min(560px, 100%);
  background: color-mix(in srgb, var(--bg-panel) 92%, #0a0f14 8%);
  border: 1px solid color-mix(in srgb, var(--card-border) 65%, transparent);
  border-radius: 18px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  max-height: 85vh;
}

.timer-config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 18px;
  border-bottom: 1px solid color-mix(in srgb, var(--card-border) 70%, transparent);
}

.timer-config-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 800;
}

.close-btn {
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 1.6rem;
  cursor: pointer;
}

.timer-config-body {
  padding: 16px 18px 24px;
  display: grid;
  gap: 16px;
  overflow-y: auto;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

label {
  display: grid;
  gap: 8px;
  font-size: 0.85rem;
  color: var(--muted);
}

select {
  background: var(--surface);
  border: 1px solid var(--card-border);
  border-radius: 10px;
  padding: 10px 12px;
  color: var(--fg);
  font-size: 1rem;
}

.number-with-spinner {
  display: flex;
  align-items: center;
  gap: 6px;
}

.number-input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--card-border);
  background: var(--surface);
  color: var(--fg);
  font-size: 1rem;
  text-align: center;
  cursor: pointer;
}

.spinner-vertical {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.spin-btn {
  background: transparent;
  border: 1px solid var(--card-border);
  padding: 2px 6px;
  border-radius: 6px;
  font-size: 0.7rem;
  line-height: 1;
  cursor: pointer;
}

.spin-btn:active {
  transform: scale(0.98);
}

.toggle-grid {
  display: grid;
  gap: 10px;
}

.toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--fg);
  font-size: 0.9rem;
}

.timer-config-footer {
  position: sticky;
  bottom: 0;
  padding: 14px 18px 18px;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  background: linear-gradient(0deg, rgba(6, 8, 12, 0.95), rgba(6, 8, 12, 0.65));
  border-top: 1px solid color-mix(in srgb, var(--card-border) 70%, transparent);
}

.ghost-btn,
.primary-btn {
  border-radius: 12px;
  padding: 10px 16px;
  font-weight: 700;
  border: 1px solid color-mix(in srgb, var(--card-border) 70%, transparent);
  cursor: pointer;
}

.ghost-btn {
  background: transparent;
  color: var(--fg);
}

.primary-btn {
  background: color-mix(in srgb, var(--accent) 55%, #0d1117 45%);
  color: var(--fg-strong, #f9fafb);
}

.primary-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
