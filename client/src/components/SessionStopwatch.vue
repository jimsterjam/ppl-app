<template>
  <div class="session-stopwatch" :class="{ 'session-stopwatch--compact': props.compact }" ref="rootRef">
    <!-- Dashboard-Variante (Wunsch Paul: Stoppuhr war "zu klein und armselig"): eigene Karte mit
         großer Zeitanzeige und Bedienung direkt auf der Karte, ohne Popup. Die kompakte
         Header-Variante (WorkoutDetailView) behält Trigger + Popup, dort fehlt der Platz. -->
    <section
      v-if="!props.compact"
      class="sw-card"
      :class="{ 'sw-card--running': isRunning, 'sw-card--paused': isPaused }"
    >
      <div class="sw-card-info">
        <p class="sw-card-label">
          <span v-if="isRunning" class="sw-card-dot" aria-hidden="true"></span>
          <span v-else class="sw-card-icon" aria-hidden="true">{{ isPaused ? '⏸' : '⏱' }}</span>
          {{ isPaused ? t('sessionStopwatch.paused') : t('sessionStopwatch.cardTitle') }}
        </p>
        <p class="sw-card-time">{{ cardTime }}</p>
        <p v-if="isRunning" class="sw-card-hint">{{ t('sessionStopwatch.runningSince', { time: startedAtLabel }) }}</p>
        <button
          v-else-if="isPaused && !resetConfirmOpen"
          type="button"
          class="sw-card-reset-link"
          @click="resetConfirmOpen = true"
        >↺ {{ t('sessionStopwatch.reset') }}</button>
        <p v-else-if="!isPaused" class="sw-card-hint">{{ t('sessionStopwatch.hintIdle') }}</p>
      </div>

      <!-- Zurücksetzen nur im Pause-Zustand und nur nach Rückfrage direkt auf der Karte - vorher
           setzte ein einziger Tipp auf "Reset" die Zeit sofort zurück. -->
      <div v-if="resetConfirmOpen" class="sw-card-confirm">
        <span class="sw-card-confirm-text">{{ t('sessionStopwatch.resetConfirm') }}</span>
        <div class="sw-card-confirm-actions">
          <button type="button" class="sw-card-confirm-btn" @click="resetConfirmOpen = false">{{ t('common.cancel') }}</button>
          <button type="button" class="sw-card-confirm-btn sw-card-confirm-btn--danger" @click="confirmReset">{{ t('sessionStopwatch.reset') }}</button>
        </div>
      </div>
      <button
        v-else
        type="button"
        class="sw-card-main-btn"
        :class="{ 'sw-card-main-btn--pause': isRunning }"
        :aria-label="mainButtonLabel"
        @click="onMainButton"
      >
        <svg v-if="isRunning" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>
        <svg v-else viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor"/></svg>
      </button>
    </section>

    <!-- Trigger Button (kompakte Header-Variante) -->
    <button
      v-if="props.compact"
      class="sw-trigger"
      :class="{
        'sw-trigger--running': isRunning,
        'sw-trigger--paused': !isRunning && elapsedMs > 0
      }"
      type="button"
      @click="toggleOverlay"
    >
      <span v-if="!isRunning && elapsedMs === 0">⏱ 00:00</span>
      <span v-else>{{ formattedTime }}</span>
    </button>

    <!-- Overlay (User-Report): hing bisher als kleines Dropdown direkt unter dem Trigger-Button
         (position:absolute), statt wie andere Popups in der App zentriert aufzupoppen. Jetzt
         zentriertes Modal (Teleport + Overlay), analog zu AvatarEditor.vue/AppModal.vue.
         Schließen (Klick daneben, Close-Button) stoppt/resettet den Timer NICHT - closeOverlay()
         setzt nur overlayOpen=false, der Store läuft unverändert im Hintergrund weiter. -->
    <Teleport to="body">
    <Transition name="modal" appear>
      <div v-if="overlayOpen" ref="overlayRef" class="sw-overlay" @click.self="closeOverlay">
        <div class="sw-panel">
          <div class="sw-time" :class="{ 'sw-time--running': isRunning, 'sw-time--paused': !isRunning && elapsedMs > 0 }">
            {{ elapsedMs === 0 ? '00:00' : formattedTime }}
          </div>

          <div class="sw-controls">
            <!-- Nicht gestartet -->
            <button v-if="!startedAt" class="sw-btn sw-btn--primary" type="button" @click="start">
              ▶ {{ t('sessionStopwatch.start') }}
            </button>

            <!-- Läuft -->
            <template v-else-if="isRunning">
              <button class="sw-btn sw-btn--secondary" type="button" @click="stop">
                ⏸ {{ t('sessionStopwatch.pause') }}
              </button>
              <button class="sw-btn sw-btn--ghost" type="button" @click="handleReset">
                ↺ {{ t('sessionStopwatch.reset') }}
              </button>
            </template>

            <!-- Pausiert -->
            <template v-else>
              <button class="sw-btn sw-btn--primary" type="button" @click="resume">
                ▶ {{ t('sessionStopwatch.resume') }}
              </button>
              <button class="sw-btn sw-btn--ghost" type="button" @click="handleReset">
                ↺ {{ t('sessionStopwatch.reset') }}
              </button>
            </template>
          </div>

          <button class="sw-close" type="button" @click="closeOverlay" :aria-label="t('sessionStopwatch.close')">×</button>
        </div>
      </div>
    </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSessionStopwatch } from '@/composables/useSessionStopwatch'
