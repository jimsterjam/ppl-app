<template>
  <div class="timer-config-overlay" @click.self="close">
    <div class="timer-config">
      <header class="timer-config-header">
        <h3>{{ t('timer.configTitle') }}</h3>
        <button class="close-btn" type="button" @click="close">✕</button>
      </header>

      <div class="timer-config-body">

        <!-- Modus -->
        <div class="section">
          <div class="mode-switch" role="tablist" aria-label="Timer-Modus">
            <button
              class="mode-btn"
              :class="{ active: mode === 'interval' }"
              type="button"
              @click="mode = 'interval'"
            >{{ t('timer.modeInterval') || 'Intervall' }}</button>
            <button
              class="mode-btn"
              :class="{ active: mode === 'stopwatch' }"
              type="button"
              @click="mode = 'stopwatch'"
            >{{ t('timer.modeStopwatch') || 'Stoppuhr' }}</button>
          </div>
        </div>

        <!-- Minuten / Sekunden -->
        <div class="section">
          <div class="config-grid">
            <label>
              <span class="field-label">{{ t('timer.minutes') }}</span>
              <div class="number-with-spinner">
                <input class="number-input" :value="minutes" readonly inputmode="numeric" @click="openPicker('minutes')" />
                <div v-if="!isMobile" class="spinner-vertical">
                  <button class="spin-btn up" type="button" @click="adjustValue('minutes', 1)">▲</button>
                  <button class="spin-btn down" type="button" @click="adjustValue('minutes', -1)">▼</button>
                </div>
              </div>
            </label>
            <label>
              <span class="field-label">{{ t('timer.seconds') }}</span>
              <div class="number-with-spinner">
                <input class="number-input" :value="seconds" readonly inputmode="numeric" @click="openPicker('seconds')" />
                <div v-if="!isMobile" class="spinner-vertical">
                  <button class="spin-btn up" type="button" @click="adjustValue('seconds', 1)">▲</button>
                  <button class="spin-btn down" type="button" @click="adjustValue('seconds', -1)">▼</button>
                </div>
              </div>
            </label>
          </div>
        </div>

        <!-- Richtung -->
        <div class="section">
          <div class="mode-switch" role="tablist" aria-label="Zeitrichtung">
            <button
              class="mode-btn"
              :class="{ active: countDirection === 'down' }"
              type="button"
              @click="countDirection = 'down'"
            >{{ t('timer.directionDown') || 'Runter' }}</button>
            <button
              class="mode-btn"
              :class="{ active: countDirection === 'up' }"
              type="button"
              @click="countDirection = 'up'"
            >{{ t('timer.directionUp') || 'Hoch' }}</button>
          </div>
        </div>

        <!-- Intervall-Einstellungen -->
        <div v-if="mode === 'interval'" class="section">
          <div class="config-grid">
            <label>
              <span class="field-label">{{ t('timer.restSeconds') }}</span>
              <div class="number-with-spinner">
                <input class="number-input" :value="restSeconds" readonly inputmode="numeric" @click="openPicker('restSeconds')" />
                <div v-if="!isMobile" class="spinner-vertical">
                  <button class="spin-btn up" type="button" @click="adjustValue('restSeconds', 5)">▲</button>
                  <button class="spin-btn down" type="button" @click="adjustValue('restSeconds', -5)">▼</button>
                </div>
              </div>
            </label>
            <label>
              <span class="field-label">{{ t('timer.intervals') }}</span>
              <div class="number-with-spinner">
                <input class="number-input" :value="intervals" readonly inputmode="numeric" @click="openPicker('intervals')" />
                <div v-if="!isMobile" class="spinner-vertical">
                  <button class="spin-btn up" type="button" @click="adjustValue('intervals', 1)">▲</button>
                  <button class="spin-btn down" type="button" @click="adjustValue('intervals', -1)">▼</button>
                </div>
              </div>
            </label>
            <label>
              <span class="field-label">{{ t('timer.prepSeconds') }}</span>
              <div class="number-with-spinner">
                <input class="number-input" :value="prepSeconds" readonly inputmode="numeric" @click="openPicker('prepSeconds')" />
                <div v-if="!isMobile" class="spinner-vertical">
                  <button class="spin-btn up" type="button" @click="adjustValue('prepSeconds', 5)">▲</button>
                  <button class="spin-btn down" type="button" @click="adjustValue('prepSeconds', -5)">▼</button>
                </div>
              </div>
            </label>
          </div>
        </div>

        <!-- Countdown-Sound Auswahl -->
        <div class="section">
          <span class="field-label">{{ t('timer.countdownSound') }}</span>
          <div class="sound-options">
            <button
              v-for="opt in soundOptions"
              :key="opt.value"
              class="sound-btn"
              :class="{ active: countdownSoundType === opt.value }"
              type="button"
              @click="selectSound(opt.value)"
            >
              <span class="sound-icon">{{ opt.icon }}</span>
              <span class="sound-name">{{ opt.label }}</span>
            </button>
          </div>
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
import { playBoxGong, playChineseGong, playBell } from '@/utils/timerAudio'

