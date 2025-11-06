<template>
  <!-- Single top toaster: alle Nachrichten oben anzeigen -->
  <div class="toast-host top" aria-live="polite" aria-atomic="true" v-if="messages.length">
    <transition-group name="toast" tag="div">
      <div v-for="m in messages" :key="m.id" class="toast" :class="m.type">
        <span class="icon">{{ 
          m.type === 'success' ? '✅' : 
          m.type === 'error' ? '❌' : 
          m.type === 'warning' ? '⚠️' : 
          'ℹ️' 
        }}</span>
        <span class="text">{{ m.text }}</span>
        <button class="close" :aria-label="t('common.close')" @click="toast.dismiss(m.id)">✕</button>
      </div>
    </transition-group>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useToastStore } from '@/stores/toastStore'
import { useI18n } from 'vue-i18n'

const toast = useToastStore()
const messages = computed(() => toast.messages)
const { t } = useI18n()
</script>

<style scoped>
.toast-host {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 9999;
  pointer-events: none;
}
.toast-host.top { top: 16px; }
.toast-host.bottom { display: none; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(8px); }
.toast-enter-active, .toast-leave-active { transition: all .2s ease; }
.toast { 
  pointer-events: auto; 
  display: flex; 
  align-items: center; 
  gap: 10px; 
  background: var(--bg-primary, #ffffff); 
  color: var(--text-primary, #000000); 
  border: 1px solid var(--border-color, #e5e5e5); 
  padding: 10px 12px; 
  border-radius: 10px; 
  min-width: 240px; 
  max-width: 90vw; 
  box-shadow: 0 8px 24px rgba(0,0,0,0.4); 
}
.toast.success { 
  border-color: #22c55e; 
  background: color-mix(in srgb, #22c55e 10%, var(--bg-primary, #ffffff)); 
  box-shadow: 0 8px 24px rgba(34, 197, 94, 0.2); 
}
.toast.error { 
  border-color: #ef4444; 
  background: color-mix(in srgb, #ef4444 10%, var(--bg-primary, #ffffff)); 
  box-shadow: 0 8px 24px rgba(239, 68, 68, 0.2); 
}
.toast.info { 
  border-color: #3b82f6; 
  background: color-mix(in srgb, #3b82f6 10%, var(--bg-primary, #ffffff)); 
  box-shadow: 0 8px 24px rgba(59, 130, 246, 0.2); 
}
.toast.warning { 
  border-color: #f59e0b; 
  background: color-mix(in srgb, #f59e0b 10%, var(--bg-primary, #ffffff)); 
  box-shadow: 0 8px 24px rgba(245, 158, 11, 0.2); 
}
.icon { font-size: 1.1rem; }
.text { font-size: .95rem; }
.close { 
  margin-left: auto; 
  background: transparent; 
  border: none; 
  color: var(--text-secondary, #666666); 
  cursor: pointer; 
  padding: 2px 4px;
  border-radius: 4px;
  transition: all 0.2s ease;
}
.close:hover { 
  color: var(--text-primary, #000000); 
  background: var(--bg-secondary, #f5f5f5);
}
</style>
