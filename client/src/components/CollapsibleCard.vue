<template>
  <section class="card collapsible" :class="{ open }">
    <button type="button" class="cc-head" :aria-expanded="open" :aria-controls="bodyId" @click="open = !open">
      <h3 class="cc-title card-title">{{ title }}</h3>
      <span class="cc-chevron" aria-hidden="true"></span>
    </button>
    <div v-if="open" :id="bodyId" class="cc-body">
      <slot />
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'

// Karte mit aufklappbarem Inhalt: standardmäßig zu, Tippen auf den Titel klappt auf (Einstellungen).
const props = defineProps({
  title: { type: String, required: true },
  initialOpen: { type: Boolean, default: false }
})
const open = ref(props.initialOpen)
const bodyId = `cc-body-${Math.random().toString(36).slice(2, 9)}`
</script>

<style scoped>
.cc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: 44px;
  margin: -8px 0;
  padding: 8px 0;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.danger-zone .cc-title { color: var(--danger); border-left-color: var(--danger); }
.dev-tools .cc-title { color: #22c55e; border-left-color: #22c55e; }
.cc-chevron {
  flex: 0 0 auto;
  width: 9px;
  height: 9px;
  border-right: 2px solid var(--muted);
  border-bottom: 2px solid var(--muted);
  transform: rotate(45deg);
  transition: transform 0.15s ease;
}
.open .cc-chevron { transform: rotate(-135deg); }
.cc-body { margin-top: 14px; }
</style>
