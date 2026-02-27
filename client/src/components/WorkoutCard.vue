<template>
  <div class="workout-card" :class="{ active }">
    <button class="card-hit" type="button" @click="onClick">
      <span class="workout-label">{{ label }}</span>
    </button>
    <button
      v-if="infoLabel"
      class="info-btn"
      type="button"
      :aria-label="infoLabel"
      @click.stop="onInfo"
    >i</button>
  </div>
</template>

<script setup>
const emit = defineEmits(['click'])

const props = defineProps({
  label: { type: String, required: true },
  active: { type: Boolean, default: false },
  infoLabel: { type: String, default: '' }
})

const onClick = () => emit('click')
const onInfo = () => emit('info', props.label)
</script>

<style scoped>
.workout-card {
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: calc(var(--panel-radius) - 16px);
  border: 1px solid color-mix(in srgb, var(--accent) 25%, var(--line-strong));
  background: var(--bg-panel);
  box-shadow: var(--shadow-soft);
  color: var(--fg-strong);
  font-family: "Sora", "Space Grotesk", "SF Pro Display", sans-serif;
  font-size: clamp(1.1rem, 2.4vw, 1.6rem);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  transition: transform 120ms ease, border-color 120ms ease, box-shadow 120ms ease, background-color 120ms ease;
  position: relative;
}

.card-hit {
  width: 100%;
  height: 100%;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  text-transform: inherit;
  letter-spacing: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  cursor: pointer;
}
.info-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 13px;
  height: 13px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--line-strong));
  background: var(--bg-panel);
  color: var(--fg-strong);
  font-weight: 800;
  font-size: 0.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  text-transform: none;
  letter-spacing: normal;
}

.info-btn:hover {
  background: color-mix(in srgb, var(--bg-panel) 85%, var(--fg) 6%);
}


.workout-card:hover {
  background: color-mix(in srgb, var(--card-bg) 85%, var(--fg) 5%);
}

.card-hit:active {
  transform: scale(0.97);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 70%, transparent),
    0 0 18px color-mix(in srgb, var(--accent) 40%, transparent);
}

.workout-card.active {
  border: 2px solid var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 45%, transparent), var(--shadow-hard);
}

@media (prefers-reduced-motion: reduce) {
  .workout-card {
    transition: none;
  }
}
</style>
