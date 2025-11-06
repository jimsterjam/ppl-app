<template>
  <div class="step-indicator">
    <div
      v-for="(s, i) in steps"
      :key="s"
      class="step"
      :class="{ active: i + 1 <= active, current: i + 1 === active }"
    >
      <span class="dot">{{ i + 1 }}</span>
      <span class="label">{{ s }}</span>
      <span v-if="i < steps.length - 1" class="bar" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  active: { type: Number, default: 1 },
  steps: { type: Array, default: () => [] }
})
const { t } = useI18n()
const steps = computed(() => {
  return props.steps && props.steps.length
    ? props.steps
    : [t('builder.stepType'), t('builder.stepExercises'), t('builder.stepReview')]
})
</script>

<style scoped>
.step-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0 12px 0;
}
.step {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dot {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--surface);
  color: var(--muted);
  border: 1px solid var(--card-border);
  font-weight: 600;
}
.label { color: var(--muted); font-size: 0.9rem; }
.bar { width: 28px; height: 2px; background: var(--card-border); margin: 0 6px 0 2px; display: inline-block; }
.active .dot { background: var(--accent-color); color: #fff; border-color: var(--accent-color); }
.current .label { color: var(--fg); }
.active ~ .step .dot { background: var(--surface); color: var(--muted); }
</style>
