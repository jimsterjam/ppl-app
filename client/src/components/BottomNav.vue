<template>
  <nav
    class="app-nav"
    :class="{ 'ios-device': isIOS }"
    role="navigation"
    :aria-label="$t('nav.ariaMain')"
  >
    <svg width="0" height="0" style="position: absolute;">
      <defs>
        <filter id="goo-filter">
          <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10"
            result="goo"
          />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </defs>
    </svg>

    <div class="nav-surface">
      <div class="nav-container" ref="navContainerRef">
        <div
          class="active-pill"
          :class="{ dragging: isDragging }"
          :style="pillStyle"
          @pointerdown="onPillPointerDown"
        />

        <ul class="nav-list">
          <li
            v-for="(link, index) in links"
            :key="link.path"
            class="nav-item"
            :ref="el => setNavItemRef(el, index)"
          >
            <button
              class="nav-btn"
              :class="{ active: $route.path.startsWith(link.path) }"
              :aria-current="$route.path.startsWith(link.path) ? 'page' : undefined"
              @click="onNavClick(index, link.path)"
            >
              <span class="icon" aria-hidden="true">
                <component :is="link.icon" class="icon-svg" />
              </span>
              <span class="label">{{ link.label }}</span>
            </button>
          </li>
          <li
            v-if="activeWorkout"
            class="nav-item workout-item"
            :ref="el => setNavItemRef(el, links.length)"
          >
            <button
              class="nav-btn workout-btn"
              :class="{ active: $route.path.startsWith('/workouts') }"
              :aria-current="$route.path.startsWith('/workouts') ? 'page' : undefined"
              @click="$router.push(`/workouts/${activeWorkout._id}`)"
              title="Zum laufenden Workout"
            >
              <span class="icon workout-icon" aria-hidden="true">
                <Timer class="icon-svg" />
              </span>
              <span class="label">Workout</span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick } from 'vue'
import { useUserStore } from '@/stores/userStore'
import { useAuthStore } from '@/stores/authStore'
import {
  hasActiveDraft,
  getActiveDraft,
  ACTIVE_DRAFT_UPDATED_EVENT
} from '@/utils/activeWorkoutDraft'
import {
  Home,
  BarChart3,
  Dumbbell,
  HelpCircle,
  Settings,
  Timer
} from 'lucide-vue-next'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const isIOS = ref(false)
const draftUpdateTrigger = ref(0)
const store = useUserStore()
const authStore = useAuthStore()

const activeWorkout = computed(() => {
  void draftUpdateTrigger.value
  const uid = String(
    authStore.user?.uid ||
    authStore.uid ||
    store.user?.uid ||
    ''
  ).trim()
  if (!uid || !hasActiveDraft(uid)) return null
  const active = getActiveDraft(uid)
  const workout = active?.workout || null
  if (!workout || workout.completed === true || workout._adjustDraft === true) return null
  const workoutId = String(workout?._id || active?.editingWorkoutId || '').trim()
  if (!workoutId || workoutId.startsWith('draft-favorite-')) return null
  return { _id: workoutId, _isDraft: true, isDraft: true }
})

function onNavClick(index, path) {
  // Pille sofort optimistisch zum Ziel bewegen, unabhängig davon, ob die
  // Zielseite lazy-geladen wird und die Navigation dadurch etwas dauert —
  // das native Tab-Bar-Gefühl braucht sofortiges visuelles Feedback.
  const el = navItemRefs.value[index]
  const rect = getItemRectRelativeToContainer(el)
  if (rect) {
    pillPosition.value = { left: rect.left, width: rect.width }
  }
  router.push(path)
}

function onActiveDraftUpdated() {
  draftUpdateTrigger.value++
}

onMounted(() => {
  isIOS.value =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  window.addEventListener(ACTIVE_DRAFT_UPDATED_EVENT, onActiveDraftUpdated)
})

onBeforeUnmount(() => {
  window.removeEventListener(ACTIVE_DRAFT_UPDATED_EVENT, onActiveDraftUpdated)
  window.removeEventListener('resize', updatePillPosition)
  window.removeEventListener('pointermove', onPillPointerMove)
  window.removeEventListener('pointerup', onPillPointerUp)
})

const links = [
  { get label() { return t('nav.home') }, path: '/dashboard', icon: Home },
  { get label() { return t('nav.stats') }, path: '/stats', icon: BarChart3 },
  { get label() { return t('nav.exercises') }, path: '/exercises', icon: Dumbbell },
  { get label() { return t('nav.faqs') }, path: '/faqs', icon: HelpCircle },
  { get label() { return t('nav.settings') }, path: '/settings', icon: Settings }
]