const emit = defineEmits(['close'])
const { t, locale } = useI18n()
const timerStore = useTimerStore()

const mode = ref(String(timerStore.config.mode || 'interval') === 'stopwatch' ? 'stopwatch' : 'interval')
const countDirection = ref(String(timerStore.config.countDirection || 'down') === 'up' ? 'up' : 'down')
const minutes = ref(timerStore.config.minutes)
const seconds = ref(timerStore.config.seconds)
const prepSeconds = ref(timerStore.config.prepSeconds ?? 0)
const restSeconds = ref(timerStore.config.restSeconds)
const intervals = ref(timerStore.config.intervals)
const countdownSoundType = ref(timerStore.config.countdownSoundType || 'box-gong')

const isMobile = ref(typeof window !== 'undefined' && ('ontouchstart' in window || window.innerWidth <= 768))
const pickerVisible = ref(false)
const pickerValue = ref(0)
const pickerTarget = ref('')
const pickerConfig = reactive({ min: 0, max: 60, step: 1, title: '', confirmText: 'OK', cancelText: 'Abbrechen' })

const soundOptions = computed(() => [
  { value: 'none',         icon: '🔇', label: t('timer.soundNone')        || 'Aus' },
  { value: 'box-gong',     icon: '🥊', label: t('timer.soundBoxGong')     || 'Box Gong' },
  { value: 'chinese-gong', icon: '🪘', label: t('timer.soundChineseGong') || 'China Gong' },
  { value: 'bell',         icon: '🔔', label: t('timer.soundBell')        || 'Glocke' }
])

function selectSound(value) {
  countdownSoundType.value = value
  if (value !== 'none') {
    timerStore.unlockAudio()
    if (value === 'box-gong')     playBoxGong(0.7)
    else if (value === 'chinese-gong') playChineseGong(0.65)
    else if (value === 'bell')    playBell(0.7)
  }
}

const limits = {
  minutes:     { min: 0,   max: 59,  step: 1, label: () => t('timer.minutes') },
  seconds:     { min: 0,   max: 59,  step: 1, label: () => t('timer.seconds') },
  prepSeconds: { min: 0,   max: 300, step: 5, label: () => t('timer.prepSeconds') },
  restSeconds: { min: 0,   max: 300, step: 5, label: () => t('timer.restSeconds') },
  intervals:   { min: 1,   max: 50,  step: 1, label: () => t('timer.intervals') }
}

const fieldRefs = { minutes, seconds, prepSeconds, restSeconds, intervals }

function clampValue(key, value) {
  const limit = limits[key]
  return Math.min(limit.max, Math.max(limit.min, value))
}

