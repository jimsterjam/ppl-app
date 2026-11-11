<template>
  <!-- Admin-Diagnose der Trainings-Erinnerung (nur Paul, wie das Verifier-Protokoll; bewusst nicht übersetzt).
       Zeigt Einstellungen, Erlaubnis, bei iOS geplante Mitteilung und die letzten Planungsläufe mit Grund. -->
  <div class="reminder-admin" data-i18n-ignore>
    <div class="reminder-admin-actions">
      <button type="button" class="reminder-admin-btn" @click="load">Status laden</button>
      <button type="button" class="reminder-admin-btn" :disabled="testing" @click="test">Test-Mitteilung in 1 Minute</button>
      <button v-if="text" type="button" class="reminder-admin-btn ghost" @click="copy">Kopieren</button>
    </div>
    <p v-if="note" class="reminder-admin-note">{{ note }}</p>
    <pre v-if="text" class="reminder-admin-out">{{ text }}</pre>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settingsStore'
import { getTrainingReminderDiagnostics, scheduleTrainingReminderTest } from '@/utils/trainingReminder'

const { t } = useI18n()
const settings = useSettingsStore()
const text = ref('')
const note = ref('')
const testing = ref(false)

function recentSyncs() {
  try {
    const all = JSON.parse(localStorage.getItem('bro_split_load_diagnostics_v1') || '[]')
    return all.filter((e) => String(e?.event || '').startsWith('training-reminder')).slice(-8)
  } catch {
    return []
  }
}

async function load() {
  const status = await getTrainingReminderDiagnostics(settings)
  text.value = JSON.stringify({ now: new Date().toISOString(), status, recent: recentSyncs() }, null, 2)
  note.value = ''
}

async function test() {
  testing.value = true
  try {
    const result = await scheduleTrainingReminderTest({ t })
    note.value = result.ok
      ? `Test-Mitteilung geplant für ${new Date(result.at).toLocaleTimeString()}. App schließen oder iPhone sperren.` // i18n-ignore (Admin)
      : `Nicht geplant: ${result.reason}` // i18n-ignore (Admin)
  } finally {
    testing.value = false
  }
}

async function copy() {
  try {
    await navigator.clipboard.writeText(text.value)
    note.value = 'Kopiert.'
  } catch {
    note.value = 'Kopieren nicht möglich – Text markieren.' // i18n-ignore (Admin)
  }
}
</script>

<style scoped>
.reminder-admin { display: grid; gap: 10px; }
.reminder-admin-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.reminder-admin-btn {
  min-height: 40px;
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid var(--card-border);
  background: var(--card-soft, transparent);
  color: var(--fg);
  font: inherit;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
}
.reminder-admin-btn.ghost { background: transparent; }
.reminder-admin-note { margin: 0; font-size: 0.8rem; color: var(--muted); }
.reminder-admin-out {
  margin: 0;
  max-height: 320px;
  overflow: auto;
  padding: 10px;
  border-radius: 10px;
  background: var(--bg-panel, #0c0d10);
  font-size: 0.72rem;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
}
</style>