// ── Gooey-Pill: Position, Snap-Animation, Drag-Interaktion ──────────────────
const navContainerRef = ref(null)
const navItemRefs = ref([])
const pillPosition = ref({ left: 0, width: 0 })
const isDragging = ref(false)

const pillStyle = computed(() => ({
  transform: `translateX(${pillPosition.value.left}px)`,
  width: `${pillPosition.value.width}px`,
  transition: isDragging.value
    ? 'none'
    : 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
}))

function setNavItemRef(el, index) {
  if (el) navItemRefs.value[index] = el
}

function currentActiveIndex() {
  const workoutIndex = links.length
  if (activeWorkout.value && route.path.startsWith('/workouts')) return workoutIndex
  const idx = links.findIndex(link => route.path.startsWith(link.path))
  return idx === -1 ? 0 : idx
}

function getItemRectRelativeToContainer(el) {
  const container = navContainerRef.value
  if (!container || !el) return null
  const containerRect = container.getBoundingClientRect()
  const rect = el.getBoundingClientRect()
  return {
    left: rect.left - containerRect.left,
    width: rect.width
  }
}

function updatePillPosition() {
  const activeIndex = currentActiveIndex()
  const el = navItemRefs.value[activeIndex]
  const rect = getItemRectRelativeToContainer(el)
  if (!rect) return
  pillPosition.value = { left: rect.left, width: rect.width }
}

watch(() => route.path, () => {
  nextTick(updatePillPosition)
})

watch(activeWorkout, () => {
  nextTick(updatePillPosition)
})

onMounted(() => {
  nextTick(updatePillPosition)
  window.addEventListener('resize', updatePillPosition)
})

// ── Drag-Handling: Blase kann per Pointer gezogen werden, snapt beim
//    Loslassen zum nächstgelegenen Tab und navigiert dorthin. ──────────────
let dragStartClientX = 0
let dragStartLeft = 0

function onPillPointerDown(event) {
  isDragging.value = true
  dragStartClientX = event.clientX
  dragStartLeft = pillPosition.value.left
  window.addEventListener('pointermove', onPillPointerMove)
  window.addEventListener('pointerup', onPillPointerUp)
}

function onPillPointerMove(event) {
  if (!isDragging.value) return
  const container = navContainerRef.value
  if (!container) return
  const containerWidth = container.getBoundingClientRect().width
  const delta = event.clientX - dragStartClientX
  let newLeft = dragStartLeft + delta
  newLeft = Math.max(0, Math.min(newLeft, containerWidth - pillPosition.value.width))
  pillPosition.value = { ...pillPosition.value, left: newLeft }
}

function onPillPointerUp() {
  isDragging.value = false
  window.removeEventListener('pointermove', onPillPointerMove)
  window.removeEventListener('pointerup', onPillPointerUp)

  // Nächstgelegenes Nav-Item anhand der Mittelpunkt-Distanz zur Pille bestimmen
  const pillCenter = pillPosition.value.left + pillPosition.value.width / 2
  let nearestIndex = 0
  let nearestDist = Infinity

  navItemRefs.value.forEach((el, idx) => {
    const rect = getItemRectRelativeToContainer(el)
    if (!rect) return
    const center = rect.left + rect.width / 2
    const dist = Math.abs(center - pillCenter)
    if (dist < nearestDist) {
      nearestDist = dist
      nearestIndex = idx
    }
  })

  function onPillPointerDown(event) {
    console.log('[DEBUG-DRAG] pointerdown gefeuert')
    isDragging.value = true
    dragStartClientX = event.clientX
    dragStartLeft = pillPosition.value.left
    window.addEventListener('pointermove', onPillPointerMove)
    window.addEventListener('pointerup', onPillPointerUp)
  }

  const isWorkoutTarget = nearestIndex === links.length
  const target = isWorkoutTarget
    ? (activeWorkout.value ? `/workouts/${activeWorkout.value._id}` : null)
    : links[nearestIndex]?.path

  if (target && !route.path.startsWith(target)) {
    router.push(target)
  } else {
    // Kein Tab-Wechsel (z.B. auf denselben Tab losgelassen) → Pille zurückschnappen
    nextTick(updatePillPosition)
  }
}
</script>

<style scoped>
/* =========================================================
   Gooey Bottom Nav – Pille wandert per JS-Positionierung
   zum aktiven Tab, ist zusätzlich per Pointer ziehbar.
   ========================================================= */
.app-nav {
  position: fixed;
  z-index: 1000;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 10px 16px max(10px, env(safe-area-inset-bottom));
  pointer-events: none;
}

.nav-surface {
  position: relative;
  pointer-events: auto;
  width: 100%;
  margin: 0 auto;
  background: color-mix(in srgb, var(--bg-panel) 50%, transparent);
  border-radius: 34px;
  border: 2px solid var(--line-soft);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15);
  padding: 10px;
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
}

