<template>
  <Teleport to="body">
    <div class="rest-settings-overlay" @click.self="$emit('close')">
      <div class="rest-settings" role="dialog" aria-modal="true" :aria-label="t('restTimer.settingsTitle')">
        <header class="rest-settings-header">
          <h3>{{ t('restTimer.settingsTitle') }}</h3>
          <button class="close-btn" type="button" :aria-label="t('common.close')" @click="$emit('close')">✕</button>
        </header>

        <div class="rest-settings-body">
          <!-- Verhalten: wirkt sofort -->
          <section class="section">
            <label class="toggle">
              <input type="checkbox" :checked="restTimer.autoStart" @change="restTimer.setAutoStart($event.target.checked)" />
              <span>{{ t('restTimer.autoStartLabel') }}</span>
            </label>
            <small class="hint">{{ t('restTimer.autoStartHint') }}</small>
            <label class="toggle">
              <input type="checkbox" :checked="restTimer.fullscreen" @change="restTimer.setFullscreen($event.target.checked)" />
              <span>{{ t('restTimer.fullscreenLabel') }}</span>
            </label>
            <small class="hint">{{ t('restTimer.fullscreenHint') }}</small>
          </section>

          <!-- Pausenzeiten je Ziel und Übungsart -->
          <section class="section">
            <h4>{{ t('restTimer.durationsTitle') }}</h4>
            <small class="hint">{{ t('restTimer.durationsHint') }}</small>
            <div v-for="goal in REST_GOALS" :key="goal" class="goal-block">
              <strong class="goal-name">{{ t(`restTimer.goal_${goal}`) }}</strong>
              <div v-for="type in REST_TYPES" :key="type" class="duration-row">
                <div class="duration-label">
                  <span>{{ t(type === 'compound' ? 'restTimer.typeCompound' : 'restTimer.typeIsolation') }}</span>
                  <small>{{ t('restTimer.defaultValue', { time: formatRest(defaultRestSeconds(goal, type) * 1000) }) }}</small>
                </div>
                <div class="stepper">
                  <button type="button" class="step-btn" :aria-label="stepAria('durationMinusAria', goal, type)" @click="step(goal, type, -REST_STEP_SECONDS)">−15</button>
                  <output class="duration-value" :class="{ changed: isChanged(goal, type) }">{{ formatRest(secondsFor(goal, type) * 1000) }}</output>
                  <button type="button" class="step-btn" :aria-label="stepAria('durationPlusAria', goal, type)" @click="step(goal, type, REST_STEP_SECONDS)">+15</button>
                </div>
              </div>
            </div>
            <button type="button" class="ghost-btn" :disabled="!hasChanges" @click="restTimer.resetDurations()">{{ t('restTimer.durationsReset') }}</button>
          </section>

          <!-- Ton am Pausenende -->
          <section class="section">
            <h4>{{ t('restTimer.soundTitle') }}</h4>
            <small class="hint">{{ t('restTimer.soundHint') }}</small>
            <div class="sound-list" role="radiogroup" :aria-label="t('restTimer.soundTitle')">
              <div v-for="id in REST_SOUND_IDS" :key="id" class="sound-row" :class="{ active: restTimer.soundId === id }">
                <label class="sound-choice">
                  <input type="radio" name="rest-sound" :value="id" :checked="restTimer.soundId === id" @change="chooseSound(id)" />
                  <span>{{ t(`restTimer.sound_${id}`) }}</span>
                </label>
                <button type="button" class="play-btn" :aria-label="t('restTimer.soundPreviewAria', { name: t(`restTimer.sound_${id}`) })" @click="preview(id)">▶</button>
              </div>
            </div>
            <small class="hint">{{ t('restTimer.soundDefaultHint') }}</small>
          </section>
        </div>

        <footer class="rest-settings-footer">
          <button class="primary-btn" type="button" @click="$emit('close')">{{ t('common.done') }}</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useScrollLock } from '@/composables/useScrollLock'
import { useRestTimerStore } from '@/stores/restTimerStore'
import { defaultRestSeconds, formatRest, REST_GOALS, REST_STEP_SECONDS, REST_TYPES, restSecondsFor } from '@/utils/restTimerRules'
import { REST_SOUND_IDS } from '@/utils/restMelodies'
import { ensureAudioUnlocked, playRestMelody, playWhistleStart } from '@/utils/timerAudio'

defineEmits(['close'])
const { t } = useI18n()
const restTimer = useRestTimerStore()
const { lock, unlock } = useScrollLock()
onMounted(lock)
onBeforeUnmount(unlock)

