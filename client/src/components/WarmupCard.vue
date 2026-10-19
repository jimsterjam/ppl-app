<template>
  <!-- Warm-up am Anfang jedes laufenden Workouts (Absprache Paul 11.10.): nicht einklappbar, drei Zeilen zum
       Abhaken. Cardio und Gelenke haben einen Timer (läuft nach "Start", hakt den Schritt am Ende selbst ab),
       der dritte Schritt ist eine einfache Körpergewichts-Übung. Überspringen = nicht abhaken. -->
  <section class="warmup-card" :aria-label="t('warmup.title')">
    <!-- Standardmäßig offen, per Tipp auf die Überschrift zuklappbar (Absprache Paul 23.10.). Läuft ein Timer, bleibt
         die Restzeit auch zugeklappt sichtbar. -->
    <button type="button" class="warmup-head" :aria-expanded="open" @click="open = !open">
      <h3 class="warmup-title">{{ t('warmup.title') }} <span class="warmup-optional">{{ t('warmup.optional') }}</span></h3>
      <span v-if="!open && warmupTimer.isActive" class="warmup-head-time">{{ formatRest(warmupTimer.remainingMs) }}</span>
      <span class="warmup-chevron" :class="{ open }" aria-hidden="true"></span>
    </button>
    <template v-if="open">
    <p class="warmup-optional-hint">{{ t('warmup.optionalHint') }}</p>
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
            <button type="button" class="warmup-adjust" :aria-label="t('warmup.minusAria')" :disabled="!canAdjust(row.step, -WARMUP_ADJUST_SECONDS)" @click="warmupTimer.adjust(row.step, -WARMUP_ADJUST_SECONDS)">{{ t('restTimer.minusLabel') }}</button>
            <button type="button" class="warmup-adjust" :aria-label="t('warmup.plusAria')" :disabled="!canAdjust(row.step, WARMUP_ADJUST_SECONDS)" @click="warmupTimer.adjust(row.step, WARMUP_ADJUST_SECONDS)">{{ t('restTimer.plusLabel') }}</button>
            <button v-if="ownTimer(row.step) && warmupTimer.isActive" type="button" class="warmup-adjust" :aria-label="t('warmup.expandAria')" @click="overlayOpen = true">⤢</button>
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
    </template>

    <!-- Große Anzeige wie beim Pausentimer (Absprache Paul 24.10.): öffnet beim Start eines Timer-Schritts, zeigt danach den
         nächsten Schritt (Cardio/Gelenke mit einstellbarer Zeit, Standard 2 Min. für Gelenke; gemerkt) bzw. die Empfehlung für
         die einfache Übung. "Verkleinern" bringt zurück zur Karte. -->
    <Teleport to="body">
      <div v-if="overlayOpen" class="wu-overlay" role="dialog" aria-modal="true" :aria-label="t('warmup.overlayAria')">
        <div class="wu-inner">
          <p class="wu-label">{{ t('warmup.title') }}</p>

          <template v-if="overlayMode === 'timer' || overlayMode === 'timedNext'">
            <h2 class="wu-step">{{ overlayRow.title }}</h2>
            <div class="wu-ring" role="timer" aria-live="off">
              <svg viewBox="0 0 100 100" aria-hidden="true">
                <circle class="wu-ring-track" cx="50" cy="50" r="46" />
                <circle class="wu-ring-progress" cx="50" cy="50" r="46" :stroke-dasharray="RING_LENGTH" :stroke-dashoffset="ringOffset" />
              </svg>
              <span class="wu-time">{{ formatRest(timeShown(overlayStep)) }}</span>
            </div>
            <p class="wu-hint">{{ overlayRow.hint }}</p>
            <div class="wu-actions">
              <button type="button" class="wu-btn" :aria-label="t('warmup.minusAria')" :disabled="!canAdjust(overlayStep, -WARMUP_ADJUST_SECONDS)" @click="warmupTimer.adjust(overlayStep, -WARMUP_ADJUST_SECONDS)">{{ t('restTimer.minusLabel') }}</button>
              <button type="button" class="wu-btn" :aria-label="t('warmup.plusAria')" :disabled="!canAdjust(overlayStep, WARMUP_ADJUST_SECONDS)" @click="warmupTimer.adjust(overlayStep, WARMUP_ADJUST_SECONDS)">{{ t('restTimer.plusLabel') }}</button>
            </div>
            <template v-if="overlayMode === 'timer'">
              <button v-if="timerRunning(overlayStep)" type="button" class="wu-btn" @click="warmupTimer.pause()">{{ t('warmup.pause') }}</button>
              <button v-else type="button" class="wu-btn wu-primary" @click="warmupTimer.resume()">{{ t('warmup.resume') }}</button>
              <button type="button" class="wu-link" @click="finishNow(overlayStep)">{{ t('warmup.finishNow') }}</button>
            </template>
            <template v-else>
              <button type="button" class="wu-btn wu-primary" @click="startTimer(overlayStep)">{{ t('warmup.start') }}</button>
              <button type="button" class="wu-link" @click="skipStep(overlayStep)">{{ t('warmup.skip') }}</button>
            </template>
          </template>

          <template v-else-if="overlayMode === 'specific'">
            <p class="wu-kicker">{{ t('warmup.recommendation') }}</p>
            <h2 class="wu-step">{{ overlayRow.title }}</h2>
            <p class="wu-hint">{{ overlayRow.hint }}</p>
            <button v-if="specific" type="button" class="wu-btn" @click="$emit('open-media', specific.entry)">{{ t('warmup.watchVideo') }}</button>
            <button type="button" class="wu-btn wu-primary" @click="finishNow('specific')">{{ t('warmup.doneStep') }}</button>
            <button type="button" class="wu-link" @click="skipStep('specific')">{{ t('warmup.skip') }}</button>
          </template>

          <template v-else>
            <h2 class="wu-step">{{ t('warmup.allDoneTitle') }}</h2>
            <p class="wu-hint">{{ t('warmup.allDoneText') }}</p>
            <button type="button" class="wu-btn wu-primary" @click="closeOverlay(true)">{{ t('warmup.toWorkout') }}</button>
          </template>

          <button v-if="overlayMode !== 'done'" type="button" class="wu-link wu-minimize" @click="closeOverlay(false)">{{ t('restTimer.minimize') }}</button>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import NotificationHint from '@/components/NotificationHint.vue'
