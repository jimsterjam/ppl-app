<template>
  <!-- Warm-up am Anfang jedes laufenden Workouts (Absprache Paul 11.10.): nicht einklappbar, drei Zeilen zum
       Abhaken. Cardio und Gelenke haben einen Timer (läuft nach "Start", hakt den Schritt am Ende selbst ab),
       der dritte Schritt ist eine einfache Körpergewichts-Übung. Überspringen = nicht abhaken. -->
  <section class="warmup-card" :aria-label="t('warmup.title')">
    <h3 class="warmup-title">{{ t('warmup.title') }}</h3>
    <NotificationHint />
    <p v-if="banner" class="warmup-banner" role="status">{{ banner }}</p>

    <ul class="warmup-list">
      <li v-for="row in rows" :key="row.step" class="warmup-row" :class="{ done: row.done, open: row.open }">
        <div class="warmup-line">
          <button
            type="button"
            class="warmup-check"
            :class="{ checked: row.done }"
            role="checkbox"
            :aria-checked="row.done"
            :aria-label="t('warmup.checkAria', { step: row.title })"
            @click="toggle(row.step)"
          >{{ row.done ? '✓' : '' }}</button>
          <div class="warmup-text">
            <strong>{{ row.title }}</strong>
            <span>{{ row.hint }}</span>
          </div>
          <button
            v-if="row.step === 'specific' && specific"
            type="button"
            class="warmup-video"
            :aria-label="t('warmup.videoAria', { name: specific.name })"
            @click="$emit('open-media', specific.entry)"
          >▶</button>
        </div>

        <div v-if="row.open && row.timed" class="warmup-timer">
          <div class="warmup-timer-row">
            <span class="warmup-time" :class="{ paused: timerPaused(row.step) }">{{ formatRest(timeShown(row.step)) }}</span>
            <button v-if="timerRunning(row.step)" type="button" class="warmup-btn ghost" @click="warmupTimer.pause()">{{ t('warmup.pause') }}</button>
            <button v-else-if="timerPaused(row.step)" type="button" class="warmup-btn" @click="warmupTimer.resume()">{{ t('warmup.resume') }}</button>
            <button v-else type="button" class="warmup-btn" @click="startTimer(row.step)">{{ t('warmup.start') }}</button>
          </div>
          <div v-if="timerRunning(row.step) || timerPaused(row.step)" class="warmup-progress" aria-hidden="true">
            <i :style="{ width: `${progressPercent(row.step)}%` }"></i>
          </div>
          <small v-if="timerRunning(row.step)" class="warmup-note">{{ t('warmup.autoCheck') }}</small>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import NotificationHint from '@/components/NotificationHint.vue'
import { ensureNotificationPermission } from '@/utils/notificationPermission'
import { useWarmupTimerStore } from '@/stores/warmupTimerStore'
import { useSessionStopwatchStore } from '@/stores/sessionStopwatch'
import { formatRest } from '@/utils/restTimerRules'
import {
  WARMUP_STEPS, WARMUP_TIMER_SECONDS, currentWarmupStep, emptyWarmup, jointsTypeFor, nextWarmupStep, sanitizeWarmup
} from '@/utils/warmupPlan'

const props = defineProps({
  // { cardio, joints, specific } (Booleans) oder null
  warmup: { type: Object, default: null },
  // push | pull | legs | fullbody
  workoutType: { type: String, default: 'fullbody' },
  // Schlüssel des Workouts, an den ein laufender Timer gebunden ist
  workoutKey: { type: String, required: true },
  // Anzeigename der ersten Hauptübung (englisch wie überall) oder ''
  firstExerciseName: { type: String, default: '' },
  // Einfache Übung zur ersten Hauptübung: { name, entry } mit Katalogeintrag für Bild/Video, oder null
  specific: { type: Object, default: null }
})
const emit = defineEmits(['update:warmup', 'open-media'])

