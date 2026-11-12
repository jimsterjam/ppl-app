<template>
  <!-- Trainings-Erinnerung (Absprache Jimmy 11.11.): einmalige Frage nach dem ersten Training. Die gewählte Zahl wird
       das Wochenziel; danach fragt iOS nach der Erlaubnis für Mitteilungen (nur, wenn es noch nie gefragt hat). -->
  <section v-if="visible" class="reminder-ask" aria-labelledby="reminder-ask-title">
    <button type="button" class="reminder-ask-hide" :aria-label="t('trainingReminder.askHide')" @click="decline">✕</button>
    <h3 id="reminder-ask-title" class="reminder-ask-title">{{ t('trainingReminder.askTitle') }}</h3>
    <p class="reminder-ask-text">{{ t('trainingReminder.askText') }}</p>
    <div class="reminder-ask-stepper">
      <button type="button" class="reminder-ask-step" :aria-label="t('trainingReminder.askDecrease')" :disabled="busy || count <= REMINDER_GOAL_MIN" @click="count -= 1">−</button>
      <p class="reminder-ask-value" role="status" aria-live="polite" :aria-label="t('trainingReminder.askCountAria', { count }, count)">
        <strong>{{ count }}</strong><small>{{ t('trainingReminder.askPerWeek') }}</small>
      </p>
      <button type="button" class="reminder-ask-step" :aria-label="t('trainingReminder.askIncrease')" :disabled="busy || count >= REMINDER_GOAL_MAX" @click="count += 1">+</button>
    </div>
    <button type="button" class="reminder-ask-confirm" :disabled="busy" @click="choose(count)">{{ t('trainingReminder.askConfirm') }}</button>
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
import { REMINDER_GOAL_MIN, REMINDER_GOAL_MAX, clampReminderGoal } from '@/utils/trainingNudge'

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

const clampChoice = clampReminderGoal
const suggested = computed(() => {
  if (settings.hasExplicitWeeklyGoal) return clampChoice(settings.weeklyGoal)
  if (props.planDays > 0) return clampChoice(props.planDays)
  return 3
})

// Zahl mit − und + (1–14), vorausgewählt: Wochenziel, sonst Plan-Tage, sonst 3. Bis zur ersten Änderung folgt sie der Vorauswahl.
const picked = ref(null)
const count = computed({
  get: () => picked.value ?? suggested.value,
  set: (value) => { picked.value = clampChoice(value) }
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

watch(() => props.uid, () => {
  // Anderes Konto: eigene Frage-Antwort lesen und die Zahl des vorigen Kontos verwerfen.
  picked.value = null
  readAsked()
})

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
.reminder-ask-stepper { display: flex; align-items: center; justify-content: center; gap: 22px; }
.reminder-ask-step {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid var(--card-border);
  background: transparent;
  color: var(--fg);
  font: inherit;
  font-size: 1.3rem;
  font-weight: 700;
  cursor: pointer;
}
.reminder-ask-step:disabled { opacity: 0.35; cursor: default; }
.reminder-ask-value { margin: 0; display: grid; justify-items: center; min-width: 72px; }
.reminder-ask-value strong { font-size: 1.8rem; line-height: 1.1; font-variant-numeric: tabular-nums; }
.reminder-ask-value small { color: var(--muted); font-size: 0.72rem; }
.reminder-ask-confirm {
  min-height: 46px;
  border: none;
  border-radius: 999px;
  background: var(--accent);
  color: var(--accent-contrast, #060606);
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}
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
