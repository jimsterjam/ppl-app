<template>
  <nav class="app-nav glass" :class="{ 'ios-device': isIOS }" role="navigation" :aria-label="$t('nav.ariaMain')">
    <ul class="nav-list">
      <li v-for="link in links" :key="link.path">
        <button
          class="nav-btn"
          :class="{ active: $route.path.startsWith(link.path) }"
          :aria-current="$route.path.startsWith(link.path) ? 'page' : undefined"
          @click="$router.push(link.path)"
        >
          <span class="icon" aria-hidden="true">{{ link.icon }}</span>
          <span class="label">{{ link.label }}</span>
        </button>
      </li>
    </ul>
  </nav>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { ref, onMounted } from 'vue'

const { t } = useI18n()
const isIOS = ref(false)

onMounted(() => {
  // Detect iOS/iPhone Simulator
  isIOS.value = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
})

const links = [
  { get label() { return t('nav.home') }, path: "/dashboard", icon: "🏠" }, // Alternative: 🏃‍♂️ 🎯 📱
  { get label() { return t('nav.stats') }, path: "/stats", icon: "�" }, // Besser als 📊
  { get label() { return t('nav.exercises') }, path: "/exercises", icon: "🏋️‍♂️" }, // Besser als 💪
  { get label() { return t('nav.faqs') }, path: "/faqs", icon: "❓" }, // Alternative: 💬 📚 🛟
  { get label() { return t('nav.settings') }, path: "/settings", icon: "⚙️" } // Alternative: 🔧 👤 ⭐
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
  background: color-mix(in srgb, var(--surface) 40%, transparent);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-top: 1px solid color-mix(in srgb, var(--card-border) 20%, transparent);
  box-shadow: 0 -2px 16px color-mix(in srgb, black 6%, transparent);
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
.nav-btn { background: none; border: none; color: var(--fg); opacity: 0.7; display: flex; flex-direction: column; align-items: center; font-size: 0.7rem; padding: 4px 8px; cursor: pointer; transition: all 0.2s ease; border-radius: 8px; min-height: 46px; min-width: 46px; -webkit-tap-highlight-color: transparent; }
.nav-btn:hover, .nav-btn:active, .nav-btn.active { color: var(--accent-color); opacity: 1; background: color-mix(in srgb, var(--accent-color) 8%, transparent); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
.icon { font-size: 1.2rem; margin-bottom: 2px; line-height: 1; }
.label { font-size: 0.6rem; font-weight: 600; line-height: 1; }

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
  .icon { font-size: 1.3rem; margin-bottom: 3px; }
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
  .icon { margin-bottom: 0; font-size: 1.1rem; }
  .label { font-size: 0.9rem; }
}
</style>
