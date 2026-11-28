<script setup>
// Strichfiguren-Demo für Übungen ohne Video (Absprache Jimmy 28.11.). Rechnet in utils/exerciseDemo/engine.js,
// Haltungen in utils/exerciseDemo/demos.js. Den Hinweis "nur zur Orientierung" zeigt der umgebende Dialog
// (exercises.mediaDisclaimer bzw. workoutDetail.mediaDisclaimer), nicht diese Komponente.
import { shallowRef, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { layout, buildFrame, timelineAt, frameBounds } from '@/utils/exerciseDemo/engine'

const props = defineProps({
  demo: { type: Object, required: true },
  // Zugänglicher Name der Grafik (Übungsname, kein neuer Text)
  title: { type: String, default: '' },
  // Kleines Standbild (Endhaltung, ohne Bewegung und Leuchten) für Vorschaubilder in Listen
  still: { type: Boolean, default: false }
})

const lay = computed(() => layout(props.demo))
const animated = computed(() => Array.isArray(props.demo.phases) && props.demo.phases.length > 0)

// Zeitpunkt des Ruhebilds (Standbild, "Bewegung reduzieren"): Endhaltung, bei Bewegungen eine aussagekräftige Haltung (restT, z. B. der Fang beim Clean)
const restT = () => props.demo.restT ?? 1

function stillFrame() {
  return buildFrame(props.demo, lay.value, restT(), false)
}

// Bild zum Zeitpunkt seconds: statische Demo = Endhaltung mit Leuchten, animierte = Ablauf an dieser Stelle
function frameAt(seconds) {
  const { t, holding } = timelineAt(props.demo.phases, seconds)
  return buildFrame(props.demo, lay.value, t, holding)
}
// shallowRef: das Bild wird als Ganzes ersetzt (nie einzeln verändert), spart bei 60 Bildern pro Sekunde das tiefe Beobachten
const frame = shallowRef(props.still ? stillFrame() : frameAt(0))

let rafId = 0
let startedAt = 0

let motionQuery = null

function reducedMotionQuery() {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
  } catch {
    return null
  }
}

const prefersReducedMotion = () => Boolean(reducedMotionQuery()?.matches)

// Ruhebild: bei bewegungsempfindlichen Einstellungen und für statische Demos die Endhaltung mit Leuchten.
function showResting() {
  // Bewegungen (kind 'dynamic') haben keine Haltephase: kein Leuchten
  frame.value = buildFrame(props.demo, lay.value, restT(), props.demo.kind !== 'dynamic')
}

function tick(now) {
  if (!startedAt) startedAt = now
  const { t, holding } = timelineAt(props.demo.phases, (now - startedAt) / 1000)
  frame.value = buildFrame(props.demo, lay.value, t, holding)
  rafId = requestAnimationFrame(tick)
}

function stop() {
  if (rafId) cancelAnimationFrame(rafId)
  rafId = 0
  startedAt = 0
}

function start() {
  stop()
  if (props.still) {
    frame.value = stillFrame()
    return
  }
  frame.value = frameAt(0) // sofort das richtige Bild, nicht erst nach dem ersten Animationsschritt
  if (!animated.value || prefersReducedMotion()) {
    showResting()
    return
  }
  rafId = requestAnimationFrame(tick)
}

// Standbild: ohne Wandhalterung (Boden und Stange bleiben als Hinweis, was gehalten wird)
const sceneLines = computed(() => (props.still ? frame.value.scene.lines.filter((l) => l.cls !== 'wall') : frame.value.scene.lines))

const sceneRects = computed(() => (props.still ? [] : frame.value.scene.rects))

// Standbild: nur die Hantelscheibe (gehört zur Haltung); Stangenenden und Ähnliches entfallen
const sceneCircles = computed(() => (props.still ? frame.value.scene.circles.filter((c) => c.cls.startsWith('plate')) : frame.value.scene.circles))

const viewBox = computed(() => {
  if (!props.still) return `0 0 ${lay.value.width} ${lay.value.height}`
  const b = frameBounds(frame.value)
  return `${b.x.toFixed(1)} ${b.y.toFixed(1)} ${b.size.toFixed(1)} ${b.size.toFixed(1)}`
})

onMounted(() => {
  start()
  // Wird "Bewegung reduzieren" bei offener Demo umgestellt, gilt das sofort (nicht erst nach erneutem Öffnen).
  motionQuery = reducedMotionQuery()
  motionQuery?.addEventListener?.('change', start)
})
onBeforeUnmount(() => {
  stop()
  motionQuery?.removeEventListener?.('change', start)
  motionQuery = null
})
watch(() => [props.demo, props.still], start)
</script>

