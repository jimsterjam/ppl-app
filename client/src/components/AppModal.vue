<template>
  <teleport to="body">
    <div v-if="modelValue" class="modal-overlay" role="presentation" @click.self="overlayClick">
      <div
        :class="['modal', 'glass-strong', type, modalClass]"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="title ? 'modal-title' : null"
      >
        <div class="modal-header">
          <h3 v-if="title" id="modal-title">{{ title }}</h3>
          <button v-if="!persistent && showCancel" class="close" :aria-label="t('common.close')" @click="onCancel">✕</button>
        </div>
        <div class="modal-body">
          <slot>
            <p v-if="message">{{ message }}</p>
          </slot>
        </div>
        <div class="modal-actions">
          <button v-if="showCancel" class="btn secondary" @click="onCancel">{{ cancelText || t('common.cancel') }}</button>
          <button ref="confirmBtn" class="btn primary" :class="type" @click="onConfirm">{{ confirmText || t('common.confirm') }}</button>
        </div>
      </div>
    </div>
  </teleport>
  </template>

<script setup>
import { onBeforeUnmount, nextTick, watch, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  message: { type: String, default: '' },
  confirmText: { type: String, default: '' },
  cancelText: { type: String, default: '' },
  type: { type: String, default: 'danger' }, // danger | warning | info
  modalClass: { type: String, default: '' },
  showCancel: { type: Boolean, default: true },
  persistent: { type: Boolean, default: false },
  closeOnConfirm: { type: Boolean, default: true }
})

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel'])
const { t } = useI18n()

const confirmBtn = ref(null)

function close() { emit('update:modelValue', false) }
function onCancel() { emit('cancel'); close() }
function onConfirm() {
  emit('confirm')
  if (props.closeOnConfirm) close()
}

function overlayClick() {
  if (!props.persistent) onCancel()
}

function onKey(e) {
  if (e.key === 'Escape' && !props.persistent) { onCancel() }
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
  background: color-mix(in srgb, black 52%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal {
  width: min(520px, calc(100% - 32px));
  max-height: min(88vh, 760px);
  display: flex;
  flex-direction: column;
  background: color-mix(in srgb, var(--card-bg) 96%, black 4%);
  border: 1px solid color-mix(in srgb, var(--card-border) 88%, transparent);
  border-radius: 16px;
  box-shadow: 0 18px 48px rgba(0,0,0,0.34);
  color: var(--fg);
}
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid color-mix(in srgb, var(--card-border) 82%, transparent); }
.modal-header h3 { margin: 0; font-size: 1.1rem; }
.modal-header .close {
  background: color-mix(in srgb, var(--surface) 82%, transparent);
  border: 1px solid color-mix(in srgb, var(--card-border) 80%, transparent);
  color: var(--muted);
  cursor: pointer;
  font-size: 18px;
  width: 34px;
  height: 34px;
  border-radius: 10px;
}
.modal-body {
  padding: 16px;
  color: var(--fg);
  overflow-y: auto;
}
.modal-body p {
  margin: 0;
  padding: 12px 14px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--surface) 94%, transparent);
  border: 1px solid color-mix(in srgb, var(--card-border) 78%, transparent);
  line-height: 1.5;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px 16px;
  border-top: 1px solid color-mix(in srgb, var(--card-border) 78%, transparent);
  background: color-mix(in srgb, var(--card-bg) 94%, transparent);
}
.btn { padding: 10px 14px; border-radius: 10px; border: 1px solid transparent; cursor: pointer; font-weight: 600; }
.btn.secondary { background: var(--surface); border-color: var(--card-border); color: var(--fg); }
.btn.primary { background: var(--accent); color: var(--accent-contrast); }
/* .btn.primary.warning { background: color-mix(in oklab, var(--warning-color) 60%, var(--accent-color)); color: #fff; } */
.btn.primary.info { background: color-mix(in oklab, #3b82f6 60%, var(--accent-color)); color: #fff; }
.btn:hover { filter: brightness(1.02); }
.btn:active { transform: translateY(1px); }

[data-theme="dark"] .modal.glass-strong,
[data-theme="system"] .modal.glass-strong {
  background: color-mix(in srgb, #10161f 92%, var(--card-bg) 8%);
  border-color: rgba(255, 255, 255, 0.08);
}

[data-theme="light"] .modal.glass-strong {
  background: color-mix(in srgb, white 97%, var(--surface) 3%);
  -webkit-backdrop-filter: blur(18px) saturate(1.2);
  backdrop-filter: blur(18px) saturate(1.2);
  border: 1px solid rgba(0, 0, 0, 0.14);
  box-shadow: 0 14px 42px rgba(0, 0, 0, 0.18);
}
[data-theme="light"] .modal-header { border-bottom-color: rgba(0, 0, 0, 0.08); }
[data-theme="light"] .modal-body { color: var(--fg); }
[data-theme="light"] .modal-body p {
  background: color-mix(in srgb, white 96%, var(--surface) 4%);
  border-color: color-mix(in srgb, var(--card-border) 84%, black 16%);
}

@media (max-width: 640px) {
  .modal-overlay {
    align-items: flex-end;
  }

  .modal {
    width: calc(100% - 16px);
    max-height: min(92vh, 860px);
    border-bottom-left-radius: 10px;
    border-bottom-right-radius: 10px;
    margin-bottom: 8px;
  }
}
</style>