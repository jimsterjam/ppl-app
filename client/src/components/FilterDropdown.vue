<template>
  <!-- Filter-Auswahl im Karten-Look der FAQ/Einstellungen (Absprache Paul 26.10.): Knopf mit Beschriftung, Wert und Pfeil,
       darunter öffnet ein eigenes Dropdown im gleichen Stil statt der Systemauswahl. -->
  <div ref="root" class="fd" :class="{ open }">
    <button
      type="button"
      class="card fd-btn"
      :aria-haspopup="'listbox'"
      :aria-expanded="open ? 'true' : 'false'"
      @click="open = !open"
    >
      <span class="fd-text">
        <span class="fd-label">{{ label }}</span>
        <span class="fd-value">{{ currentLabel }}</span>
      </span>
      <span class="fd-chevron" aria-hidden="true"></span>
    </button>
    <ul v-if="open" class="fd-list" :class="`fd-list--${align}`" role="listbox" :aria-label="label">
      <li v-for="opt in allOptions" :key="opt.value">
        <button
          type="button"
          class="fd-option"
          :class="{ selected: opt.value === modelValue }"
          role="option"
          :aria-selected="opt.value === modelValue ? 'true' : 'false'"
          @click="choose(opt.value)"
        >
          <span>{{ opt.label }}</span>
          <span v-if="opt.value === modelValue" class="fd-check" aria-hidden="true">✓</span>
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  label: { type: String, required: true },
  modelValue: { type: String, default: '' },
  // [{ value, label }] - der Eintrag für "Alle" (leerer Wert) kommt automatisch dazu.
  options: { type: Array, default: () => [] },
  allLabel: { type: String, required: true },
  // Ausrichtung der Liste unter dem Knopf (rechte Spalte: 'end', damit sie nicht über den Rand ragt).
  align: { type: String, default: 'start' }
})
const emit = defineEmits(['update:modelValue', 'change'])

const root = ref(null)
const open = ref(false)

const allOptions = computed(() => [{ value: '', label: props.allLabel }, ...props.options])
const currentLabel = computed(() => allOptions.value.find((o) => o.value === props.modelValue)?.label || props.allLabel)

function choose(value) {
  open.value = false
  emit('update:modelValue', value)
  emit('change', value)
}

function onOutside(event) {
  if (root.value && !root.value.contains(event.target)) open.value = false
}
function onKeydown(event) {
  if (event.key === 'Escape') open.value = false
}
watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener('pointerdown', onOutside, true)
    document.addEventListener('keydown', onKeydown)
  } else {
    document.removeEventListener('pointerdown', onOutside, true)
    document.removeEventListener('keydown', onKeydown)
  }
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onOutside, true)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.fd { position: relative; min-width: 0; }
.fd-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  min-height: 60px;
  padding: 10px 14px;
  color: var(--fg);
  font: inherit;
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.fd-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.open .fd-btn { border-color: var(--accent); }
.fd-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.fd-label { font-size: 0.78rem; color: var(--muted); }
.fd-value {
  font-family: var(--font-heading);
  font-weight: 700;
  font-size: 1rem;
  padding-left: 8px;
  border-left: 3px solid var(--accent);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fd-chevron {
  flex: 0 0 auto;
  width: 9px;
  height: 9px;
  border-right: 2px solid var(--muted);
  border-bottom: 2px solid var(--muted);
  transform: rotate(45deg);
  transition: transform 0.15s ease;
}
.open .fd-chevron { transform: rotate(-135deg); }

.fd-list {
  position: absolute;
  top: calc(100% + 6px);
  z-index: 60;
  min-width: max(100%, 200px);
  max-height: 280px;
  overflow-y: auto;
  margin: 0;
  padding: 6px;
  list-style: none;
  background: var(--surface);
  border: 1px solid var(--card-border);
  border-radius: var(--card-radius);
  box-shadow: 0 16px 32px color-mix(in oklab, #000000 28%, transparent);
}
.fd-list--start { left: 0; }
.fd-list--end { right: 0; }
.fd-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  min-height: 44px;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--fg);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.fd-option:hover, .fd-option:focus-visible { background: color-mix(in srgb, var(--fg) 8%, transparent); outline: none; }
.fd-option.selected { font-weight: 700; color: var(--accent-text, var(--accent)); }
.fd-check { color: var(--accent); }
</style>