import { ensureNotificationPermission } from '@/utils/notificationPermission'
import { useWarmupTimerStore } from '@/stores/warmupTimerStore'
import { useSessionStopwatchStore } from '@/stores/sessionStopwatch'
import { formatRest } from '@/utils/restTimerRules'
import { useScrollLock } from '@/composables/useScrollLock'
import {
  WARMUP_ADJUST_SECONDS, WARMUP_MAX_SECONDS, WARMUP_MIN_SECONDS, WARMUP_STEPS, WARMUP_TIMER_SECONDS,
  currentWarmupStep, emptyWarmup, jointsTypeFor, nextWarmupStep, sanitizeWarmup
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
const emit = defineEmits(['update:warmup', 'open-media', 'start-training'])

const { t } = useI18n()
const warmupTimer = useWarmupTimerStore()
const sessionStopwatch = useSessionStopwatchStore()
const banner = ref('')
const open = ref(true)
// Große Anzeige (Overlay) und Schritte, die im Overlay übersprungen wurden (nicht abgehakt).
const overlayOpen = ref(false)
const skipped = ref([])
const RING_LENGTH = 2 * Math.PI * 46

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

// Die Zeit ist nur eine Empfehlung: "Empfehlung: 5 Min. · Rad, Crosstrainer, ..."
function recommendedHint(step, hint) {
  return t('warmup.recommendedHint', { minutes: Math.round(WARMUP_TIMER_SECONDS[step] / 60), hint })
}

const rows = computed(() => WARMUP_STEPS.map((step) => {
  const timed = !!WARMUP_TIMER_SECONDS[step]
  let title
  let hint
  if (step === 'cardio') {
    title = t('warmup.cardioTitle')
    hint = recommendedHint(step, t('warmup.cardioHint'))
  } else if (step === 'joints') {
    title = t('warmup.jointsTitle')
    hint = recommendedHint(step, t(`warmup.jointsHint_${jointsTypeFor(props.workoutType)}`))
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
const timeShown = (step) => (ownTimer(step) && warmupTimer.isActive ? warmupTimer.remainingMs : warmupTimer.secondsFor(step) * 1000)
const totalSeconds = (step) => (ownTimer(step) && warmupTimer.isActive ? warmupTimer.durationSec : warmupTimer.secondsFor(step))
function canAdjust(step, delta) {
  const next = totalSeconds(step) + delta
  return next >= WARMUP_MIN_SECONDS && next <= WARMUP_MAX_SECONDS
}
const progressPercent = (step) => {
  const total = (totalSeconds(step) || 1) * 1000
  return Math.min(100, Math.max(0, Math.round((1 - timeShown(step) / total) * 100)))
}

async function startTimer(step) {
  banner.value = ''
  // Beim ersten Start zuerst die Mitteilungs-Erlaubnis erfragen (iOS fragt nur einmal; ohne Frage fehlt die App
  // später unter Einstellungen > Mitteilungen). Wirft nie.
  await ensureNotificationPermission()
  skipped.value = skipped.value.filter((s) => s !== step)
  overlayOpen.value = true
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

// --- Große Anzeige ---------------------------------------------------------------------------------
const overlayStep = computed(() => {
  if (warmupTimer.isActive && ownTimer(warmupTimer.step)) return warmupTimer.step
  return WARMUP_STEPS.find((s) => !state.value[s] && !skipped.value.includes(s)) || null
})
const overlayMode = computed(() => {
  if (warmupTimer.isActive && ownTimer(warmupTimer.step)) return 'timer'
  const s = overlayStep.value
  if (!s) return 'done'
  return WARMUP_TIMER_SECONDS[s] ? 'timedNext' : 'specific'
})
const overlayRow = computed(() => rows.value.find((r) => r.step === overlayStep.value) || { title: '', hint: '' })
const ringOffset = computed(() => {
  const s = overlayStep.value
  if (!s || !(ownTimer(s) && warmupTimer.isActive)) return 0
  const total = (totalSeconds(s) || 1) * 1000
  return RING_LENGTH * Math.min(1, Math.max(0, timeShown(s) / total))
})

function finishNow(step) {
  // Vorzeitig fertig: wie von Hand abgehakt (laufender Timer endet mit).
  if (ownTimer(step) && warmupTimer.isActive) warmupTimer.cancel()
  setStep(step, true)
}

function skipStep(step) {
  if (!skipped.value.includes(step)) skipped.value = [...skipped.value, step]
}

function closeOverlay(startTraining) {
  overlayOpen.value = false
  if (startTraining) emit('start-training')
}

const { lock, unlock } = useScrollLock()
watch(overlayOpen, (open) => (open ? lock() : unlock()), { immediate: true })
onBeforeUnmount(unlock)

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
  background: var(--card-bg);
  border-radius: var(--card-radius);
  padding: 6px 14px 8px;
  margin: 0 0 12px;
}
.warmup-head {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 0;
  background: transparent;
  border: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.warmup-head .warmup-title { flex: 1; }
.warmup-head-time { font-weight: 800; font-variant-numeric: tabular-nums; color: var(--accent-text, var(--fg)); }
.warmup-chevron {
  flex: 0 0 auto;
  width: 9px;
  height: 9px;
  border-right: 2px solid var(--muted);
  border-bottom: 2px solid var(--muted);
  transform: rotate(45deg);
  transition: transform 0.15s ease;
}
.warmup-chevron.open { transform: rotate(-135deg); }
.warmup-title { margin: 0; padding: 8px 0 2px; font-size: 1rem; }
.warmup-optional { margin-left: 6px; font-size: 0.78rem; font-weight: 600; color: var(--muted); }
.warmup-optional-hint { margin: 0 0 6px; color: var(--muted); font-size: 0.78rem; line-height: 1.35; }
.warmup-adjust {
  min-height: 0;
  min-width: 44px;
  padding: 6px 8px;
  border-radius: 999px;
  border: 1px solid var(--line-strong);
  background: transparent;
  color: var(--fg);
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
}
.warmup-adjust { white-space: nowrap; }
.warmup-adjust:disabled { opacity: 0.4; cursor: default; }
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
.warmup-timer { padding: 6px 0 0; }
.warmup-timer-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 10px; }
.warmup-time { font-family: var(--font-heading, inherit); font-size: 1.8rem; font-weight: 700; letter-spacing: 1px; font-variant-numeric: tabular-nums; }
.warmup-time.paused { color: var(--muted); }
.warmup-btn {
  min-height: 0;
  padding: 10px 18px;
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

/* --- Große Anzeige (wie der Pausentimer) ----------------------------------------------------------- */
.wu-overlay {
  position: fixed;
  inset: 0;
  z-index: 1290;
  display: flex;
  align-items: safe center;
  justify-content: center;
  overflow-y: auto;
  padding: calc(env(safe-area-inset-top, 0px) + 16px) 20px calc(env(safe-area-inset-bottom, 0px) + 16px);
  background: var(--bg, #08090b);
  color: var(--fg);
}
.wu-inner { width: 100%; max-width: 420px; display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; }
.wu-label { margin: 0; font-size: 1.3rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
.wu-kicker { margin: 0; color: var(--accent-text, var(--fg)); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
.wu-step { margin: 0; font-size: 1.6rem; line-height: 1.2; }
.wu-hint { margin: 0; color: var(--muted); font-size: 1.02rem; line-height: 1.4; }
.wu-ring { position: relative; width: min(66vw, 280px); aspect-ratio: 1; display: flex; align-items: center; justify-content: center; }
.wu-ring svg { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); }
.wu-ring-track { fill: none; stroke: var(--card-border, rgba(255, 255, 255, 0.12)); stroke-width: 4; }
.wu-ring-progress { fill: none; stroke: var(--accent); stroke-width: 4; stroke-linecap: round; transition: stroke-dashoffset 0.25s linear; }
.wu-time { position: relative; font-size: clamp(64px, 22vw, 100px); font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; color: var(--accent-text, var(--fg)); }
.wu-actions { display: flex; gap: 12px; width: 100%; }
.wu-actions .wu-btn { flex: 1; }
.wu-btn {
  min-width: 0;
  min-height: 58px;
  width: 100%;
  padding: 0 16px;
  border-radius: 16px;
  border: 1px solid var(--card-border);
  background: var(--surface);
  color: var(--fg);
  font: inherit;
  font-size: 1.25rem;
  font-weight: 700;
  cursor: pointer;
}
.wu-btn:disabled { opacity: 0.4; }
.wu-primary { border-color: transparent; background: linear-gradient(120deg, var(--accent), var(--accent-strong)); color: var(--accent-contrast, #060606); }
.wu-link { min-width: 0; min-height: 44px; padding: 0 12px; border: none; background: transparent; color: var(--accent-text, var(--fg)); font: inherit; font-size: 1rem; font-weight: 600; cursor: pointer; }
.wu-minimize { color: var(--muted); }
</style>
