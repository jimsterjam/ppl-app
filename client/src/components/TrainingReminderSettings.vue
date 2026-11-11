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
        <button type="button" class="reminder-chip" :aria-pressed="customOpen ? 'true' : 'false'" @click="openCustom">
          <small>{{ t('trainingReminder.presetCustom') }}</small>{{ customOpen ? settings.trainingReminderTime.replace(/^0/, '') : '…' }}
        </button>
      </div>
    </template>
    <!-- Eigene Uhrzeit (Absprache Paul 11.11.): Tipp auf „Eigene“ öffnet sofort dieses Fenster, jede Uhrzeit erlaubt. -->
    <AppModal
      v-model="customModal"
      type="info"
      :title="t('trainingReminder.customTitle')"
      :confirm-text="t('trainingReminder.apply')"
      @confirm="applyCustom"
    >
      <TimeWheelPicker
        v-if="customModal"
        ref="wheelPicker"
        v-model="draftTime"
        :minute-step="REMINDER_MINUTE_STEP"
        :hour-label="t('trainingReminder.hourLabel')"
        :minute-label="t('trainingReminder.minuteLabel')"
      />
    </AppModal>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToggleSwitch from '@/components/ToggleSwitch.vue'
import NotificationHint from '@/components/NotificationHint.vue'
import AppModal from '@/components/AppModal.vue'
import TimeWheelPicker from '@/components/TimeWheelPicker.vue'
import { useSettingsStore } from '@/stores/settingsStore'
import { ensureNotificationPermission } from '@/utils/notificationPermission'
import { REMINDER_TIME_PRESETS, REMINDER_MINUTE_STEP } from '@/utils/trainingNudge'

const { t } = useI18n()
const settings = useSettingsStore()

const PRESET_LABEL_KEYS = { morning: 'trainingReminder.presetMorning', midday: 'trainingReminder.presetMidday', afternoon: 'trainingReminder.presetAfternoon' }
const presets = computed(() => REMINDER_TIME_PRESETS.map((p) => ({ ...p, label: t(PRESET_LABEL_KEYS[p.key]) })))
// Eigene Zeit ist offen, wenn die gespeicherte Uhrzeit keine Vorgabe ist.
const isPreset = (time) => REMINDER_TIME_PRESETS.some((p) => p.time === time)
// „Eigene“ ist markiert, sobald die gespeicherte Uhrzeit keine Vorgabe ist (auch nach Kontowechsel richtig).
const customOpen = computed(() => !isPreset(settings.trainingReminderTime))
const customModal = ref(false)
const draftTime = ref(settings.trainingReminderTime)
const wheelPicker = ref(null)

async function toggle(next) {
  // Einschalten: erst die iOS-Frage (nur, wenn iOS noch nie gefragt hat), dann speichern - so plant die Erinnerung
  // erst, wenn die Erlaubnis feststeht. Ohne Erlaubnis zeigt NotificationHint den Weg in die iPhone-Einstellungen.
  if (next) await ensureNotificationPermission()
  settings.setTrainingReminderEnabled(next)
}

function pick(time) {
  settings.setTrainingReminderTime(time)
}

function openCustom() {
  draftTime.value = settings.trainingReminderTime
  customModal.value = true
}

function applyCustom() {
  wheelPicker.value?.commit()
  settings.setTrainingReminderTime(draftTime.value)
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
</style>
