<template>
  <teleport to="body">
    <div v-if="modelValue" class="modal-overlay" role="presentation" @click.self="onCancel">
      <div
        class="modal"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="title ? 'modal-title' : null"
      >
        <div class="modal-header">
          <h3 v-if="title" id="modal-title">{{ title }}</h3>
          <button class="close" aria-label="Schließen" @click="onCancel">✕</button>
        </div>
        <div class="modal-body">
          <slot>
            <p v-if="message">{{ message }}</p>
          </slot>
        </div>
        <div class="modal-actions">
          <button class="btn secondary" @click="onCancel">{{ cancelText }}</button>
          <button ref="confirmBtn" class="btn primary" :class="type" @click="onConfirm">{{ confirmText }}</button>
        </div>
      </div>
    </div>
  </teleport>
  </template>

<script setup>
import { onBeforeUnmount, nextTick, watch, ref } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  message: { type: String, default: '' },
  confirmText: { type: String, default: 'Bestätigen' },
  cancelText: { type: String, default: 'Abbrechen' },
  type: { type: String, default: 'danger' } // danger | warning | info
})

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel'])

const confirmBtn = ref(null)

function close() { emit('update:modelValue', false) }
function onCancel() { emit('cancel'); close() }
function onConfirm() { emit('confirm'); close() }

function onKey(e) {
  if (e.key === 'Escape') { onCancel() }
}

watch(() => props.modelValue, async (open) => {
  if (open) {
    await nextTick()
    confirmBtn.value?.focus?.()
    window.addEventListener('keydown', onKey)
  } else {
    window.removeEventListener('keydown', onKey)
  }
})

onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal { width: min(520px, calc(100% - 32px)); background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 14px; box-shadow: 0 10px 30px rgba(0,0,0,0.4); color: var(--fg); }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--card-border); }
.modal-header h3 { margin: 0; font-size: 1.1rem; }
.modal-header .close { background: transparent; border: none; color: var(--muted); cursor: pointer; font-size: 18px; }
.modal-body { padding: 16px; color: var(--muted); }
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px 16px;
}
.btn { padding: 10px 14px; border-radius: 10px; border: 1px solid transparent; cursor: pointer; font-weight: 600; }
.btn.secondary { background: var(--surface); border-color: var(--card-border); color: var(--fg); }
.btn.primary { background: var(--accent); color: var(--accent-contrast); }
.btn.primary.warning { background: color-mix(in oklab, var(--warning-color) 60%, var(--accent-color)); color: #fff; }
.btn.primary.info { background: color-mix(in oklab, #3b82f6 60%, var(--accent-color)); color: #fff; }
.btn:hover { filter: brightness(1.02); }
.btn:active { transform: translateY(1px); }
</style>