import { releaseKeepAwake } from '@/utils/keepAwakeGuard'
import { useScrollLock } from '@/composables/useScrollLock'

// User-Report: alle Texte in der App sollen DE+EN verfügbar sein - diese Komponente war bisher
// komplett hartcodiert Deutsch (Stoppuhr/Start/Pause/Weiter/Reset/Schließen), siehe neuer
// Namespace sessionStopwatch.* in i18n/index.js.
const { t } = useI18n()

// compact: schlanke Darstellung für die Platzierung im sticky Header (siehe WorkoutDetailView.vue -
// dort soll die Gesamtzeit immer im Sichtfeld bleiben, statt beim Scrollen durch die Übungsliste
// zu verschwinden). Im Standard-Kontext (volle Breite in der Übungsliste) bleibt das Verhalten
// unverändert.
const props = defineProps({
  compact: { type: Boolean, default: false }
})

const emit = defineEmits(['session-time'])

const {
  startedAt,
  isRunning,
  elapsedMs,
  formattedTime,
  start,
  stop,
  resume,
  reset
} = useSessionStopwatch()

const overlayOpen = ref(false)
const rootRef = ref(null)
// Bug-Fix (durch Teleport nötig geworden): das Overlay hängt jetzt an document.body statt im
// rootRef-Teilbaum. Der reine rootRef.contains()-Check unten würde dadurch jeden Klick INNERHALB
// des teleportierten Panels fälschlich als "außerhalb" werten und das Overlay sofort wieder
// schließen. Zusätzlicher Ref auf das teleportierte Overlay-Element, der beim Containment-Check
// mitberücksichtigt wird.
const overlayRef = ref(null)

// Hintergrund-Scroll sperren, solange das Overlay als zentriertes Modal offen ist.
const { lock: lockBodyScroll, unlock: unlockBodyScroll } = useScrollLock()
watch(overlayOpen, (open) => (open ? lockBodyScroll() : unlockBodyScroll()))

function toggleOverlay() {
  overlayOpen.value = !overlayOpen.value
}

function closeOverlay() {
  overlayOpen.value = false
  if (elapsedMs.value > 0) {
    emit('session-time', {
      totalMs: elapsedMs.value,
      formattedTime: formattedTime.value
    })
  }
}

function handleReset() {
  reset()
}

// --- Dashboard-Karte -------------------------------------------------------
const { locale } = useI18n()
const isPaused = computed(() => !isRunning.value && elapsedMs.value > 0)
const resetConfirmOpen = ref(false)