[data-theme="light"] .nav-surface {
  background: color-mix(in srgb, var(--bg-panel) 95%, #f8f9fd 5%);
  border-color: rgba(0, 0, 0, 0.12);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08);
}

.nav-container {
  position: relative;
  filter: url('#goo-filter');
}

.active-pill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: var(--accent) !important;
  border-radius: 30px;
  z-index: 1;
  will-change: transform, width;
  cursor: grab;
  touch-action: none;
}

.active-pill.dragging {
  cursor: grabbing;
}

.nav-list {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: stretch;
  justify-content: space-around;
  list-style: none;
  margin: 0;
  padding: 0;
  min-height: 52px;
  gap: 2px;
}

.nav-item {
  flex: 1 1 0;
  min-width: 0;
}

.nav-btn {
  position: relative;
  z-index: 2;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 2px 4px;
  border: 0;
  border-radius: 24px;
  background: transparent;
  color: #64748b;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 12px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  user-select: none;
  transition: color 0.3s ease;
}

.nav-btn:active {
  opacity: 0.7;
}

.nav-btn.active {
  color: #ffffff;
}

.icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
}

.icon-svg {
  width: 24px;
  height: 24px;
  stroke-width: 1.6;
  fill: none;
  transition: fill 0.2s ease, stroke 0.2s ease, stroke-width 0.2s ease;
}

.nav-btn:not(.active) .icon-svg {
  stroke: #64748b;
}

.nav-btn.active .icon-svg {
  fill: #ffffff;
  stroke: #ffffff;
  stroke-width: 2.2;
}

.label {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workout-btn:not(.active) {
  color: #34C759;
}
.workout-btn:not(.active) .icon-svg {
  stroke: #34C759;
}

.workout-icon {
  position: relative;
}
.workout-icon::after {
  content: '';
  position: absolute;
  width: 8px;
  height: 8px;
  top: -2px;
  right: -3px;
  border-radius: 50%;
  background: #34C759;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.95);
  animation: workout-pulse 2.5s ease-in-out infinite;
}

@keyframes workout-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.7); }
}

@media (prefers-color-scheme: dark) {
  .nav-btn {
    color: rgba(235, 235, 245, 0.6);
  }
  .nav-btn:not(.active) .icon-svg {
    stroke: rgba(235, 235, 245, 0.6);
  }
  .active-pill {
    background: #0A84FF;
  }
  .workout-icon::after {
    box-shadow: 0 0 0 3px rgba(28, 28, 30, 0.95);
  }
}

@media (min-width: 768px) and (max-width: 1023px) {
  .app-nav {
    padding: 12px 32px max(12px, env(safe-area-inset-bottom));
  }
  .nav-surface {
    max-width: 520px;
    margin: 0 auto;
  }
  .nav-list {
    min-height: 54px;
  }
}

@media (min-width: 1024px) {
  .app-nav {
    top: 0; right: auto; bottom: 0; left: 0;
    width: 240px; padding: 16px 12px;
    pointer-events: none;
  }
  .nav-surface {
    pointer-events: auto;
    height: calc(100vh - 32px);
    max-width: none; margin: 0;
    border-radius: 22px;
    background: color-mix(in srgb, var(--bg-panel, #fff) 88%, transparent);
    box-shadow: 0 8px 30px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04);
  }
  .nav-container {
    filter: none;
  }
  .active-pill {
    display: none;
  }
  .nav-list {
    flex-direction: column; align-items: stretch;
    min-height: 0; padding: 10px; gap: 5px;
  }
  .nav-item { flex: none; }
  .nav-btn {
    flex-direction: row; justify-content: flex-start;
    gap: 12px; width: 100%; height: 46px;
    padding: 8px 12px; border-radius: 14px;
    color: var(--fg); font-size: 14px; line-height: 18px;
  }
  .nav-btn.active {
    color: var(--accent-color);
    background: color-mix(in srgb, var(--accent-color) 12%, transparent);
  }
  .nav-btn.active .icon-svg { fill: none; stroke: var(--accent-color); }
  .nav-btn:not(.active) .icon-svg { stroke: var(--fg); }
  .icon { width: 24px; height: 24px; }
  .icon-svg { width: 20px; height: 20px; }
  .workout-btn { margin-top: 4px; }
  .workout-btn.active .icon-svg { fill: none; stroke: var(--success-color, #34c759); }
  .workout-icon::after { top: 1px; right: -1px; }
}

@media (prefers-reduced-motion: reduce) {
  .nav-btn, .icon-svg, .active-pill { transition: none; }
  .workout-icon::after { animation: none; }
}
</style>