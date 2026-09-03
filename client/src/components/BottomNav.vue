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
            v-for="link in visibleLinks"
            :key="link.path"
            class="nav-item"
            :ref="el => setNavItemRef(el, link.path)"
          >
            <button
              class="nav-btn"
              :class="{ active: $route.path.startsWith(link.path) }"
              :aria-current="$route.path.startsWith(link.path) ? 'page' : undefined"
              @click="onNavClick(link.path, link.path)"
            >
              <span class="icon" aria-hidden="true">
                <component :is="link.icon" class="icon-svg" />
              </span>
              <span class="label">{{ link.label }}</span>
            </button>
          </li>
          <li
            v-if="activeWorkout"
            key="workout"
            class="nav-item workout-item"
            :ref="el => setNavItemRef(el, WORKOUT_KEY)"
          >
            <button
              class="nav-btn workout-btn"
              :class="{ active: $route.path.startsWith('/workouts') }"
              :aria-current="$route.path.startsWith('/workouts') ? 'page' : undefined"
              @click="onNavClick(WORKOUT_KEY, `/workouts/${activeWorkout._id}`)"
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

// Korrektur nach Video-Abgleich mit dem echten App Store: der aktive Indikator ist dort KEIN
// kleiner Icon-Kreis, sondern eine Pille über Icon+Label (wie ursprünglich), nur mit neutraler
// grauer statt akzentfarbener Füllung — die Farbe kommt vom Icon/Text, nicht vom Hintergrund.
// Kleiner Innenabstand (INSET) sorgt dafür, dass die Pille nicht ganz bis an die Nachbar-Items
// reicht, wie im Video zu sehen.
const PILL_INSET = 4
// Mindestbreite der Pille: die Tab-Anzahl bleibt jetzt konstant bei 5 (FAQ weicht während eines
// laufenden Workouts dem Workout-Tab, siehe visibleLinks), trotzdem als defensive Untergrenze für
// sehr schmale Displays behalten - ohne sie würde die Pille bei sehr wenig Platz pro Item spürbar
// kleiner wirken, obwohl der User erwartet, dass sie "ausreichend groß" bleibt.
const PILL_MIN_WIDTH = 48

// Berechnet die Pillen-Position/-Breite für ein Nav-Item, zentriert auf dessen Mittelpunkt,
// mit Untergrenze PILL_MIN_WIDTH (kann dadurch etwas über die Item-Ränder hinausragen, das ist
// bei eng gepackten Tabs auf schmalen Displays gewollt statt einer kaum sichtbaren Pille).
// Zusätzliche Breite gegenüber dem reinen Item-Inset - User-Feedback: Pille wirkte trotz
// des Höhen-Fixes zu schmal für Icon+Label.
const PILL_EXTRA_WIDTH = 5

function computePillRect(rect) {
  let left = rect.left + PILL_INSET - PILL_EXTRA_WIDTH / 2
  let width = Math.max(0, rect.width - PILL_INSET * 2 + PILL_EXTRA_WIDTH)
  if (width < PILL_MIN_WIDTH) {
    const center = rect.left + rect.width / 2
    width = PILL_MIN_WIDTH
    left = center - width / 2
  }
  return { left, width }
}

