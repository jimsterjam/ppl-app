<template>
  <!-- Ziel-Abfrage beim Erstellen/Starten eines Workouts (einheitlich für Manuell, Favorit und
       Generator, siehe DashboardView.vue). Das gewählte Ziel wird am Workout gespeichert und ist
       im laufenden Workout fest (utils/workoutGoal.js). -->
  <div class="goal-picker">
    <p v-if="!hideQuestion" class="goal-picker-question">{{ t('workoutGoal.question') }}</p>
    <div class="goal-picker-options" role="radiogroup" :aria-label="t('workoutGoal.question')">
      <button
        v-for="opt in options"
        :key="opt.value"
        type="button"
        role="radio"
        class="goal-picker-btn"
        :class="{ active: modelValue === opt.value }"
        :aria-checked="modelValue === opt.value"
        @click="$emit('update:modelValue', opt.value)"
      >
        <span class="goal-picker-title">{{ opt.label }}</span>
        <span class="goal-picker-range">{{ opt.range }}</span>
      </button>
    </div>
    <p v-if="showError && !modelValue" class="goal-picker-error" role="alert">{{ t('workoutGoal.required') }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

defineProps({
  modelValue: { type: String, default: '' },
  showError: { type: Boolean, default: false },
  // Im Fenster steht die Frage bereits als Titel.
  hideQuestion: { type: Boolean, default: false }
})
defineEmits(['update:modelValue'])

const { t } = useI18n()

const options = computed(() => [
  { value: 'hypertrophy', label: t('quickGenerator.goalHypertrophy'), range: t('workoutGoal.rangeHypertrophy') },
  { value: 'strength', label: t('quickGenerator.goalStrength'), range: t('workoutGoal.rangeStrength') }
])
</script>

<style scoped>
.goal-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.goal-picker-question {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--fg-strong);
}

.goal-picker-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.goal-picker-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-height: 52px;
  padding: 8px 10px;
  border-radius: calc(var(--panel-radius) - 16px);
  border: 1px solid var(--line-strong);
  background: var(--bg-panel);
  color: var(--fg);
  font: inherit;
  cursor: pointer;
}

.goal-picker-btn.active {
  border: 2px solid var(--accent);
  padding: 7px 9px;
  background: color-mix(in srgb, var(--accent) 10%, var(--bg-panel));
}

.goal-picker-title {
  font-weight: 700;
  font-size: 0.95rem;
}

.goal-picker-range {
  font-size: 0.75rem;
  color: var(--muted);
}

.goal-picker-error {
  margin: 0;
  font-size: 0.8rem;
  color: var(--danger-text, var(--danger));
}
</style>