function adjustValue(key, delta) {
  fieldRefs[key].value = clampValue(key, fieldRefs[key].value + delta)
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
  return (minutes.value * 60) + seconds.value > 0
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
    minutes: minutes.value,
    seconds: seconds.value,
    prepSeconds: prepSeconds.value,
    restSeconds: mode.value === 'interval' ? restSeconds.value : 0,
    intervals: mode.value === 'interval' ? intervals.value : 1,
    countdown: mode.value === 'interval' ? true : (countDirection.value === 'down'),
    countdownSoundType: countdownSoundType.value,
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
  background: color-mix(in srgb, var(--bg) 55%, black 45%);
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.timer-config {
  width: min(580px, 100%);
  background: color-mix(in srgb, var(--bg-panel) 94%, transparent);
  border: 1px solid color-mix(in srgb, var(--card-border) 65%, transparent);
  border-radius: 20px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
  display: flex;
  flex-direction: column;
  max-height: 90vh;
}

.timer-config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 22px;
  border-bottom: 1px solid color-mix(in srgb, var(--card-border) 70%, transparent);
  flex-shrink: 0;
}

.timer-config-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
}

.close-btn {
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
}

.timer-config-body {
  padding: 20px 22px 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mode-switch {
  display: flex;
  gap: 8px;
  padding: 5px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--card-border) 70%, transparent);
  background: color-mix(in srgb, var(--surface) 88%, transparent);
}

.mode-btn {
  flex: 1;
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted);
  padding: 11px 16px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
}

.mode-btn.active {
  color: var(--fg);
  border-color: color-mix(in srgb, var(--accent-color) 45%, transparent);
  background: color-mix(in srgb, var(--accent-color) 16%, transparent);
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 14px;
}

.field-label {
  display: block;
  font-size: 1rem;
  font-weight: 600;
  color: var(--muted);
}

.number-with-spinner {
  display: flex;
  align-items: center;
  gap: 8px;
}

.number-input {
  width: 100%;
  padding: 13px 14px;
  border-radius: 12px;
  border: 1px solid var(--card-border);
  background: var(--surface);
  color: var(--fg);
  font-size: 1.2rem;
  font-weight: 700;
  text-align: center;
  cursor: pointer;
}

.spinner-vertical {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.spin-btn {
  background: transparent;
  border: 1px solid var(--card-border);
  padding: 3px 7px;
  border-radius: 7px;
  font-size: 0.75rem;
  line-height: 1;
  cursor: pointer;
}

.spin-btn:active {
  transform: scale(0.97);
}

/* Sound-Auswahl */
.sound-options {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.sound-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  padding: 14px 6px;
  border-radius: 14px;
  border: 1.5px solid color-mix(in srgb, var(--card-border) 80%, transparent);
  background: color-mix(in srgb, var(--surface) 80%, transparent);
  color: var(--muted);
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
}

.sound-btn:active {
  transform: scale(0.97);
}

.sound-btn.active {
  border-color: color-mix(in srgb, var(--accent-color) 65%, transparent);
  background: color-mix(in srgb, var(--accent-color) 16%, transparent);
  color: var(--fg);
}

.sound-icon {
  font-size: 1.6rem;
  line-height: 1;
}

.sound-name {
  font-size: 0.78rem;
  font-weight: 700;
  text-align: center;
  line-height: 1.2;
}

/* Footer */
.timer-config-footer {
  flex-shrink: 0;
  padding: 16px 22px 20px;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  background: color-mix(in srgb, var(--bg-elevated) 94%, transparent);
  border-top: 1px solid color-mix(in srgb, var(--card-border) 70%, transparent);
  border-radius: 0 0 20px 20px;
}

.ghost-btn,
.primary-btn {
  border-radius: 13px;
  padding: 13px 22px;
  font-size: 1rem;
  font-weight: 700;
  border: 1px solid color-mix(in srgb, var(--card-border) 70%, transparent);
  cursor: pointer;
  font-family: inherit;
}

.ghost-btn {
  background: transparent;
  color: var(--fg);
}

.primary-btn {
  background: color-mix(in srgb, var(--accent) 72%, transparent);
  color: var(--accent-color-contrast, #060606);
}

.primary-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