function onNavClick(key, path) {
  // Pille sofort optimistisch zum Ziel bewegen, unabhängig davon, ob die
  // Zielseite lazy-geladen wird und die Navigation dadurch etwas dauert —
  // das native Tab-Bar-Gefühl braucht sofortiges visuelles Feedback.
  const el = navItemRefs.value[key]
  const rect = getItemRectRelativeToContainer(el)
  if (rect) {
    pillPosition.value = computePillRect(rect)
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

// Bug (User-Report "Pille fast rund beim Zurückkehren in die App"): die Pille wird per JS
// über getBoundingClientRect() der Nav-Buttons positioniert. Bisher gab es dafür keinen
// Trigger beim App-Resume (nur bei Routenwechsel/Resize) — kehrt man aus dem Hintergrund
// zurück, kann die erste Messung nach dem Wiederaufwachen der WebView noch eine veraltete/zu
// kleine Breite liefern (Layout ist in dem Moment noch nicht final). Der SVG-Goo-Filter
// (Gaussian Blur + Kontrast) verstärkt eine zu schmale Pille optisch zu einem fast runden
// Blob — das ist keine echte border-radius-Änderung, sondern eine falsch gemessene Breite.
// Fix: bei Resume/Sichtbarkeitswechsel neu messen, mit doppeltem rAF, damit das Layout beim
// Messen sicher final ist.
function remeasurePillAfterResume() {
  requestAnimationFrame(() => {
    requestAnimationFrame(updatePillPosition)
  })
}

let capAppStateListener = null

onMounted(async () => {
  document.addEventListener('visibilitychange', onVisibilityChangeForPill)
  try {
    const { App: CapApp } = await import('@capacitor/app')
    capAppStateListener = await CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) remeasurePillAfterResume()
    })
  } catch {
    // Web-Kontext ohne Capacitor — visibilitychange reicht dort aus.
  }
})

function onVisibilityChangeForPill() {
  if (document.visibilityState === 'visible') remeasurePillAfterResume()
}

onBeforeUnmount(() => {
  window.removeEventListener(ACTIVE_DRAFT_UPDATED_EVENT, onActiveDraftUpdated)
  window.removeEventListener('resize', updatePillPosition)
  window.removeEventListener('pointermove', onPillPointerMove)
  window.removeEventListener('pointerup', onPillPointerUp)
  window.removeEventListener('pointercancel', onPillPointerUp)
  document.removeEventListener('visibilitychange', onVisibilityChangeForPill)
  capAppStateListener?.remove?.()
})

const links = [
  { get label() { return t('nav.home') }, path: '/dashboard', icon: Home },
  { get label() { return t('nav.stats') }, path: '/stats', icon: BarChart3 },
  { get label() { return t('nav.exercises') }, path: '/exercises', icon: Dumbbell },
  { get label() { return t('nav.faqs') }, path: '/faqs', icon: HelpCircle },
  { get label() { return t('nav.settings') }, path: '/settings', icon: Settings }
]

// Solange ein Workout läuft, wird FAQ ausgeblendet statt den Workout-Tab einfach als 6.
// Element anzuhängen - dadurch bleibt die Tab-Anzahl konstant bei 5 und die Pille (bzw. jedes
// einzelne Tab-Item) ändert beim Start/Ende eines Workouts nicht ihre Breite. FAQ ist inhaltlich
// am ehesten verzichtbar während eines laufenden Workouts (statische Referenz, kein Zeitdruck)
// und bleibt über die Route weiterhin erreichbar, nur eben nicht als Tab sichtbar.
const HIDDEN_DURING_WORKOUT_PATHS = ['/faqs']

const visibleLinks = computed(() => {
  if (!activeWorkout.value) return links
  return links.filter(link => !HIDDEN_DURING_WORKOUT_PATHS.includes(link.path))
})

// Fester Schlüssel für den Workout-Tab (kein echter Route-Pfad, da der Ziel-Pfad die
// Workout-_id enthält und sich damit während eines laufenden Workouts nicht ändert, aber
// zwischen verschiedenen Workouts unterscheiden würde).
const WORKOUT_KEY = '__workout__'

// Alle aktuell sichtbaren Nav-Items in Anzeigereihenfolge, inkl. Workout-Tab - ersetzt die
// vorherige Index-Rechnung (links.length als "virtueller" Workout-Index), die bei einer
// dynamisch gefilterten links-Liste nicht mehr stabil wäre.
const orderedNavItems = computed(() => {
  const items = visibleLinks.value.map(link => ({ key: link.path, path: link.path }))
  if (activeWorkout.value) {
    items.push({ key: WORKOUT_KEY, path: `/workouts/${activeWorkout.value._id}` })
  }
  return items
})

