<template>
  <div class="settings-view">
    <HeaderBar title="Einstellungen" />
    
    <div class="settings-content">
      <h2>App-Einstellungen</h2>

      <section class="card">
        <h3>Theme</h3>
        <p class="hint">Schalte zwischen hellem und dunklem Erscheinungsbild um.</p>
        <div class="theme-options">
          <label class="opt">
            <input type="radio" name="theme" value="light" :checked="theme === 'light'" @change="set('light')" />
            <span>Hell</span>
          </label>
          <label class="opt">
            <input type="radio" name="theme" value="dark" :checked="theme === 'dark'" @change="set('dark')" />
            <span>Dunkel</span>
          </label>
          <button class="toggle" @click="toggle">Umschalten</button>
        </div>
      </section>
    </div>

    <BottomNav />
  </div>
</template>

<script setup>
import HeaderBar from '../components/HeaderBar.vue'
import BottomNav from '../components/BottomNav.vue'
import { storeToRefs } from 'pinia'
import { useThemeStore } from '@/stores/themeStore'

const themeStore = useThemeStore()
const { theme } = storeToRefs(themeStore)
const set = (t) => themeStore.setTheme(t)
const toggle = () => themeStore.toggle()
</script>

<style scoped>
.settings-view {
  min-height: 100vh;
  background: var(--bg);
  color: var(--fg);
}

.settings-content {
  padding: 20px;
  padding-bottom: 80px; /* Platz für BottomNav */
}

.card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 16px;
}

.hint { color: var(--muted); margin: 4px 0 12px; }

.theme-options { display: flex; gap: 12px; align-items: center; }
.opt { display: inline-flex; gap: 8px; align-items: center; background: var(--surface); border: 1px solid var(--card-border); padding: 8px 10px; border-radius: 10px; }
.toggle { margin-left: auto; background: var(--accent); color: #fff; border: none; border-radius: 10px; padding: 10px 12px; }
</style>
