<template>
  <!-- Trainings-Erinnerung in den Einstellungen (Absprache Paul 11.11.): an/aus, Uhrzeit (Vorgaben oder eigene Zeit). -->
  <div class="reminder-settings">
    <p class="hint">{{ t('trainingReminder.settingsHint') }}</p>
    <ToggleSwitch :model-value="settings.trainingReminderEnabled" @update:model-value="toggle">
      {{ t('trainingReminder.toggle') }}
    </ToggleSwitch>
    <template v-if="settings.trainingReminderEnabled">
      <NotificationHint />
      <p class="reminder-time-label">{{ t('trainingReminder.timeLabel') }}</p>
      <div class="reminder-time-chips" role="group" :aria-label="t('trainingReminder.timeLabel')">
        <button
          v-for="preset in presets"
          :key="preset.key"
          type="button"
          class="reminder-chip"
          :aria-pressed="!customOpen && settings.trainingReminderTime === preset.time ? 'true' : 'false'"
          @click="pick(preset.time)"
        >
          <small>{{ preset.label }}</small>{{ preset.time.replace(/^0/, '') }}
        </button>
        <button type="button" class="reminder-chip" :aria-pressed="customOpen ? 'true' : 'false'" @click="customOpen = true">
          <small>{{ t('trainingReminder.presetCustom') }}</small>{{ customOpen ? settings.trainingReminderTime.replace(/^0/, '') : '…' }}
        </button>
      </div>
      <template v-if="customOpen">
        <input
          id="training-reminder-time"
          class="reminder-time-input"
          type="time"
          :min="MIN_REMINDER_TIME"
          :max="MAX_REMINDER_TIME"
          step="300"
          :value="settings.trainingReminderTime"
          :aria-label="t('trainingReminder.customAria')"
          @change="onCustom($event)"
        />
        <p class="hint">{{ t('trainingReminder.customHint') }}</p>
      </template>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ToggleSwitch from '@/components/ToggleSwitch.vue'
import NotificationHint from '@/components/NotificationHint.vue'
import { useSettingsStore } from '@/stores/settingsStore'
import { ensureNotificationPermission } from '@/utils/notificationPermission'
import { REMINDER_TIME_PRESETS, MIN_REMINDER_TIME, MAX_REMINDER_TIME } from '@/utils/trainingNudge'

const { t } = useI18n()
const settings = useSettingsStore()

const PRESET_LABEL_KEYS = { morning: 'trainingReminder.presetMorning', midday: 'trainingReminder.presetMidday', afternoon: 'trainingReminder.presetAfternoon' }
const presets = computed(() => REMINDER_TIME_PRESETS.map((p) => ({ ...p, label: t(PRESET_LABEL_KEYS[p.key]) })))
// Eigene Zeit ist offen, wenn die gespeicherte Uhrzeit keine Vorgabe ist.
const isPreset = (time) => REMINDER_TIME_PRESETS.some((p) => p.time === time)
const customOpen = ref(!isPreset(settings.trainingReminderTime))
// Kontowechsel oder Änderung von außen: Auswahl an die gespeicherte Uhrzeit anpassen.
watch(() => settings.trainingReminderTime, (time) => { if (!isPreset(time)) customOpen.value = true })

async function toggle(next) {
  // Einschalten: erst die iOS-Frage (nur, wenn iOS noch nie gefragt hat), dann speichern - so plant die Erinnerung
  // erst, wenn die Erlaubnis feststeht. Ohne Erlaubnis zeigt NotificationHint den Weg in die iPhone-Einstellungen.
  if (next) await ensureNotificationPermission()
  settings.setTrainingReminderEnabled(next)
}

function pick(time) {
  customOpen.value = false
  settings.setTrainingReminderTime(time)
}

function onCustom(event) {
  settings.setTrainingReminderTime(event?.target?.value)
  // Außerhalb 6:00–21:00 korrigiert der Store; das Feld zeigt den gespeicherten Wert.
  if (event?.target) event.target.value = settings.trainingReminderTime
}
</script>

<style scoped>
.reminder-settings { display: grid; gap: 10px; }
.hint { margin: 0; }
.reminder-time-label { margin: 4px 0 0; font-weight: 600; color: var(--fg); }
.reminder-time-chips { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.reminder-chip {
  display: grid;
  justify-items: center;
  gap: 1px;
  min-height: 48px;
  padding: 6px 2px;
  border-radius: 12px;
  border: 1px solid var(--card-border);
  background: transparent;
  color: var(--fg);
  font: inherit;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}
.reminder-chip small { font-size: 0.66rem; font-weight: 600; color: var(--muted); }
.reminder-chip[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: var(--accent-contrast, #060606); }
.reminder-chip[aria-pressed="true"] small { color: var(--accent-contrast, #060606); }
.reminder-time-input {
  justify-self: start;
  min-height: 44px;
  padding: 6px 12px;
  border-radius: 12px;
  border: 1px solid var(--card-border);
  background: var(--card-soft, transparent);
  color: var(--fg);
  font: inherit;
  font-size: 1rem;
}
</style>
