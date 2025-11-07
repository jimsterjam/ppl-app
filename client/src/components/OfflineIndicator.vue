<template>
  <div v-if="showIndicator" class="offline-indicator" :class="indicatorClass">
    <div class="indicator-content">
      <!-- Icon -->
      <span class="indicator-icon">{{ statusIcon }}</span>
      
      <!-- Status Text -->
      <span class="indicator-text">{{ statusText }}</span>
      
      <!-- Pending Changes Badge -->
      <span v-if="pendingCount > 0" class="pending-badge">
        {{ pendingCount }}
      </span>
      
      <!-- Sync Button -->
      <button 
        v-if="pendingCount > 0"
        class="sync-button"
        @click="triggerSync"
        :disabled="syncing"
      >
        <span v-if="syncing">⏳</span>
        <span v-else>🔄</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { countPendingActions } from '@/utils/offlineStorage'
import { triggerManualSync, isSyncInProgress } from '@/utils/syncManager'
import { logger } from '@/utils/logger'

// State
const isOffline = ref(!navigator.onLine)
const pendingCount = ref(0)
const syncing = ref(false)
const showIndicator = ref(false)

// Computed
const indicatorClass = computed(() => ({
  'offline': isOffline.value,
  'online': !isOffline.value && pendingCount.value > 0,
  'syncing': syncing.value
}))

const statusIcon = computed(() => {
  if (syncing.value) return '⏳'
  if (isOffline.value) return '📡'
  if (pendingCount.value > 0) return '🔄'
  return '✅'
})

const statusText = computed(() => {
  if (syncing.value) return 'Synchronisiere...'
  if (isOffline.value && pendingCount.value > 0) {
    return `Offline - ${pendingCount.value} Änderung${pendingCount.value > 1 ? 'en' : ''} ausstehend`
  }
  if (isOffline.value) return 'Offline Modus'
  if (pendingCount.value > 0) {
    return `${pendingCount.value} Änderung${pendingCount.value > 1 ? 'en' : ''} zu synchronisieren`
  }
  return 'Online'
})

// Methods
async function updatePendingCount() {
  try {
    pendingCount.value = await countPendingActions()
    logger.debug('📊 Offline Indicator - Pending Count:', pendingCount.value)
  } catch (error) {
    logger.error('❌ Offline Indicator - Fehler beim Zählen:', error)
  }
}

async function triggerSync() {
  if (syncing.value) return
  
  syncing.value = true
  logger.debug('🔄 Offline Indicator - Manueller Sync gestartet')
  
  try {
    await triggerManualSync()
    await updatePendingCount()
  } catch (error) {
    logger.error('❌ Offline Indicator - Sync fehlgeschlagen:', error)
  } finally {
    syncing.value = false
  }
}

function handleOnline() {
  logger.debug('📡 Offline Indicator - Online')
  isOffline.value = false
  updatePendingCount()
}

function handleOffline() {
  logger.warn('📡 Offline Indicator - Offline')
  isOffline.value = true
  showIndicator.value = true
}

// Lifecycle
onMounted(async () => {
  // Initial Check - wichtig: navigator.onLine prüfen
  isOffline.value = !navigator.onLine
  
  // Update Pending Count (warten auf Result)
  await updatePendingCount()
  
  // Zeige Indicator nur wenn Offline oder Pending Changes
  showIndicator.value = isOffline.value || pendingCount.value > 0
  
  // Event Listeners
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  
  // Wenn wir online sind und Pending Actions haben, versuche auto zu synchronisieren
  if (!isOffline.value && pendingCount.value > 0 && !isSyncInProgress()) {
    logger.debug('🔄 Offline Indicator - Auto-Sync beim Start (online & pending)')
    setTimeout(() => {
      // doppelter Schutz, falls sich Status ändert
      if (!isOffline.value && pendingCount.value > 0 && !isSyncInProgress()) {
        triggerSync()
      }
    }, 600)
  }
  
  // Update Pending Count regelmäßig
  const interval = setInterval(updatePendingCount, 10000) // Alle 10 Sekunden
  
  // Cleanup
  onUnmounted(() => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
    clearInterval(interval)
  })
  
  logger.debug('✅ Offline Indicator - Initialized', {
    isOffline: isOffline.value,
    pendingCount: pendingCount.value,
    navigatorOnLine: navigator.onLine
  })
})
</script>

<style scoped>
.offline-indicator {
  position: fixed;
  top: 12px;
  right: 12px;
  z-index: 1000;
  padding: 10px 16px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(8px);
  animation: slideIn 0.3s ease;
  transition: all 0.3s ease;
}

@keyframes slideIn {
  from {
    transform: translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.offline-indicator.offline {
  background: rgba(251, 191, 36, 0.95); /* Amber */
  color: #78350f;
  border: 1px solid rgba(245, 158, 11, 0.5);
}

.offline-indicator.online {
  background: rgba(34, 197, 94, 0.95); /* Green */
  color: #14532d;
  border: 1px solid rgba(22, 163, 74, 0.5);
}

.offline-indicator.syncing {
  background: rgba(59, 130, 246, 0.95); /* Blue */
  color: #1e3a8a;
  border: 1px solid rgba(37, 99, 235, 0.5);
}

.indicator-content {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  font-weight: 600;
}

.indicator-icon {
  font-size: 1.1rem;
  line-height: 1;
}

.indicator-text {
  white-space: nowrap;
}

.pending-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: rgba(255, 255, 255, 0.9);
  color: inherit;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 700;
}

.sync-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 1rem;
}

.sync-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 1);
  transform: scale(1.1);
}

.sync-button:active:not(:disabled) {
  transform: scale(0.95);
}

.sync-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Mobile Optimizations */
@media (max-width: 480px) {
  .offline-indicator {
    top: 8px;
    right: 8px;
    left: 8px;
    padding: 8px 12px;
  }
  
  .indicator-content {
    font-size: 0.8125rem;
  }
  
  .indicator-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

/* Dark Mode Support */
@media (prefers-color-scheme: dark) {
  .offline-indicator.offline {
    background: rgba(245, 158, 11, 0.9);
    color: #fef3c7;
    border-color: rgba(251, 191, 36, 0.5);
  }
  
  .offline-indicator.online {
    background: rgba(34, 197, 94, 0.9);
    color: #dcfce7;
    border-color: rgba(74, 222, 128, 0.5);
  }
  
  .offline-indicator.syncing {
    background: rgba(59, 130, 246, 0.9);
    color: #dbeafe;
    border-color: rgba(96, 165, 250, 0.5);
  }
  
  .pending-badge {
    background: rgba(0, 0, 0, 0.3);
  }
  
  .sync-button {
    background: rgba(0, 0, 0, 0.3);
  }
  
  .sync-button:hover:not(:disabled) {
    background: rgba(0, 0, 0, 0.5);
  }
}
</style>
