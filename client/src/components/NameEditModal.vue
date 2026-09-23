<template>
  <Teleport to="body">
  <Transition name="modal" appear>
    <div v-if="modelValue" class="modal-overlay" @click.self="close">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ $t('settings.username') }}</h3>
          <button class="close-btn" @click="close" :aria-label="$t('common.close')">×</button>
        </div>
        <div class="modal-body">
          <p class="hint" style="margin-top:0">{{ $t('settings.usernameHint') }}</p>
          <input
            ref="inputRef"
            class="text-input"
            type="text"
            :placeholder="$t('settings.usernamePlaceholder')"
            v-model="nameDraft"
            autocomplete="nickname"
            maxlength="24"
            @keyup.enter="save"
          />
          <div class="modal-actions" style="margin-top: 16px;">
            <button class="cancel-btn" type="button" :disabled="saving" @click="close">
              {{ $t('common.cancel') }}
            </button>
            <button class="save-btn" type="button" :disabled="saving" @click="save">
              {{ saving ? $t('common.saving') : $t('common.save') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
  </Teleport>
</template>

<script setup>
// Kleines, eigenständiges Modal zum Bearbeiten des Anzeigenamens - direkt aus dem Dashboard
// aufrufbar (User-Feedback: Name soll nicht mehr über einen Umweg über die Settings-Seite
// geändert werden). Übernimmt die Speicherlogik 1:1 aus SettingsView.vue (saveUsername()).
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settingsStore'
import { useToastStore } from '@/stores/toastStore'
import { initFirebaseAuth, useFirebaseAuth } from '@/utils/firebaseAuth'
import { logger } from '@/utils/logger'
import { useScrollLock } from '@/composables/useScrollLock'

const { t: $t } = useI18n()
const settings = useSettingsStore()
const toast = useToastStore()

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
})
const emit = defineEmits(['update:modelValue'])

const nameDraft = ref(settings.username || '')
const saving = ref(false)
const inputRef = ref(null)

// Beim Öffnen den aktuellen Namen als Ausgangswert übernehmen und das Feld fokussieren.
const { lock: lockBodyScroll, unlock: unlockBodyScroll } = useScrollLock()
watch(() => props.modelValue, async (open) => {
  if (open) {
    nameDraft.value = settings.username || ''
    lockBodyScroll()
    await nextTick()
    inputRef.value?.focus()
  } else {
    unlockBodyScroll()
  }
})
onBeforeUnmount(unlockBodyScroll)

function close() {
  emit('update:modelValue', false)
}

async function getIdTokenSafe() {
  try {
    await initFirebaseAuth()
    const { getIdToken } = useFirebaseAuth()
    return await getIdToken().catch(() => null)
  } catch (e) {
    logger.warn('[NameEditModal] getIdTokenSafe failed:', e?.message || e)
    return null
  }
}

async function save() {
  if (saving.value) return
  saving.value = true
  try {
    const token = await getIdTokenSafe()
    if (!token) {
      toast.show($t('auth.signIn'), { type: 'info', duration: 1800 })
      return
    }
    await settings.saveUsername(token, nameDraft.value)
    toast.show($t('common.updated'), { type: 'success', duration: 1500 })
    close()
  } catch (e) {
    toast.show($t('common.error'), { type: 'error', duration: 2000 })
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: color-mix(in oklab, #000000 40%, transparent);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 1000;
}

.modal-content {
  background: var(--surface);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  max-width: 420px;
  width: 100%;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px 0 20px;
  margin-bottom: 12px;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--fg);
}

.close-btn {
  background: transparent;
  border: none;
  font-size: 24px;
  color: var(--muted);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
}

.modal-body {
  padding: 0 20px 20px 20px;
}

.hint {
  color: var(--muted);
  font-size: 0.85rem;
  margin-bottom: 12px;
}

.text-input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--card-border);
  background: var(--bg);
  color: var(--fg);
  font-size: 1rem;
  box-sizing: border-box;
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.cancel-btn,
.save-btn {
  padding: 10px 16px;
  border-radius: 10px;
  border: 1px solid var(--card-border);
  cursor: pointer;
  font-weight: 600;
}

.cancel-btn {
  background: transparent;
  color: var(--fg);
}

.save-btn {
  background: var(--accent-color);
  color: #fff;
  border-color: transparent;
}

.save-btn:disabled,
.cancel-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.modal-enter-active,
.modal-leave-active {
  transition: all 0.25s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
