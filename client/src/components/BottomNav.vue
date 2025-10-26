<template>
  <nav class="app-nav" role="navigation" aria-label="Hauptnavigation">
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
const links = [
  { label: "Home", path: "/dashboard", icon: "🏠" },
  { label: "Stats", path: "/stats", icon: "📊" },
  { label: "Übungen", path: "/exercises", icon: "💪" },
  { label: "Plan", path: "/plan", icon: "🧭" },
  { label: "Settings", path: "/settings", icon: "⚙️" }
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
  background: var(--surface);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid var(--card-border);
  z-index: 1000;
}
.nav-list { display: flex; justify-content: space-around; list-style: none; padding: 8px 0; padding-bottom: calc(8px + env(safe-area-inset-bottom)); margin: 0; }
.nav-btn { background: none; border: none; color: var(--fg); opacity: 0.85; display: flex; flex-direction: column; align-items: center; font-size: 0.75rem; padding: 8px 12px; cursor: pointer; transition: all 0.2s ease; border-radius: 10px; min-height: 60px; min-width: 56px; -webkit-tap-highlight-color: transparent; }
.nav-btn:hover, .nav-btn:active, .nav-btn.active { color: var(--accent-color); background: var(--accent-soft); }
.icon { font-size: 1.4rem; margin-bottom: 4px; line-height: 1; }
.label { font-size: 0.7rem; font-weight: 600; line-height: 1; }

/* Tablet Feintuning */
@media (min-width: 768px) {
  .nav-list { padding: 12px 0; padding-bottom: calc(12px + env(safe-area-inset-bottom)); }
  .nav-btn { padding: 10px 16px; font-size: 0.8rem; min-height: 70px; min-width: 64px; }
  .icon { font-size: 1.5rem; margin-bottom: 6px; }
  .label { font-size: 0.75rem; }
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
    background: var(--surface);
    border-right: 1px solid var(--card-border);
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
