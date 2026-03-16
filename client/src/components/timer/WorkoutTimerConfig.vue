<template>
  <div class="timer-config-overlay" @click.self="close">
    <div class="timer-config">
      <header class="timer-config-header">
        <h3>{{ t('timer.configTitle') }}</h3>
        <button class="close-btn" type="button" @click="close">x</button>
      </header>

      <div class="timer-config-body">
        <div class="mode-switch" role="tablist" aria-label="Timer-Modus">
          <button
            class="mode-btn"
            :class="{ active: mode === 'interval' }"
            type="button"
            @click="mode = 'interval'"
          >
            {{ t('timer.modeInterval') || 'Intervall' }}
          </button>
          <button
            class="mode-btn"
            :class="{ active: mode === 'stopwatch' }"
            type="button"
            @click="mode = 'stopwatch'"
          >
            {{ t('timer.modeStopwatch') || 'Stoppuhr' }}
          </button>
        </div>

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

        <div class="mode-switch" role="tablist" aria-label="Zeitrichtung">
          <button
            class="mode-btn"
            :class="{ active: countDirection === 'down' }"
            type="button"
            @click="countDirection = 'down'"
          >
            {{ t('timer.directionDown') || 'Runter' }}
          </button>
          <button
            class="mode-btn"
            :class="{ active: countDirection === 'up' }"
            type="button"
            @click="countDirection = 'up'"
          >
            {{ t('timer.directionUp') || 'Hoch' }}
          </button>
        </div>

        <div v-if="mode === 'interval'" class="config-grid">
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
          <label class="toggle slider-toggle" :class="{ on: countdownSound }">
            <span>{{ t('timer.countdownSound') }}</span>
            <input v-model="countdownSound" type="checkbox" class="sr-only" />
            <span class="slider" aria-hidden="true"><span class="knob" /></span>
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
import NumberPicker from '@/components/NumberPicker.vue'

const emit = defineEmits(['close'])
const { t, locale } = useI18n()
const timerStore = useTimerStore()

// Stunden-Eingabe entfernt
const mode = ref(String(timerStore.config.mode || 'interval') === 'stopwatch' ? 'stopwatch' : 'interval')
const countDirection = ref(String(timerStore.config.countDirection || 'down') === 'up' ? 'up' : 'down')
const minutes = ref(timerStore.config.minutes)
const seconds = ref(timerStore.config.seconds)
const prepSeconds = ref(timerStore.config.prepSeconds ?? 0)
const restSeconds = ref(timerStore.config.restSeconds)
const intervals = ref(timerStore.config.intervals)
const countdownSound = ref(timerStore.config.countdownSound)

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
  if (mode.value === 'stopwatch') return true
  const totalSeconds = (minutes.value * 60) + seconds.value
  return totalSeconds > 0
})

function close() {
  emit('close')
}

function saveAndStart() {
  if (!isValid.value) return
  timerStore.unlockAudio()
  timerStore.start({
    mode: mode.value,
    countDirection: countDirection.value,
    // hours entfernt
    minutes: minutes.value,
    seconds: seconds.value,
    prepSeconds: prepSeconds.value,
    restSeconds: mode.value === 'interval' ? restSeconds.value : 0,
    intervals: mode.value === 'interval' ? intervals.value : 1,
    countdown: mode.value === 'interval' ? true : (countDirection.value === 'down'),
    countdownSound: countdownSound.value,
    speechEnabled: false,
    speechLocale: String(locale?.value || 'de-DE')
  })
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

.mode-switch {
  display: inline-flex;
  gap: 8px;
  padding: 4px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--card-border) 70%, transparent);
  background: color-mix(in srgb, var(--surface) 88%, transparent);
}

.mode-btn {
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted);
  padding: 8px 12px;
  border-radius: 9px;
  font-weight: 700;
  cursor: pointer;
}

.mode-btn.active {
  color: var(--fg);
  border-color: color-mix(in srgb, var(--accent-color) 45%, transparent);
  background: color-mix(in srgb, var(--accent-color) 16%, transparent);
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
  justify-content: space-between;
  gap: 12px;
  color: var(--fg);
  font-size: 0.9rem;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  border: 0;
  padding: 0;
  clip: rect(0 0 0 0);
  overflow: hidden;
}

.slider-toggle .slider {
  width: 52px;
  height: 30px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--card-border) 75%, transparent);
  border: 1px solid color-mix(in srgb, var(--card-border) 80%, transparent);
  position: relative;
  transition: all 0.2s ease;
}

.slider-toggle .knob {
  position: absolute;
  left: 3px;
  top: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.32);
  transition: transform 0.2s ease;
}

.slider-toggle.on .slider {
  background: color-mix(in srgb, var(--accent) 55%, #0d1117 45%);
  border-color: color-mix(in srgb, var(--accent) 65%, transparent);
}

.slider-toggle.on .knob {
  transform: translateX(22px);
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
