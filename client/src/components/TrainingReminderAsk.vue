<template>
  <!-- Trainings-Erinnerung (Absprache Paul 11.11.): einmalige Frage nach dem ersten Training. Die gewählte Zahl wird
       das Wochenziel; danach fragt iOS nach der Erlaubnis für Mitteilungen (nur, wenn es noch nie gefragt hat). -->
  <section v-if="visible" class="reminder-ask" aria-labelledby="reminder-ask-title">
    <button type="button" class="reminder-ask-hide" :aria-label="t('trainingReminder.askHide')" @click="decline">✕</button>
    <h3 id="reminder-ask-title" class="reminder-ask-title">{{ t('trainingReminder.askTitle') }}</h3>
    <p class="reminder-ask-text">{{ t('trainingReminder.askText') }}</p>
    <div class="reminder-ask-choices" role="group" :aria-label="t('trainingReminder.askChoices')">
      <button
        v-for="count in REMINDER_GOAL_CHOICES"
        :key="count"
        type="button"
        class="reminder-ask-choice"
        :class="{ 'is-suggested': count === suggested }"
        :aria-label="t('trainingReminder.askChoiceAria', { count })"
        :disabled="busy"
        @click="choose(count)"
      >{{ count }}×</button>
    </div>
    <button type="button" class="reminder-ask-no" :disabled="busy" @click="decline">{{ t('trainingReminder.askNo') }}</button>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settingsStore'
import { useToastStore } from '@/stores/toastStore'
import { getNotificationPermission, ensureNotificationPermission } from '@/utils/notificationPermission'
import { wasReminderAsked, markReminderAsked } from '@/utils/trainingReminder'
import { REMINDER_GOAL_CHOICES } from '@/utils/trainingNudge'

const props = defineProps({
  /** Mindestens ein abgeschlossenes Training vorhanden (Workouts geladen). */
  hasTrained: { type: Boolean, default: false },
  /** Start-Ablauf, Entwurf o. Ä. offen: dann nicht zeigen. */
  blocked: { type: Boolean, default: false },
  /** Tage des aktiven Plans (0 = kein Plan) – Vorauswahl. */
  planDays: { type: Number, default: 0 },
  /** Konto, damit die Frage nach einem Kontowechsel neu gelesen wird. */
  uid: { type: String, default: '' }
})

const { t } = useI18n()
const settings = useSettingsStore()
const toast = useToastStore()
const asked = ref(true)
const supported = ref(false)
const busy = ref(false)

const clampChoice = (n) => Math.min(5, Math.max(2, Math.round(n)))
const suggested = computed(() => {
  if (settings.hasExplicitWeeklyGoal) return clampChoice(settings.weeklyGoal)
  if (props.planDays > 0) return clampChoice(props.planDays)
  return 3
})

const visible = computed(() => supported.value && props.hasTrained && !props.blocked && !asked.value && !settings.trainingReminderEnabled)

function readAsked() {
  asked.value = wasReminderAsked()
}

async function choose(count) {
  if (busy.value) return
  busy.value = true
  try {
    settings.setWeeklyGoal(count)
    markReminderAsked()
    asked.value = true
    const permission = await ensureNotificationPermission()
    settings.setTrainingReminderEnabled(true)
    if (permission === 'granted') toast.show(t('trainingReminder.enabledToast'), { type: 'success', duration: 4000 })
    else toast.show(t('trainingReminder.deniedToast'), { type: 'error', duration: 6000 })
  } finally {
    busy.value = false
  }
}

function decline() {
  markReminderAsked()
  asked.value = true
}

watch(() => props.uid, readAsked)

onMounted(async () => {
  readAsked()
  // Ohne iOS (Web, Tests) gibt es keine Mitteilungen – dann gar nicht fragen.
  supported.value = (await getNotificationPermission()) !== 'unsupported'
})
</script>

<style scoped>
.reminder-ask {
  position: relative;
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 14px 16px;
  border-radius: var(--card-radius);
  border: 1.5px solid color-mix(in srgb, var(--accent) 55%, transparent);
  background: var(--card-bg);
}
.reminder-ask-title {
  margin: 0;
  padding-right: 28px;
  font-family: "Sora", "Space Grotesk", "SF Pro Display", sans-serif;
  font-size: 1.02rem;
  line-height: 1.3;
}
.reminder-ask-text { margin: 0; color: var(--muted); font-size: 0.82rem; line-height: 1.45; }
.reminder-ask-choices { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.reminder-ask-choice {
  min-height: 44px;
  border-radius: 12px;
  border: 1px solid var(--card-border);
  background: transparent;
  color: var(--fg);
  font: inherit;
  font-weight: 800;
  font-size: 1rem;
  cursor: pointer;
}
.reminder-ask-choice.is-suggested { background: var(--accent); border-color: var(--accent); color: var(--accent-contrast, #060606); }
.reminder-ask-no {
  justify-self: center;
  min-height: 36px;
  border: none;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 0.82rem;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}
.reminder-ask-hide {
  position: absolute;
  top: 4px;
  right: 4px;
  min-width: 36px;
  min-height: 36px;
  border: none;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}
</style>
