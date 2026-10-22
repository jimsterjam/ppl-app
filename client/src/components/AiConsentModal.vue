<template>
  <Teleport to="body">
    <div v-if="store.modalOpen" class="modal-overlay" role="dialog" aria-modal="true" :aria-label="t('aiConsent.title')">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ t('aiConsent.title') }}</h3>
        </div>
        <div class="modal-body">
          <p class="text">{{ t('aiConsent.intro') }}</p>
          <ul class="list">
            <li>{{ t('aiConsent.item1') }}</li>
            <li>{{ t('aiConsent.item2') }}</li>
            <li>{{ t('aiConsent.item3') }}</li>
          </ul>
          <p class="text">{{ t('aiConsent.notSent') }}</p>
          <p class="text">{{ t('aiConsent.disclaimer') }}</p>
          <p class="text small">{{ t('aiConsent.revokeHint') }}</p>
          <p v-if="store.saveFailed" class="error" role="alert">{{ t('aiConsent.saveError') }}</p>
        </div>
        <div class="modal-actions">
          <button type="button" class="cancel-btn" :disabled="store.saving" @click="store.decline()">
            {{ t('aiConsent.decline') }}
          </button>
          <button type="button" class="accept-btn" :disabled="store.saving" @click="store.accept()">
            {{ store.saving ? t('aiConsent.saving') : t('aiConsent.accept') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { watch, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAiConsentStore } from '@/stores/aiConsentStore'
import { useScrollLock } from '@/composables/useScrollLock'

const { t } = useI18n()
const store = useAiConsentStore()
const { lock, unlock } = useScrollLock()

watch(() => store.modalOpen, (open) => (open ? lock() : unlock()), { immediate: true })
onBeforeUnmount(unlock)
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
  padding: 20px;
}
.modal-content {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  max-width: 500px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  max-height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
}
.modal-header { padding: 24px 24px 0; margin-bottom: 12px; }
.modal-header h3 { color: var(--fg); margin: 0; font-size: 1.3rem; font-weight: 600; }
.modal-body { padding: 0 24px 16px; overflow: auto; }
.text { color: var(--fg); margin: 0 0 12px; line-height: 1.5; font-size: 0.95rem; }
.text.small { color: var(--muted); font-size: 0.85rem; }
.list { margin: 0 0 12px; padding-left: 20px; color: var(--fg); line-height: 1.5; font-size: 0.95rem; }
.error { color: var(--danger); margin: 0 0 12px; font-size: 0.9rem; }
.modal-actions { display: flex; gap: 12px; justify-content: flex-end; padding: 0 24px 24px; }
.cancel-btn, .accept-btn {
  min-height: 44px;
  padding: 10px 16px;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
}
.cancel-btn { background: transparent; color: var(--fg); border: 1px solid var(--line-strong); }
.accept-btn { background: var(--accent); color: var(--accent-contrast, #060606); border: none; }
.cancel-btn:disabled, .accept-btn:disabled { opacity: 0.6; cursor: default; }
</style>
