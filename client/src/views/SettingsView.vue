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

      <section class="card">
        <h3>Wochenziel</h3>
        <p class="hint">Lege fest, wie viele Workouts du pro Woche schaffen möchtest.</p>
        <div class="goal-row">
          <input
            type="range"
            min="1"
            max="14"
            :value="weeklyGoal"
            @input="onRange($event)"
          />
          <div class="goal-input">
            <button class="step" @click="dec">−</button>
            <input type="number" min="1" max="14" :value="weeklyGoal" @input="onInput($event)"/>
            <button class="step" @click="inc">+</button>
          </div>
          <span class="goal-badge">{{ weeklyGoal }} pro Woche</span>
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
import { useSettingsStore } from '@/stores/settingsStore'

const themeStore = useThemeStore()
const { theme } = storeToRefs(themeStore)
const set = (t) => themeStore.setTheme(t)
const toggle = () => themeStore.toggle()

// Wochenziel
const settings = useSettingsStore()
const { weeklyGoal } = storeToRefs(settings)
function setGoal(v) { settings.setWeeklyGoal(v) }
function onInput(e) { setGoal(e.target.value) }
function onRange(e) { setGoal(e.target.value) }
function inc() { setGoal((weeklyGoal.value || 4) + 1) }
function dec() { setGoal((weeklyGoal.value || 4) - 1) }

// Toast-Settings entfernt – Toaster ist fest oben
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

.goal-row { display: grid; grid-template-columns: 1fr auto auto; gap: 12px; align-items: center; }
.goal-input { display: inline-flex; align-items: center; border: 1px solid var(--card-border); border-radius: 10px; overflow: hidden; }
.goal-input input { width: 72px; text-align: center; border: none; padding: 10px; background: var(--surface); color: var(--fg); }
.goal-input .step { background: var(--surface); color: var(--fg); border: none; padding: 10px 12px; cursor: pointer; }
.goal-badge { background: var(--surface); border: 1px solid var(--card-border); padding: 6px 10px; border-radius: 999px; color: var(--muted); font-size: 0.9rem; }

/* Toast Einstellungen entfernt */
</style>