// Ab einer Stunde h:mm:ss statt mm:ss (Store-Format bleibt unverändert, da die Header-Variante
// und die Workout-Dauer es nutzen).
const cardTime = computed(() => {
  const totalSeconds = Math.floor(elapsedMs.value / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
})

const startedAtLabel = computed(() => {
  if (!startedAt.value) return ''
  try {
    return new Date(startedAt.value).toLocaleTimeString(locale.value === 'de' ? 'de-DE' : 'en-US', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
})

const mainButtonLabel = computed(() => {
  if (isRunning.value) return t('sessionStopwatch.pause')
  return isPaused.value ? t('sessionStopwatch.resume') : t('sessionStopwatch.start')
})

function onMainButton() {
  if (isRunning.value) {
    stop()
    emit('session-time', { totalMs: elapsedMs.value, formattedTime: formattedTime.value })
  } else if (isPaused.value) {
    resume()
  } else {
    start()
  }
}

function confirmReset() {
  reset()
  resetConfirmOpen.value = false
}

// Rückfrage schließen, sobald die Uhr nicht mehr pausiert ist (z.B. über die Header-Variante
// in einem anderen View weitergestartet).
watch(isPaused, (paused) => {
  if (!paused) resetConfirmOpen.value = false
})

function onOutsideClick(e) {
  if (!overlayOpen.value) return
  const insideRoot = rootRef.value && rootRef.value.contains(e.target)
  const insideOverlay = overlayRef.value && overlayRef.value.contains(e.target)
  if (!insideRoot && !insideOverlay) {
    closeOverlay()
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onOutsideClick, { passive: true })
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onOutsideClick)
  // Sicherheitsnetz: falls die Komponente verschwindet (z.B. Workout-Ansicht
  // verlassen) während die Stoppuhr noch lief, darf der Bildschirm wieder
  // einschlafen dürfen - der Store selbst gibt den Tag zwar bei stop()/reset()
  // frei, aber nicht automatisch beim Unmount der Anzeige.
  releaseKeepAwake('session-stopwatch')
  // Sicherheitsnetz analog: Scroll-Lock nicht offen lassen, falls die Komponente bei
  // geöffnetem Overlay verschwindet.
  unlockBodyScroll()
})
</script>

<style scoped>
.session-stopwatch {
  position: relative;
  display: flex;
  width: 100%;
}

/* Dashboard-Karte - Optik wie .hero in DashboardView.vue (Panel-Hintergrund, Rahmen, Rundung),
   die Akzentfarbe markiert nur den laufenden Zustand und den Hauptbutton. */
.session-stopwatch:not(.session-stopwatch--compact) {
  align-items: flex-start;
}

.sw-card {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px 12px 16px;
  border-radius: calc(var(--panel-radius) - 12px);
  border: 1px solid var(--line-strong);
  background: var(--bg-panel);
  box-shadow: var(--shadow-soft);
  transition: border-color 0.2s ease;
}

.sw-card--running {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent), var(--shadow-soft);
}

.sw-card-info {
  flex: 1;
  min-width: 0;
}

.sw-card-label {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}

.sw-card--paused .sw-card-label {
  color: var(--warning-text, var(--warning));
}

.sw-card-icon {
  font-size: 0.85rem;
}

.sw-card-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  animation: sw-pulse 1.6s ease-in-out infinite;
}

@keyframes sw-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

.sw-card-time {
  margin: 2px 0 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-variant-numeric: tabular-nums;
  font-size: 2rem;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: 0.02em;
  color: color-mix(in srgb, var(--fg) 45%, transparent);
}

.sw-card--running .sw-card-time {
  color: var(--fg-strong);
}

.sw-card--paused .sw-card-time {
  color: color-mix(in srgb, var(--fg) 70%, transparent);
}

.sw-card-hint {
  margin: 2px 0 0;
  font-size: 0.8rem;
  color: var(--muted);
}