// ── Gooey-Pill: Position, Snap-Animation, Drag-Interaktion ──────────────────
const navContainerRef = ref(null)
// Key-basiert (Tab-Pfad bzw. WORKOUT_KEY) statt Index-basiert: die Anzahl/Reihenfolge der
// sichtbaren Tabs ändert sich jetzt zur Laufzeit (FAQ verschwindet/erscheint), Indizes wären
// dabei nicht stabil zuzuordnen.
const navItemRefs = ref({})
const pillPosition = ref({ left: 0, width: 0 })
const isDragging = ref(false)

const pillStyle = computed(() => ({
  transform: `translateX(${pillPosition.value.left}px)`,
  width: `${pillPosition.value.width}px`,
  transition: isDragging.value
    ? 'none'
    : 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
}))

function setNavItemRef(el, key) {
  // Vue ruft Function-Refs beim Unmount des Elements mit null auf (z.B. wenn FAQ beim
  // Workout-Start aus visibleLinks verschwindet) - alten Eintrag dann entfernen, sonst
  // würde ein veralteter/nicht mehr im DOM befindlicher Node hier hängen bleiben.
  if (el) {
    navItemRefs.value[key] = el
  } else {
    delete navItemRefs.value[key]
  }
}

function currentActiveKey() {
  if (activeWorkout.value && route.path.startsWith('/workouts')) return WORKOUT_KEY
  const match = visibleLinks.value.find(link => route.path.startsWith(link.path))
  return match ? match.path : (visibleLinks.value[0]?.path ?? null)
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

function updatePillPosition(retriesLeft = 3) {
  const activeKey = currentActiveKey()
  const el = activeKey != null ? navItemRefs.value[activeKey] : null
  const rect = getItemRectRelativeToContainer(el)
  if (!rect) return
  // Defensive Untergrenze: eine plausible Tab-Breite liegt immer deutlich über 20px. Eine
  // kleinere Messung deutet auf ein noch nicht fertig layoutetes DOM hin (z.B. kurz nach
  // App-Resume) — dann kurz erneut versuchen statt die verfälschte, vom Goo-Filter zum Blob
  // verzerrte Breite zu übernehmen.
  if (rect.width < 20 && retriesLeft > 0) {
    requestAnimationFrame(() => updatePillPosition(retriesLeft - 1))
    return
  }
  pillPosition.value = computePillRect(rect)
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
  // Ohne explizites Pointer Capture kann iOS/WKWebView die laufende Zeigersequenz bei
  // schnellerer Bewegung als mehrdeutige Geste werten und an natives Scrollen/Bounce
  // "verlieren" (Symptom: Drag startet sichtbar, bricht dann aber sofort ab). touch-action:
  // none auf .active-pill allein reicht dafür nicht zuverlässig - explizites Capture bindet
  // alle folgenden Pointer-Events fest an dieses Element, bis pointerup/-cancel.
  try { event.target.setPointerCapture(event.pointerId) } catch {}
  event.preventDefault()
  window.addEventListener('pointermove', onPillPointerMove)
  window.addEventListener('pointerup', onPillPointerUp)
  window.addEventListener('pointercancel', onPillPointerUp)
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
  window.removeEventListener('pointercancel', onPillPointerUp)

  // Nächstgelegenes Nav-Item anhand der Mittelpunkt-Distanz zur Pille bestimmen
  const pillCenter = pillPosition.value.left + pillPosition.value.width / 2
  let nearestItem = null
  let nearestDist = Infinity

  orderedNavItems.value.forEach((item) => {
    const el = navItemRefs.value[item.key]
    const rect = getItemRectRelativeToContainer(el)
    if (!rect) return
    const center = rect.left + rect.width / 2
    const dist = Math.abs(center - pillCenter)
    if (dist < nearestDist) {
      nearestDist = dist
      nearestItem = item
    }
  })

  const target = nearestItem?.path

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
  /* Deutlich transparenter als vorher (war 38-46%): native Bars liegen bei ~10-15%
     Grundfarbe, der optische Effekt kommt fast komplett vom Blur, nicht von der Füllung. */
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--bg-panel) 20%, transparent) 0%,
    color-mix(in srgb, var(--bg-panel) 14%, transparent) 100%
  );
  /* Video-Abgleich: die App Store Bar ist eine volle Kapsel (Radius = halbe Höhe), nicht
     nur "stark abgerundet". 999px erzwingt das unabhängig von der tatsächlichen Höhe. */
  border-radius: 999px;
  /* Haarlinie statt Karten-Rahmen (war 1-2px sichtbarer Border) */
  border: 1px solid rgba(255, 255, 255, 0.10);
  /* Spekularer Rand oben + weicher Schlagschatten unten: das ist der Teil, der flachen
     Blur von echtem "Liquid Glass" unterscheidet — ein heller Kantenreflex, der Licht von
     oben simuliert, plus ein zarter Innenschatten unten für Tiefe. */
  box-shadow:
    0 8px 20px -6px rgba(0, 0, 0, 0.35),
    0 20px 40px -10px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    inset 0 -1px 0 rgba(0, 0, 0, 0.12);
  padding: 10px;
  backdrop-filter: blur(34px) saturate(200%);
  -webkit-backdrop-filter: blur(34px) saturate(200%);
}

