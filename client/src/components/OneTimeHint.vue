<template>
  <Transition name="hint-fade">
    <div v-if="visible" class="one-time-hint glass">
      <button type="button" class="hint-close" :aria-label="t('common.close')" @click="dismiss()">×</button>
      <h4 class="hint-title">{{ title }}</h4>
      <p class="hint-text">{{ text }}</p>
      <div v-if="primaryLabel || secondaryLabel" class="hint-actions">
        <button v-if="secondaryLabel" type="button" class="hint-btn hint-btn--secondary" @click="handleSecondary">
          {{ secondaryLabel }}
        </button>
        <button v-if="primaryLabel" type="button" class="hint-btn hint-btn--primary" @click="handlePrimary">
          {{ primaryLabel }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOnboardingStore } from '@/stores/onboardingStore'
import { useFirebaseAuth } from '@/utils/firebaseAuth'
import { logger } from '@/utils/logger'

// Wiederverwendbarer, einmaliger kontextueller Hinweis (siehe Onboarding-Auftrag:
// "wenige, einmalige Hinweise direkt an den passenden Stellen der App ... jeweils einzeln
// dauerhaft ausblendbar"). Bewusst KEIN pixelgenau positioniertes Tooltip/Popover-System
// (würde viel zusätzliches Layout-spezifisches Anchoring pro Einsatzort brauchen) - stattdessen
// eine ruhige, inline platzierte Karte direkt im normalen Seitenfluss an der jeweiligen Stelle,
// die der aufrufenden View die Positionierung überlässt.
const props = defineProps({
  hintId: { type: String, required: true },
  title: { type: String, required: true },
  text: { type: String, required: true },
  primaryLabel: { type: String, default: '' },
  secondaryLabel: { type: String, default: '' }
})

const emit = defineEmits(['primary', 'secondary', 'dismiss'])

const { t } = useI18n()
const onboardingStore = useOnboardingStore()
const visible = ref(false)

onMounted(() => {
  // statusReady erst nach dem ersten Server-Abgleich true (siehe onboardingStore.js) - ohne
  // diese Prüfung könnte ein Hinweis kurz aufblitzen, obwohl er auf einem anderen Gerät bereits
  // dauerhaft ausgeblendet wurde.
  if (onboardingStore.statusReady && !onboardingStore.isHintDismissed(props.hintId)) {
    visible.value = true
  }
})

async function getIdTokenSafe() {
  try {
    const { getIdToken } = useFirebaseAuth()
    return await getIdToken().catch(() => null)
  } catch (e) {
    logger.warn('[OneTimeHint] getIdTokenSafe failed:', e?.message || e)
    return null
  }
}

async function dismiss() {
  visible.value = false
  emit('dismiss')
  const token = await getIdTokenSafe()
  onboardingStore.dismissHint(token, props.hintId)
}

function handlePrimary() {
  emit('primary')
  dismiss()
}

function handleSecondary() {
  emit('secondary')
  dismiss()
}
</script>

<style scoped>
.one-time-hint {
  position: relative;
  padding: 1rem 2.5rem 1rem 1rem;
  margin: 0 0 1rem;
}

.hint-close {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: none;
  border: none;
  color: var(--muted);
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
  min-width: 44px;
  min-height: 44px;
}

.hint-title {
  margin: 0 0 0.4rem;
  font-size: 1rem;
  font-weight: 700;
  color: var(--fg);
}

.hint-text {
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.45;
  color: var(--muted);
}

.hint-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-top: 0.85rem;
}

.hint-btn {
  min-height: 40px;
  padding: 0 1rem;
  border-radius: 12px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.hint-btn--secondary {
  background: none;
  border: 1px solid var(--line-soft);
  color: var(--muted);
}

.hint-btn--primary {
  background: var(--accent);
  border: none;
  color: var(--accent-contrast);
}

.hint-fade-enter-active,
.hint-fade-leave-active {
  transition: opacity 0.18s ease;
}

.hint-fade-enter-from,
.hint-fade-leave-to {
  opacity: 0;
}
</style>