.sw-card-reset-link {
  margin-top: 4px;
  padding: 2px 0;
  border: none;
  background: transparent;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--muted);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.sw-card-main-btn {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  color: var(--accent-contrast, #060606);
  cursor: pointer;
  transition: transform 0.12s ease, opacity 0.12s ease;
}

.sw-card-main-btn:active {
  transform: scale(0.94);
}

.sw-card-main-btn--pause {
  background: transparent;
  border: 2px solid var(--accent);
  color: var(--fg-strong);
}

.sw-card-confirm {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.sw-card-confirm-text {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--fg);
}

.sw-card-confirm-actions {
  display: flex;
  gap: 6px;
}

.sw-card-confirm-btn {
  min-height: 36px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid var(--line-strong);
  background: transparent;
  color: var(--fg);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
}

.sw-card-confirm-btn--danger {
  border-color: var(--danger);
  color: var(--danger-text, var(--danger));
}

/* Kleine iPhones: Dashboard soll ohne Scrollen passen - Hinweiszeile ausblenden, Zeit etwas kleiner. */
@media (max-height: 700px) {
  .sw-card-hint {
    display: none;
  }

  .sw-card-time {
    font-size: 1.7rem;
  }

  .sw-card-main-btn {
    width: 48px;
    height: 48px;
  }
}

/* Kompakte Variante für die Platzierung im sticky Header (siehe compact-Prop oben) - dort ist
   nur wenig horizontaler Platz neben Titel und "Abmelden"-Button, die volle Breite/Größe der
   Standard-Variante würde dort umbrechen/überlaufen. */
.session-stopwatch--compact {
  width: auto;
  flex-shrink: 0;
}

.session-stopwatch--compact .sw-trigger {
  width: auto;
  min-height: 40px;
  /* Kompakte Breite, aber min-height 40px als ausreichend großes Tap-Ziel (Apple HIG empfiehlt
     min. 44px, 40px ist im engen Header ein vertretbarer Kompromiss) - sonst wirkt der Timer im
     Header zwar sichtbar, aber schwer präzise antippbar ("nicht mehr steuerbar wie vorher"). */
  /* Etwas breiter/größer (war 7px 14px / 0.85rem) - User-Feedback: Zeitanzeige im Header war
     "sehr klein". .header-center ist eine auto-Grid-Spalte (siehe HeaderBar.vue), wächst also
     mit, ohne header-left/header-actions zu verdrängen (die liegen in flexiblen 1fr-Spalten). */
  padding: 9px 22px;
  min-width: 108px;
  font-size: 1.05rem;
  border-radius: 10px;
  white-space: nowrap;
}

/* Trigger */
.sw-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 16px 16px;
  border-radius: 10px;
  border: none;
  background: var(--accent);
  /* War #ffffff - im Standard-"Lime"-Akzent (heller gelbgrün) war weißer Text darauf sehr
     schlecht lesbar. var(--accent-contrast) ist die im Rest der App genutzte, zum Akzent
     passende Kontrastfarbe (siehe z.B. .primary in WorkoutDetailView.vue). */
  color: var(--accent-contrast, #060606);
  /* Etwas größer (war 1.05rem) und zentriert (fehlte bisher trotz width:100%, Inhalt hing
     am linken Rand) - deutlicherer, besser lesbarer Zeit-Anzeiger. */
  font-size: 1.15rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
  transition: background-color 0.15s;
  width: 100%;
  text-align: center;
}

.sw-trigger--running {
  color: var(--accent-contrast, #060606);
  border-color: color-mix(in srgb, var(--accent) 55%, transparent);
  background: var(--accent);
  font-variant-numeric: tabular-nums;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.sw-trigger--paused {
  background: #7f1d1d;
  color: #ffffff;
  font-variant-numeric: tabular-nums;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

/* Overlay (User-Report): jetzt zentriertes Modal statt Dropdown unter dem Trigger - siehe
   Teleport im Template. Optik an .modal-overlay/.modal-content aus AvatarEditor.vue angelehnt. */
.sw-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: color-mix(in oklab, #000000 40%, transparent);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 1000;
}

.sw-panel {
  position: relative;
  background: var(--surface, var(--bg-panel));
  border: 1px solid var(--card-border);
  border-radius: 16px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.35);
  padding: 28px 26px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  min-width: 220px;
}

.sw-close {
  position: absolute;
  top: 8px;
  right: 10px;
  background: transparent;
  border: none;
  font-size: 22px;
  color: var(--muted);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  line-height: 1;
}

.modal-enter-active,
.modal-leave-active {
  transition: all 0.25s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

/* Zeit-Anzeige */
.sw-time {
  font-size: 2.6rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: color-mix(in srgb, var(--fg) 45%, transparent);
  line-height: 1;
  letter-spacing: 0.04em;
}

.sw-time--running {
  color: var(--accent);
}

.sw-time--paused {
  color: color-mix(in srgb, var(--fg) 55%, transparent);
}

/* Buttons */
.sw-controls {
  display: flex;
  gap: 8px;
}

.sw-btn {
  padding: 9px 16px;
  border-radius: 10px;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  border: 1px solid transparent;
  transition: opacity 0.15s;
}

.sw-btn:active {
  opacity: 0.75;
}

.sw-btn--primary {
  background: var(--accent);
  color: var(--accent-color-contrast, #060606);
  border-color: var(--accent);
}

.sw-btn--secondary {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
}

.sw-btn--ghost {
  background: transparent;
  color: color-mix(in srgb, var(--fg) 60%, transparent);
  border-color: var(--card-border);
}
</style>
