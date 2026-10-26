<template>
  <!-- Schieberegler (Schalter an/aus) - z. B. "KI-Auswertungen erlauben" in den Einstellungen. -->
  <label class="toggle-switch" :class="{ 'is-on': modelValue, 'is-disabled': disabled }">
    <span class="toggle-label"><slot /></span>
    <button
      type="button"
      class="toggle-track"
      role="switch"
      :aria-checked="modelValue ? 'true' : 'false'"
      :disabled="disabled"
      @click="$emit('update:modelValue', !modelValue)"
    >
      <span class="toggle-thumb"></span>
    </button>
  </label>
</template>

<script setup>
defineProps({
  modelValue: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false }
})
defineEmits(['update:modelValue'])
</script>

<style scoped>
.toggle-switch { display: flex; align-items: center; justify-content: space-between; gap: 14px; cursor: pointer; }
.toggle-label { flex: 1; min-width: 0; color: var(--fg); font-weight: 600; }
.toggle-track {
  position: relative;
  flex: 0 0 auto;
  box-sizing: border-box;
  width: 52px;
  min-width: 52px;
  height: 32px;
  min-height: 32px;
  padding: 0;
  line-height: 0;
  border-radius: 999px;
  border: 1px solid var(--line-strong, var(--card-border));
  background: var(--surface);
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}
.toggle-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--muted);
  transition: transform 0.2s ease, background 0.2s ease;
}
.is-on .toggle-track { background: var(--accent); border-color: var(--accent); }
.is-on .toggle-thumb { transform: translateX(20px); background: var(--accent-contrast, #060606); }
.toggle-track:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.is-disabled, .is-disabled .toggle-track { opacity: 0.5; cursor: default; }
</style>
