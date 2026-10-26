<template>
  <!-- Einstellungs-Bereich (Absprache Paul 26.10.): Karte mit Titel und Pfeil wie in den FAQ; Tippen öffnet ein
       Fenster (Overlay) mit dem Inhalt. Ersetzt die frühere Aufklapp-Karte (CollapsibleCard). -->
  <button type="button" class="card section-card" v-bind="$attrs" :aria-haspopup="'dialog'" @click="open = true">
    <h3 class="card-title sc-title">{{ title }}</h3>
    <span class="sc-chevron" aria-hidden="true"></span>
  </button>

  <Teleport to="body">
    <Transition name="modal" appear>
      <div v-if="open" class="sc-overlay" @click="close">
        <div class="sc-modal" role="dialog" aria-modal="true" :aria-label="title" @click.stop>
          <div class="sc-modal-header">
            <h4>{{ title }}</h4>
            <button type="button" class="sc-close" :aria-label="$t('common.close')" @click="close">
              <span>×</span>
            </button>
          </div>
          <div :id="bodyId" class="sc-modal-body">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { useScrollLock } from '@/composables/useScrollLock'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  title: { type: String, required: true },
  initialOpen: { type: Boolean, default: false }
})
const open = ref(props.initialOpen)
const bodyId = `sc-body-${Math.random().toString(36).slice(2, 9)}`

function close() {
  open.value = false
}
function onKeydown(event) {
  if (event.key === 'Escape') close()
}

// Modal-Muster der App: Hintergrund nicht scrollbar, solange das Fenster offen ist.
const { lock, unlock } = useScrollLock()
watch(open, (isOpen) => {
  if (isOpen) {
    lock()
    document.addEventListener('keydown', onKeydown)
  } else {
    unlock()
    document.removeEventListener('keydown', onKeydown)
  }
}, { immediate: true })
onBeforeUnmount(() => {
  unlock()
  document.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.section-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: 60px;
  color: var(--fg);
  font: inherit;
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.section-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.danger-zone .sc-title { color: var(--danger); border-left-color: var(--danger); }
.dev-tools .sc-title { color: #22c55e; border-left-color: #22c55e; }
.sc-chevron {
  flex: 0 0 auto;
  width: 9px;
  height: 9px;
  border-right: 2px solid var(--muted);
  border-bottom: 2px solid var(--muted);
  transform: rotate(-45deg);
}

.sc-overlay {
  position: fixed;
  inset: 0;
  background: color-mix(in oklab, #000000 40%, transparent);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 1000;
}
.sc-modal {
  background: var(--surface);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  max-width: 600px;
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 40px color-mix(in oklab, #000000 20%, transparent);
  color: var(--fg);
}
.sc-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px 0 20px;
  border-bottom: 1px solid var(--card-border);
  margin-bottom: 20px;
}
.sc-modal-header h4 { margin: 0; font-size: 18px; font-weight: 600; color: var(--fg); }
.sc-close {
  background: transparent;
  border: none;
  font-size: 24px;
  color: var(--muted);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.2s ease;
}
.sc-close:hover { background: color-mix(in oklab, var(--fg) 8%, transparent); color: var(--fg); }
.sc-modal-body { padding: 0 20px 20px 20px; }

.modal-enter-active, .modal-leave-active { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.modal-enter-from, .modal-leave-to { opacity: 0; transform: scale(0.95); }
.modal-enter-active .sc-modal, .modal-leave-active .sc-modal { transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.modal-enter-from .sc-modal, .modal-leave-to .sc-modal { transform: scale(0.9) translateY(20px); }

@media (max-width: 480px) {
  .sc-overlay { padding: 12px; }
  .sc-modal { max-height: 85vh; }
  .sc-modal-header { padding: 16px 16px 0 16px; margin-bottom: 16px; }
  .sc-modal-header h4 { font-size: 16px; }
  .sc-modal-body { padding: 0 16px 16px 16px; }
}
</style>