const { t } = useI18n()
const warmupTimer = useWarmupTimerStore()
const sessionStopwatch = useSessionStopwatchStore()
const banner = ref('')

const state = computed(() => sanitizeWarmup(props.warmup) || emptyWarmup())
const current = computed(() => currentWarmupStep(state.value))

const labels = computed(() => ({
  cardio: { short: t('warmup.cardioShort'), done: t('warmup.cardioDone') },
  joints: { short: t('warmup.jointsShort'), done: t('warmup.jointsDone') },
  specific: {
    short: props.specific ? props.specific.name : t('warmup.specificFallbackShort'),
    done: t('warmup.specificDone')
  }
}))

const rows = computed(() => WARMUP_STEPS.map((step) => {
  const timed = !!WARMUP_TIMER_SECONDS[step]
  let title
  let hint
  if (step === 'cardio') {
    title = t('warmup.cardioTitle')
    hint = t('warmup.cardioHint')
  } else if (step === 'joints') {
    title = t('warmup.jointsTitle')
    hint = t(`warmup.jointsHint_${jointsTypeFor(props.workoutType)}`)
  } else if (props.specific) {
    title = t('warmup.specificTitle', { name: props.specific.name })
    hint = props.firstExerciseName ? t('warmup.specificHint', { exercise: props.firstExerciseName }) : t('warmup.specificHintShort')
  } else {
    title = t('warmup.specificFallbackTitle')
    hint = props.firstExerciseName ? t('warmup.specificFallbackHint', { exercise: props.firstExerciseName }) : t('warmup.specificFallbackHintShort')
  }
  const done = state.value[step]
  return { step, title, hint, timed, done, open: !done && current.value === step }
}))

// --- Timer -----------------------------------------------------------------------------------------
const ownTimer = (step) => warmupTimer.step === step && warmupTimer.workoutKey === props.workoutKey
const timerRunning = (step) => ownTimer(step) && warmupTimer.isRunning
const timerPaused = (step) => ownTimer(step) && warmupTimer.isPaused
const timeShown = (step) => (ownTimer(step) && warmupTimer.isActive ? warmupTimer.remainingMs : WARMUP_TIMER_SECONDS[step] * 1000)
const progressPercent = (step) => {
  const total = (WARMUP_TIMER_SECONDS[step] || 1) * 1000
  return Math.min(100, Math.max(0, Math.round((1 - timeShown(step) / total) * 100)))
}

async function startTimer(step) {
  banner.value = ''
  // Beim ersten Start zuerst die Mitteilungs-Erlaubnis erfragen (iOS fragt nur einmal; ohne Frage fehlt die App
  // später unter Einstellungen > Mitteilungen). Wirft nie.
  await ensureNotificationPermission()
  // Mit dem Warm-up beginnt das Training: Gesamttimer (Gym-Zeit) mitstarten, falls er noch nicht benutzt wurde.
  sessionStopwatch.startIfIdle()
  const next = nextWarmupStep(state.value, step)
  warmupTimer.start({
    step,
    workoutKey: props.workoutKey,
    notifyTitle: labels.value[step].done,
    notifyBody: next ? t('warmup.notifyNext', { next: labels.value[next].short }) : t('warmup.notifyAll')
  })
}

// --- Abhaken ---------------------------------------------------------------------------------------
function setStep(step, value) {
  emit('update:warmup', { ...state.value, [step]: value })
}

function toggle(step) {
  banner.value = ''
  const nowDone = !state.value[step]
  // Von Hand abgehakt: ein laufender Timer dieses Schritts wird überflüssig.
  if (nowDone && ownTimer(step) && warmupTimer.isActive) warmupTimer.cancel()
  setStep(step, nowDone)
}

