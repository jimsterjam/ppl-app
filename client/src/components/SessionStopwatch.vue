<template>
  <div class="session-stopwatch" :class="{ 'session-stopwatch--compact': props.compact }" ref="rootRef">
    <!-- Trigger Button -->
    <button
      class="sw-trigger"
      :class="{
        'sw-trigger--running': isRunning,
        'sw-trigger--paused': !isRunning && elapsedMs > 0
      }"
      type="button"
      @click="toggleOverlay"
    >
      <span v-if="!isRunning && elapsedMs === 0">{{ props.compact ? '⏱ 00:00' : '⏱ Stoppuhr' }}</span>
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
              ▶ Start
            </button>

            <!-- Läuft -->
            <template v-else-if="isRunning">
              <button class="sw-btn sw-btn--secondary" type="button" @click="stop">
                ⏸ Pause
              </button>
              <button class="sw-btn sw-btn--ghost" type="button" @click="handleReset">
                ↺ Reset
              </button>
            </template>

            <!-- Pausiert -->
            <template v-else>
              <button class="sw-btn sw-btn--primary" type="button" @click="resume">
                ▶ Weiter
              </button>
              <button class="sw-btn sw-btn--ghost" type="button" @click="handleReset">
                ↺ Reset
              </button>
            </template>
          </div>

          <button class="sw-close" type="button" @click="closeOverlay" aria-label="Schließen">×</button>
        </div>
      </div>
    </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useSessionStopwatch } from '@/composables/useSessionStopwatch'
import { releaseKeepAwake } from '@/utils/keepAwakeGuard'
import { useScrollLock } from '@/composables/useScrollLock'

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
