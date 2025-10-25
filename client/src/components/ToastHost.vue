<template>
  <div class="toast-host" aria-live="polite" aria-atomic="true">
    <transition-group name="toast" tag="div">
      <div v-for="m in toast.messages" :key="m.id" class="toast" :class="m.type">
        <span class="icon">{{ m.type === 'success' ? '✅' : m.type === 'error' ? '⚠️' : 'ℹ️' }}</span>
        <span class="text">{{ m.text }}</span>
        <button class="close" @click="toast.dismiss(m.id)" aria-label="Schließen">✕</button>
      </div>
    </transition-group>
  </div>
  
</template>

<script setup>
import { useToastStore } from '@/stores/toastStore'
const toast = useToastStore()
</script>

<style scoped>
.toast-host {
  position: fixed;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 9999;
  pointer-events: none;
}
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(8px); }
.toast-enter-active, .toast-leave-active { transition: all .2s ease; }
.toast { pointer-events: auto; display: flex; align-items: center; gap: 10px; background: var(--card-bg); color: var(--fg); border: 1px solid var(--card-border); padding: 10px 12px; border-radius: 10px; min-width: 240px; max-width: 90vw; box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
.toast.success { border-color: color-mix(in oklab, var(--success-color) 50%, transparent); box-shadow: 0 8px 24px color-mix(in oklab, var(--success-color) 20%, transparent); }
.toast.error { border-color: color-mix(in oklab, var(--danger-color) 50%, transparent); box-shadow: 0 8px 24px color-mix(in oklab, var(--danger-color) 20%, transparent); }
.toast.info { border-color: color-mix(in oklab, #3b82f6 50%, transparent); box-shadow: 0 8px 24px color-mix(in oklab, #3b82f6 20%, transparent); }
.icon { font-size: 1.1rem; }
.text { font-size: .95rem; }
.close { margin-left: auto; background: transparent; border: none; color: var(--muted); cursor: pointer; }
.close:hover { color: var(--fg); }
</style>