const secondsFor = (goal, type) => restSecondsFor(goal, type, null, restTimer.durations)
const isChanged = (goal, type) => secondsFor(goal, type) !== defaultRestSeconds(goal, type)
const hasChanges = computed(() => REST_GOALS.some((goal) => REST_TYPES.some((type) => isChanged(goal, type))))

function stepAria(key, goal, type) {
  return t(`restTimer.${key}`, {
    goal: t(`restTimer.goal_${goal}`),
    type: t(type === 'compound' ? 'restTimer.typeCompound' : 'restTimer.typeIsolation')
  })
}

function step(goal, type, delta) {
  const next = secondsFor(goal, type) + delta
  // Entspricht der Wert wieder dem Standard, wird der eigene Wert entfernt.
  restTimer.setDuration(goal, type, next === defaultRestSeconds(goal, type) ? null : next)
}

function chooseSound(id) {
  restTimer.setSound(id)
  preview(id)
}

// Probehören (Nutzer-Geste, daher darf iOS Audio starten). 'default' = der bisherige Gong der App.
function preview(id) {
  ensureAudioUnlocked()
  if (!playRestMelody(id)) playWhistleStart(1900)
}
</script>

<style scoped>
.rest-settings-overlay {
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--bg) 55%, black 45%);
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.rest-settings {
  width: min(580px, 100%);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background: color-mix(in srgb, var(--bg-panel) 94%, transparent);
  border: 1px solid color-mix(in srgb, var(--card-border) 65%, transparent);
  border-radius: 20px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
}
.rest-settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 22px;
  border-bottom: 1px solid color-mix(in srgb, var(--card-border) 70%, transparent);
  flex-shrink: 0;
}
.rest-settings-header h3 { margin: 0; font-size: 1.25rem; font-weight: 800; }
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
.rest-settings-body { padding: 20px 22px 24px; display: flex; flex-direction: column; gap: 24px; overflow-y: auto; }
.section { display: flex; flex-direction: column; gap: 10px; }
.section h4 { margin: 0; font-size: 1.05rem; font-weight: 800; }
.toggle { display: flex; align-items: center; gap: 10px; font-weight: 600; }
.hint { color: var(--muted); font-size: 0.8rem; line-height: 1.4; }
.goal-block { display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 14px; border: 1px solid color-mix(in srgb, var(--card-border) 70%, transparent); background: color-mix(in srgb, var(--surface) 80%, transparent); }
.goal-name { font-size: 0.95rem; }
.duration-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.duration-label { display: flex; flex-direction: column; gap: 2px; font-weight: 600; }
.duration-label small { color: var(--muted); font-weight: 400; font-size: 0.75rem; }
.stepper { display: flex; align-items: center; gap: 8px; }
.step-btn {
  min-width: 52px;
  padding: 9px 10px;
  border-radius: 10px;
  border: 1px solid var(--card-border);
  background: transparent;
  color: var(--fg);
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
}
.step-btn:active { transform: scale(0.97); }
.duration-value { min-width: 54px; text-align: center; font-size: 1.15rem; font-weight: 800; font-variant-numeric: tabular-nums; }
.duration-value.changed { color: var(--accent-color); }
.sound-list { display: flex; flex-direction: column; gap: 8px; }
.sound-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1.5px solid color-mix(in srgb, var(--card-border) 80%, transparent);
  background: color-mix(in srgb, var(--surface) 80%, transparent);
}
.sound-row.active {
  border-color: color-mix(in srgb, var(--accent-color) 65%, transparent);
  background: color-mix(in srgb, var(--accent-color) 16%, transparent);
}
.sound-choice { display: flex; align-items: center; gap: 10px; flex: 1; font-weight: 700; cursor: pointer; }
.play-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid var(--card-border);
  background: transparent;
  color: var(--fg);
  cursor: pointer;
}
.rest-settings-footer {
  flex-shrink: 0;
  padding: 16px 22px 20px;
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid color-mix(in srgb, var(--card-border) 70%, transparent);
}
.ghost-btn,
.primary-btn {
  border-radius: 13px;
  padding: 12px 20px;
  font-size: 1rem;
  font-weight: 700;
  border: 1px solid color-mix(in srgb, var(--card-border) 70%, transparent);
  cursor: pointer;
  font-family: inherit;
}
.ghost-btn { background: transparent; color: var(--fg); align-self: flex-start; }
.ghost-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.primary-btn { background: color-mix(in srgb, var(--accent) 72%, transparent); color: var(--accent-color-contrast, #060606); }
</style>