<template>
  <svg
    class="exercise-demo"
    :class="{ 'is-still': still }"
    :viewBox="viewBox"
    :role="still ? undefined : 'img'"
    :aria-label="still ? undefined : title"
    :aria-hidden="still ? 'true' : undefined"
    preserveAspectRatio="xMidYMid meet"
  >
    <g class="ed-scene">
      <line v-for="(l, i) in sceneLines" :key="`l${i}`" :class="l.cls" :x1="l.x1" :y1="l.y1" :x2="l.x2" :y2="l.y2" />
      <rect v-for="(r, i) in sceneRects" :key="`r${i}`" :class="r.cls" :x="r.x" :y="r.y" :width="r.w" :height="r.h" rx="3" />
      <circle v-for="(c, i) in sceneCircles" :key="`c${i}`" :class="c.cls" :cx="c.cx" :cy="c.cy" :r="c.r" />
    </g>
    <g v-if="!still" class="ed-halo" :class="{ on: frame.holding }">
      <line v-for="(s, i) in frame.near" :key="`h${i}`" class="halo-seg" :x1="s.x1" :y1="s.y1" :x2="s.x2" :y2="s.y2" />
    </g>
    <g class="ed-figure">
      <line v-for="(s, i) in frame.far" :key="`f${i}`" class="limb far" :x1="s.x1" :y1="s.y1" :x2="s.x2" :y2="s.y2" />
      <line
        v-for="(s, i) in frame.near"
        :key="`n${i}`"
        class="limb"
        :class="{ hot: s.hot, torso: s.kind === 'torso' }"
        :x1="s.x1" :y1="s.y1" :x2="s.x2" :y2="s.y2"
      />
      <circle class="head" :cx="frame.head.cx" :cy="frame.head.cy" :r="frame.head.r" />
      <template v-if="!still">
        <circle v-for="(j, i) in frame.joints" :key="`j${i}`" class="joint" :cx="j.cx" :cy="j.cy" :r="j.r" />
      </template>
    </g>
  </svg>
</template>

<style scoped>
.exercise-demo {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 12px;
  background: var(--card-soft, #1c1f28);
  border: 1px solid var(--card-border, #1f2937);
}
.limb { stroke: var(--fg, #eef0f6); stroke-width: 5.5; stroke-linecap: round; fill: none; }
.limb.far { stroke: var(--muted, #9aa3b8); opacity: 0.7; }
.limb.hot { stroke: var(--accent-text, var(--accent, #d7ff1f)); }
.limb.torso.hot { stroke-width: 7; }
.head { fill: none; stroke: var(--fg, #eef0f6); stroke-width: 5; }
.joint { fill: var(--card-soft, #1c1f28); }
.floor, .wall { stroke: var(--line-strong, rgba(255, 255, 255, 0.2)); stroke-width: 3; stroke-linecap: round; }
.bar { stroke: var(--muted, #9aa3b8); stroke-width: 6; stroke-linecap: round; }
.plate { fill: none; stroke: var(--muted, #9aa3b8); stroke-width: 6; }
.plate-hub { fill: var(--muted, #9aa3b8); }
.is-still .plate { stroke-width: 2.5px; vector-effect: non-scaling-stroke; }
.bar-end { fill: var(--muted, #9aa3b8); }
.box { fill: var(--surface-strong, #2b2f3b); stroke: var(--line-strong, rgba(255, 255, 255, 0.2)); stroke-width: 2; }
.halo-seg { stroke: var(--accent-text, var(--accent, #d7ff1f)); stroke-width: 13; stroke-linecap: round; fill: none; }
.ed-halo { opacity: 0; }
.ed-halo.on { animation: ed-pulse 1.2s ease-in-out infinite; }
@keyframes ed-pulse { 0%, 100% { opacity: 0.05; } 50% { opacity: 0.5; } }
/* Standbild in Vorschaubildern: Linien in Bildschirmpixeln (unabhängig vom Ausschnitt), Gelenkpunkte weglassen */
.is-still { border: 0; border-radius: 0; background: transparent; width: 100%; height: 100%; }
.is-still .limb { stroke-width: 3px; vector-effect: non-scaling-stroke; }
.is-still .limb.torso.hot { stroke-width: 3.6px; }
.is-still .head { stroke-width: 2.6px; vector-effect: non-scaling-stroke; }
.is-still .floor, .is-still .bar { stroke-width: 2px; vector-effect: non-scaling-stroke; }
@media (prefers-reduced-motion: reduce) {
  .ed-halo.on { animation: none; opacity: 0.3; }
}
</style>