// Timer fertig (auch wenn der Nutzer zwischendurch woanders war): Schritt abhaken, auf den nächsten hinweisen.
function applyFinished() {
  const steps = warmupTimer.consumeFinished(props.workoutKey)
  if (!steps.length) return
  const next = { ...state.value }
  for (const step of steps) next[step] = true
  emit('update:warmup', next)
  const last = steps[steps.length - 1]
  const following = nextWarmupStep(next, last)
  banner.value = following
    ? t('warmup.banner', { done: labels.value[last].done, next: labels.value[following].short })
    : t('warmup.bannerAll', { done: labels.value[last].done })
}

watch(() => warmupTimer.finished.length, applyFinished)
onMounted(() => {
  warmupTimer.restore()
  applyFinished()
})
</script>

<style scoped>
.warmup-card {
  border: 1.5px solid color-mix(in srgb, var(--accent) 55%, transparent);
  background: var(--bg-panel);
  border-radius: 18px;
  padding: 6px 14px 8px;
  margin: 0 0 12px;
}
.warmup-title { margin: 0; padding: 8px 0 4px; font-size: 1rem; }
.warmup-banner {
  margin: 6px 0 4px;
  padding: 9px 12px;
  border-radius: 12px;
  background: var(--accent);
  color: var(--accent-contrast, #060606);
  font-size: 0.82rem;
  font-weight: 700;
}
.warmup-list { list-style: none; margin: 0; padding: 0; }
.warmup-row { border-top: 1px solid var(--line-soft, rgba(255, 255, 255, 0.1)); padding: 10px 0; }
.warmup-row:first-child { border-top: 0; }
.warmup-row.open { background: var(--accent-soft); margin: 0 -14px; padding: 12px 14px; border-radius: 12px; border-top: 0; }
.warmup-line { display: flex; align-items: center; gap: 12px; }
.warmup-check {
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  min-width: 28px;
  min-height: 0;
  padding: 0;
  box-sizing: border-box;
  border-radius: 9px;
  border: 2px solid var(--line-strong);
  background: transparent;
  color: var(--accent-contrast, #060606);
  font-size: 0.95rem;
  font-weight: 800;
  cursor: pointer;
}
.warmup-check.checked { background: var(--accent); border-color: var(--accent); }
.warmup-text { flex: 1; min-width: 0; display: grid; gap: 2px; }
.warmup-text strong { font-size: 0.88rem; }
.warmup-text span { color: var(--muted); font-size: 0.76rem; line-height: 1.35; }
.warmup-row.done .warmup-text strong { text-decoration: line-through; color: var(--muted); }
.warmup-row.done .warmup-text span { color: var(--muted); }
.warmup-video {
  flex: 0 0 40px;
  width: 40px;
  height: 40px;
  min-width: 40px;
  min-height: 0;
  padding: 0;
  box-sizing: border-box;
  border-radius: 10px;
  border: 1px solid var(--line-soft, rgba(255, 255, 255, 0.1));
  background: var(--card-soft);
  color: var(--accent-text);
  font-size: 0.8rem;
  cursor: pointer;
}
.warmup-timer { padding: 6px 0 0 40px; }
.warmup-timer-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.warmup-time { font-family: var(--font-heading, inherit); font-size: 2.1rem; font-weight: 700; letter-spacing: 1px; font-variant-numeric: tabular-nums; }
.warmup-time.paused { color: var(--muted); }
.warmup-btn {
  min-height: 0;
  padding: 10px 24px;
  border-radius: 999px;
  border: 0;
  background: var(--accent);
  color: var(--accent-contrast, #060606);
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
}
.warmup-btn.ghost { background: transparent; color: var(--fg); border: 1px solid var(--line-strong); padding: 8px 16px; font-size: 0.82rem; }
.warmup-progress { height: 6px; border-radius: 99px; background: var(--card-soft); margin-top: 8px; overflow: hidden; }
.warmup-progress i { display: block; height: 100%; background: var(--accent-text); border-radius: 99px; }
.warmup-note { display: block; margin-top: 6px; color: var(--muted); font-size: 0.74rem; }
</style>