[data-theme="light"] .nav-surface {
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--bg-panel) 48%, transparent) 0%,
    color-mix(in srgb, var(--bg-panel) 38%, transparent) 100%
  );
  border-color: rgba(255, 255, 255, 0.5);
  box-shadow:
    0 8px 20px -6px rgba(0, 0, 0, 0.10),
    0 20px 40px -10px rgba(0, 0, 0, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.8),
    inset 0 -1px 0 rgba(0, 0, 0, 0.04);
}

.nav-container {
  position: relative;
  /* filter: url('#goo-filter'); */
}

.active-pill {
  position: absolute;
  /* Nach Video-Abgleich mit dem echten App Store korrigiert: Pille deckt Icon+Label ab
     (top/bottom-Inset statt fixer Höhe), Form ist komplett "stadium" (volle Kapsel), und die
     Füllung ist neutral/grau statt akzentfarben — die Akzentfarbe zeigt sich nur an
     Icon+Label (siehe .nav-btn.active), nicht am Pillen-Hintergrund. */
  /* Etwas mehr Höhe als vorher (war 4px/4px): die Pille deckte Icon+Label nicht ganz komplett
     ab, an den Rändern blieb ein sichtbarer Spalt. */
  top: 2px;
  bottom: 2px;
  left: 0;
  background: rgba(120, 120, 128, 0.24) !important;
  border-radius: 999px;
  z-index: 1;
  will-change: transform, width;
  cursor: grab;
  touch-action: none;
}

[data-theme="light"] .active-pill {
  background: rgba(120, 120, 128, 0.16) !important;
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
  /* War #ffffff (weiß auf akzentfarbener Pille) — die Pille ist nach Video-Abgleich jetzt
     neutral/grau, die Akzentfarbe sitzt stattdessen auf Icon+Label, wie im echten App Store. */
  color: var(--accent);
  /* Bug (User-Report "Pille lässt sich nicht verschieben"): .nav-btn liegt auf z-index: 2,
     die Pille darunter auf z-index: 1 — der aktive Button deckt die Pille exakt ab, jeder
     Pointerdown auf der sichtbar-aktiven Pille landete deshalb immer auf dem Button statt auf
     der Pille, Drag konnte nie starten. pointer-events: none lässt Zeigerereignisse durch den
     (bereits aktiven, für sich genommen funktionslosen) Button zur Pille durch; Icon/Label
     bleiben optisch unverändert oben, da sich nur das Hit-Testing ändert, nicht die z-Reihenfolge.
     Alle anderen (nicht aktiven) Tabs bleiben normal klickbar. */
  pointer-events: none;
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
  /* Kontrast-Anker gegen wechselnden Untergrund bei transparenter Nav */
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.35));
}

.nav-btn:not(.active) .icon-svg {
  stroke: #64748b;
}

[data-theme="light"] .nav-btn:not(.active) .icon-svg {
  stroke: #334155;
  filter: drop-shadow(0 1px 2px rgba(255, 255, 255, 0.5));
}

.nav-btn.active .icon-svg {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2.2;
}

.label {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
}

[data-theme="light"] .label {
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.5);
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