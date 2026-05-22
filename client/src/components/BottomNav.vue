<template>
  <nav class="app-nav" :class="{ 'ios-device': isIOS }" role="navigation" :aria-label="$t('nav.ariaMain')">
    <ul class="nav-list">
      <li v-for="link in links" :key="link.path">
        <button
          class="nav-btn"
          :class="{ active: $route.path.startsWith(link.path) }"
          :aria-current="$route.path.startsWith(link.path) ? 'page' : undefined"
          @click="$router.push(link.path)"
        >
          <span class="icon" aria-hidden="true">
            <component :is="link.icon" class="icon-svg" />
          </span>
          <span class="label">{{ link.label }}</span>
        </button>
      </li>
      <li v-if="activeWorkout">
        <button
          class="nav-btn workout-btn"
          :class="{ active: $route.path.startsWith('/workouts') }"
          :aria-current="$route.path.startsWith('/workouts') ? 'page' : undefined"
          @click="$router.push(`/workouts/${activeWorkout._id}`)"
          title="Zum laufenden Workout"
        >
          <span class="icon" aria-hidden="true">
            <Timer class="icon-svg" />
          </span>
          <span class="label">Workout</span>
        </button>
      </li>
    </ul>
  </nav>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { Home, BarChart3, Dumbbell, HelpCircle, Settings, Timer } from 'lucide-vue-next'

const { t } = useI18n()
const isIOS = ref(false)
const store = useUserStore()
const route = useRoute()
const activeWorkout = computed(() => {
  // 1. Pinia Store (reaktiv, in-session)
  const storeDraft = store.workouts.find(w => (w._isDraft === true || w.isDraft === true) && w.completed !== true)
  if (storeDraft) return storeDraft

  // 2. sessionStorage-Fallback: sichtbar nach Page-Reload oder wenn User auf Nicht-Dashboard-Seite landet
  // Favorit-Anpassen-Drafts sind keine "gestarteten Workouts" und werden ausgeblendet.
  try {
    const raw = sessionStorage.getItem('workout_detail_draft')
    if (raw) {
      const parsed = JSON.parse(raw)
      // Favorit-Anpassen-Drafts explizit ausblenden (Marker _adjustDraft oder draft-favorite- Präfix)
      if (parsed?._adjustDraft) return null
      const draft = parsed?.workout || parsed
      const draftId = String(draft?._id || '')
      if (
        draftId &&
        !draftId.startsWith('draft-favorite-') &&
        draft.completed !== true &&
        draft._isDraft !== false
      ) {
        return { _id: draftId, _isDraft: true, isDraft: true }
      }
    }
  } catch {}

  return null
})

onMounted(() => {
  // Detect iOS/iPhone Simulator
  isIOS.value = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
})

const links = [
  { get label() { return t('nav.home') }, path: "/dashboard", icon: Home },
  { get label() { return t('nav.stats') }, path: "/stats", icon: BarChart3 },
  { get label() { return t('nav.exercises') }, path: "/exercises", icon: Dumbbell },
  { get label() { return t('nav.faqs') }, path: "/faqs", icon: HelpCircle },
  { get label() { return t('nav.settings') }, path: "/settings", icon: Settings }
];
</script>

<style scoped>
/* Basis: Mobile Bottom-Bar */
.app-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  background: var(--bg-panel);
  border-top: 1px solid var(--line-soft);
  box-shadow: none;
  z-index: 1000;
  /* Sehr kompakte Höhe */
  min-height: calc(50px + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
}

.nav-list { 
  display: flex; 
  justify-content: space-around; 
  list-style: none; 
  padding: 4px 0; 
  margin: 0; 
  min-height: 50px;
  box-sizing: border-box;
}
.nav-btn { background: none; border: none; color: var(--fg); opacity: 0.7; display: flex; flex-direction: column; align-items: center; font-size: 0.7rem; padding: 4px 8px; cursor: pointer; transition: color 0.15s ease, opacity 0.15s ease, background 0.15s ease; border-radius: 8px; min-height: 46px; min-width: 46px; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
.nav-btn:hover, .nav-btn:active, .nav-btn.active { color: var(--accent-color); opacity: 1; background: color-mix(in srgb, var(--accent-color) 8%, transparent); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
.icon { margin-bottom: 2px; line-height: 1; }
.icon-svg { width: 20px; height: 20px; }
.label { font-size: 0.6rem; font-weight: 600; line-height: 1; }

.workout-btn {
  color: var(--success-color);
  font-weight: bold;
  animation: workout-pulse 1.5s infinite alternate;
}
@keyframes workout-pulse {
  0% { box-shadow: 0 0 0 0 var(--success-color, #4ade80); }
  100% { box-shadow: 0 0 8px 2px var(--success-color, #4ade80); }
}

/* iOS-spezifische Fixes - Vereinfacht */
@supports (-webkit-touch-callout: none) {
  .app-nav {
    padding-bottom: max(env(safe-area-inset-bottom), 4px);
  }
}

/* Tablet Feintuning */
@media (min-width: 768px) {
  .app-nav {
    min-height: calc(56px + env(safe-area-inset-bottom));
  }
  .nav-list { padding: 6px 0; min-height: 56px; }
  .nav-btn { padding: 6px 12px; font-size: 0.75rem; min-height: 52px; min-width: 54px; }
  .icon { margin-bottom: 3px; }
  .icon-svg { width: 22px; height: 22px; }
  .label { font-size: 0.65rem; }
}

/* Desktop: Linke Sidebar statt Bottom-Bar */
@media (min-width: 1024px) {
  .app-nav {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: 240px;
    height: 100vh;
    padding: 16px 12px;
    background: transparent;
    border-right: 1px solid transparent;
    border-top: none;
    z-index: 1000;
  }
  .nav-list {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    padding: 0;
  }
  .nav-btn {
    flex-direction: row;
    justify-content: flex-start;
    gap: 10px;
    min-height: 44px;
    min-width: auto;
    border-radius: 12px;
    padding: 10px 12px;
  }
  .icon { margin-bottom: 0; }
  .icon-svg { width: 20px; height: 20px; }
  .label { font-size: 0.9rem; }
}
</style>
