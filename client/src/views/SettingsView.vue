<template>
  <div class="settings-view">
    <HeaderBar :title="$t('settings.title')" />
    
    <div class="settings-content">
      <h2>{{ $t('settings.app') }}</h2>

      <section class="card">
        <h3>{{ $t('settings.theme') }}</h3>
        <p class="hint">{{ $t('settings.themeHint') }}</p>
        <div class="theme-options">
          <label class="opt">
            <input type="radio" name="theme" value="light" :checked="theme === 'light'" @change="set('light')" />
            <span>{{ $t('settings.light') }}</span>
          </label>
          <label class="opt">
            <input type="radio" name="theme" value="dark" :checked="theme === 'dark'" @change="set('dark')" />
            <span>{{ $t('settings.dark') }}</span>
          </label>
        </div>
      </section>

      <section class="card">
        <h3>{{ $t('settings.weeklyGoal') }}</h3>
        <p class="hint">{{ $t('settings.weeklyGoalHint') }}</p>
        <div class="goal-row">
          <input
            type="range"
            min="1"
            max="14"
            :value="weeklyGoal"
            @input="onRange($event)"
          />
          <div class="goal-input">
            <button class="step" @click="dec">−</button>
            <input type="number" min="1" max="14" :value="weeklyGoal" @input="onInput($event)"/>
            <button class="step" @click="inc">+</button>
          </div>
          <span class="goal-badge">{{ weeklyGoal }} {{ $t('settings.perWeek') }}</span>
        </div>
      </section>

      <section class="card">
        <h3>{{ $t('settings.language') }}</h3>
        <div class="theme-options">
          <label class="opt">
            <input type="radio" name="lang" value="de" :checked="lang === 'de'" @change="setLang('de')" />
            <span>{{ $t('settings.german') }}</span>
          </label>
          <label class="opt">
            <input type="radio" name="lang" value="en" :checked="lang === 'en'" @change="setLang('en')" />
            <span>{{ $t('settings.english') }}</span>
          </label>
        </div>
      </section>

      <!-- Development Tools Section -->
      <section v-if="isDevelopment" class="card dev-tools">
        <h3>🧪 Developer Tools</h3>
        <p class="hint">Features testing and debugging tools</p>
        <button class="dev-btn" @click="goToFeatureTest">
          🚀 Open Features Test Dashboard
        </button>
      </section>

      <section class="card">
        <h3>ℹ️ Rechtliches</h3>
        <p class="hint">Impressum, Datenschutz, Nutzungsbedingungen</p>
        <button class="legal-btn" @click="$router.push('/legal')">
          <span>ℹ️</span>
          <span>Rechtliche Hinweise</span>
        </button>
      </section>

      <section class="card danger-zone">
        <h3>{{ $t('settings.dangerZone') }}</h3>
        <p class="hint">{{ $t('settings.dangerZoneHint') }}</p>
        <button class="danger-btn" @click="showDeleteConfirm = true" :disabled="isDeleting">
          <span v-if="isDeleting">🔄</span>
          <span v-else>🗑️</span>
          {{ isDeleting ? $t('settings.deleting') : $t('settings.deleteAllData') }}
        </button>
      </section>

      <section class="card danger-zone account-danger">
        <h3>{{ $t('settings.dangerZone') }} - Account</h3>
        <p class="hint">{{ $t('settings.dangerZoneHint') }}</p>
        <button class="danger-btn account-delete-btn" @click="showDeleteAccountConfirm = true" :disabled="isDeletingAccount">
          <span v-if="isDeletingAccount">🔄</span>
          <span v-else>🗑️</span>
          {{ isDeletingAccount ? $t('settings.deletingAccount') : $t('settings.deleteAccount') }}
        </button>
      </section>
      
    </div>

    <!-- Bestätigungs-Dialog -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="!isDeleting && (showDeleteConfirm = false)">
      <div class="modal-content">
        <div class="modal-header">
          <h3>⚠️ {{ $t('settings.confirmDelete') }}</h3>
          <button v-if="!isDeleting" class="close-btn" @click="showDeleteConfirm = false">×</button>
        </div>
        
        <div class="modal-body">
          <p class="warning-text">{{ $t('settings.confirmDeleteMsg') }}</p>
          
          <div class="warning-list">
            <div class="warning-item">
              <span class="warning-icon">🗄️</span>
              <span>{{ $t('settings.deleteWarning1') }}</span>
            </div>
            <div class="warning-item">
              <span class="warning-icon">📊</span>
              <span>{{ $t('settings.deleteWarning2') }}</span>
            </div>
            <div class="warning-item">
              <span class="warning-icon">⚙️</span>
              <span>{{ $t('settings.deleteWarning3') }}</span>
            </div>
          </div>
          
          <div class="confirm-input">
            <label>{{ $t('settings.typeToConfirm') }}</label>
            <input 
              v-model="confirmText" 
              type="text" 
              :placeholder="$t('settings.deletePlaceholder')"
              :disabled="isDeleting"
              @keyup.enter="confirmDelete"
              autocomplete="off"
            />
          </div>
        </div>
        
        <div class="modal-actions">
          <button class="cancel-btn" @click="showDeleteConfirm = false" :disabled="isDeleting">
            {{ $t('common.cancel') }}
          </button>
          <button 
            class="confirm-danger-btn" 
            :disabled="confirmText.toLowerCase() !== $t('settings.deletePlaceholder').toLowerCase() || isDeleting"
            @click="confirmDelete"
          >
            <span v-if="isDeleting">🔄</span>
            <span v-else>🗑️</span>
            {{ isDeleting ? $t('settings.deleting') : $t('settings.deleteForever') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Account-Lösch-Dialog -->
    <div v-if="showDeleteAccountConfirm" class="modal-overlay" @click.self="!isDeletingAccount && (showDeleteAccountConfirm = false)">
      <div class="modal-content">
        <div class="modal-header">
          <h3>⚠️ {{ $t('settings.confirmDeleteAccount') }}</h3>
          <button v-if="!isDeletingAccount" class="close-btn" @click="showDeleteAccountConfirm = false">×</button>
        </div>
        
        <div class="modal-body">
          <p class="warning-text">{{ $t('settings.confirmDeleteAccountMsg') }}</p>
          
          <div class="warning-list">
            <div class="warning-item">
              <span class="warning-icon">🗄️</span>
              <span>{{ $t('settings.deleteAccountWarning1') }}</span>
            </div>
            <div class="warning-item">
              <span class="warning-icon">📊</span>
              <span>{{ $t('settings.deleteAccountWarning2') }}</span>
            </div>
            <div class="warning-item">
              <span class="warning-icon">⚙️</span>
              <span>{{ $t('settings.deleteAccountWarning3') }}</span>
            </div>
            <div class="warning-item">
              <span class="warning-icon">🚫</span>
              <span>{{ $t('settings.deleteAccountWarning4') }}</span>
            </div>
          </div>
          
          <div class="confirm-input">
            <label>{{ $t('settings.typeToConfirmAccount') }}</label>
            <input 
              v-model="confirmAccountText" 
              type="text" 
              :placeholder="$t('settings.deleteAccountPlaceholder')"
              :disabled="isDeletingAccount"
              @keyup.enter="confirmDeleteAccount"
              autocomplete="off"
            />
          </div>
        </div>
        
        <div class="modal-actions">
          <button class="cancel-btn" @click="showDeleteAccountConfirm = false" :disabled="isDeletingAccount">
            {{ $t('common.cancel') }}
          </button>
          <button 
            class="confirm-danger-btn" 
            :disabled="confirmAccountText.toLowerCase() !== $t('settings.deleteAccountPlaceholder').toLowerCase() || isDeletingAccount"
            @click="confirmDeleteAccount"
          >
            <span v-if="isDeletingAccount">🔄</span>
            <span v-else>🗑️</span>
            {{ isDeletingAccount ? $t('settings.deletingAccount') : $t('settings.deleteAccountForever') }}
          </button>
        </div>
      </div>
    </div>

    <BottomNav />
  </div>
</template>

<script setup>
import HeaderBar from '../components/HeaderBar.vue'
import BottomNav from '../components/BottomNav.vue'
import { storeToRefs } from 'pinia'
import { useThemeStore } from '@/stores/themeStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useUserStore } from '@/stores/userStore'
import { useToastStore } from '@/stores/toastStore'
import { useI18n } from 'vue-i18n'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { initFirebaseAuth, useFirebaseAuth } from '@/utils/firebaseAuth'
import { logger } from '@/utils/logger'
import { deleteAllWorkouts } from '@/api/workouts'

const themeStore = useThemeStore()
const { theme } = storeToRefs(themeStore)
const set = (t) => themeStore.setTheme(t)

// Wochenziel
const settings = useSettingsStore()
const { weeklyGoal } = storeToRefs(settings)
function setGoal(v) { settings.setWeeklyGoal(v) }
function onInput(e) { setGoal(e.target.value) }
function onRange(e) { setGoal(e.target.value) }
function inc() { setGoal((weeklyGoal.value || 4) + 1) }
function dec() { setGoal((weeklyGoal.value || 4) - 1) }

// Sprache
const { locale, t: $t } = useI18n()
const lang = computed(() => locale.value)
function setLang(l) {
  locale.value = l
  settings.setLanguage(l)
}

// Development mode detection
const isDevelopment = computed(() => {
  return import.meta.env.DEV || localStorage.getItem('enableDevTools') === 'true'
})

// Navigation to features test
const goToFeatureTest = () => {
  router.push('/features-test')
}

// Alle Daten löschen
const userStore = useUserStore()
const toast = useToastStore()
const router = useRouter()
const { getIdToken } = useFirebaseAuth()
const showDeleteConfirm = ref(false)
const confirmText = ref('')
const isDeleting = ref(false)

const showDeleteAccountConfirm = ref(false)
const confirmAccountText = ref('')
const isDeletingAccount = ref(false)

async function confirmDelete() {
  logger.debug('🔴 confirmDelete aufgerufen!')
  logger.debug('Eingabe:', confirmText.value)
  logger.debug('Erwartet:', $t('settings.deletePlaceholder'))
  logger.debug('Vergleich:', confirmText.value.toLowerCase(), '===', $t('settings.deletePlaceholder').toLowerCase())

  if (confirmText.value.toLowerCase() !== $t('settings.deletePlaceholder').toLowerCase()) {
    logger.debug('❌ Validierung fehlgeschlagen - Funktion beendet')
    return
  }

  logger.debug('✅ Validierung erfolgreich - starte Löschung')

  if (isDeleting.value) {
    logger.debug('❌ Bereits am Löschen - Funktion beendet')
    return
  }
  isDeleting.value = true

  try {
    logger.debug('🔄 Starte Löschvorgang...')

    // 1. MongoDB: Alle Workouts des Users löschen
    try {
      logger.debug('🔑 Hole Auth-Token...')
      const token = await getIdToken().catch(() => null)
      logger.debug('🔑 Token erhalten:', !!token, token ? `${token.substring(0,20)}...` : 'null')

      if (token) {
        logger.debug('🗑️ Lösche alle Workouts aus MongoDB...')
        const result = await deleteAllWorkouts(token)
        logger.debug('✅ MongoDB-Workouts gelöscht:', result)
      } else {
        logger.warn('⚠️ Kein Auth-Token - MongoDB-Löschung übersprungen')
      }
    } catch (error) {
      // Fortfahren mit lokaler Löschung – Fehler hier ist unkritisch
      try {
        const msg = error?.message || JSON.stringify(error) || String(error)
        logger.warn('⚠️ MongoDB-Löschung nicht durchgeführt (fahre fort):', msg)
      } catch {
        logger.warn('⚠️ MongoDB-Löschung nicht durchgeführt (fahre fort)')
      }
    }

    logger.debug('🧹 Lösche lokale Daten (gezielt, ohne Logout)...')

    // 2. Frontend Store: Alle Workouts aus dem Store löschen
    logger.debug('Store vor Löschung:', userStore.workouts.length, 'Workouts')
    userStore.$patch({ workouts: [], stats: null, workoutsLoaded: false, workoutsLoadedAt: 0 })
    logger.debug('Store nach Löschung:', userStore.workouts.length, 'Workouts')
    logger.debug('Store nach Löschung:', userStore.workouts.length, 'Workouts')
    
    // 3. LocalStorage: nur app-spezifische Daten löschen (ohne Auth/OAuth)
    try {
      logger.debug('🧹 Entferne App-Caches aus LocalStorage')
      localStorage.removeItem('bro_split_workouts')
      localStorage.removeItem('bro_split_stats')
      localStorage.removeItem('wb_belief_last_shown')
    } catch {}

    // 4. SessionStorage: gezielt Drafts/temporäres löschen
    try {
      logger.debug('🧹 Entferne Drafts aus SessionStorage')
      const keys = Object.keys(sessionStorage)
      keys.forEach(k => { if (k.includes('workout_detail_draft')) sessionStorage.removeItem(k) })
    } catch {}

    // 5. IndexedDB: lokale Workouts leeren
    try {
      const { db } = await import('@/utils/offlineStorage')
      await db.workouts.clear()
      logger.debug('🧹 IndexedDB Workouts geleert')
    } catch (e) {
      logger.warn('⚠️ Konnte IndexedDB Workouts nicht leeren:', e?.message || e)
    }

    logger.debug('✅ Löschvorgang abgeschlossen')

    // 5. Dialog schließen
    showDeleteConfirm.value = false
    confirmText.value = ''

    // 6. Feedback geben
    toast.show($t('settings.deleteSuccess'), { type: 'success', duration: 3000 })

    // 7. Auf aktueller Route bleiben (kein Logout/Redirect)
    logger.debug('🏠 Bleibe auf Settings-View, kein Logout')

    // 8. Optional: Store refresh für sofortiges UI-Update
    logger.debug('🔄 Force refresh der Workout-Daten...')
    try {
      const token = await getIdToken().catch(() => null)
      logger.debug('[Delete] token len', token?.length, token?.slice(0,20));
      await userStore.loadWorkouts(token, { force: true })
      logger.debug('✅ Workouts neu geladen')
    } catch (e) {
      // Bei Fehler: Store bleibt leer – UI ist bereits bereinigt
      logger.warn('⚠️ Neu-Laden fehlgeschlagen, Store bleibt leer')
    }
  } catch (error) {
    logger.error('❌ Fehler beim Löschen der Daten:', error)
    logger.error('Fehler Details:', error.message, error.stack)
    toast.show($t('settings.deleteError'), { type: 'error' })

    // Trotzdem Dialog schließen
    showDeleteConfirm.value = false
    confirmText.value = ''
  } finally {
    isDeleting.value = false
    logger.debug('🏁 Löschvorgang beendet (finally)')
  }
}

async function confirmDeleteAccount() {
  if (confirmAccountText.value.toLowerCase() !== $t('settings.deleteAccountPlaceholder').toLowerCase()) {
    return
  }

  if (isDeletingAccount.value) return
  isDeletingAccount.value = true

  try {
    // 1. Firebase Auth initialisieren
    await initFirebaseAuth()
    const { deleteCurrentAccount, getIdToken } = useFirebaseAuth()

    // Hole wirklich das Token (nicht die Funktions-Referenz) und logge Länge + Prefix
    const token = await getIdToken().catch(() => null)
    logger.debug('[Debug] ID token len', token?.length, token?.slice(0, 20))

    // Debug: aktuelles ID Token anzeigen
    const debugToken = await getIdToken().catch(() => null)
    logger.debug('[SettingsView] Delete account token:', debugToken)

    // 2. Backend-Daten-Purge vor Account-Löschung
    try {
      const token = await getIdToken()
      if (token) {
        const purgeRes = await fetch('/api/account/purge', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        })
        const purgeJson = await purgeRes.json().catch(() => ({}))
        logger.debug('🧹 Account Purge:', purgeRes.status, purgeJson)
      } else {
        logger.warn('⚠️ Kein Token verfügbar – Purge übersprungen')
      }
    } catch (e) {
      logger.warn('⚠️ Account Purge fehlgeschlagen, fahre fort')
    }

    // 3. Firebase-Account löschen
    await deleteCurrentAccount(confirmAccountText.value)

    // 4. Frontend Cleanup
    localStorage.clear()
    sessionStorage.clear()
    toast.show($t('settings.deleteAccountSuccess'), { type: 'success', duration: 3000 })

    // 5. Nach Löschen zur Welcome-Seite navigieren
    setTimeout(() => {
      router.push({ name: 'welcome' })
    }, 100)

  } catch (error) {
    logger.error('Account deletion failed:', error)
    toast.show($t('settings.deleteAccountError'), { type: 'error' })
  } finally {
    isDeletingAccount.value = false
    showDeleteAccountConfirm.value = false
    confirmAccountText.value = ''
  }
}


// Toast-Settings entfernt – Toaster ist fest oben
</script>

<style scoped>
.settings-view {
  min-height: 100vh;
  background: var(--bg);
  color: var(--fg);
}

.settings-content {
  padding: 20px;
  padding-bottom: 70px; /* Platz für BottomNav */
}

.card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 16px;
}

.hint { color: var(--muted); margin: 4px 0 12px; }

.theme-options { display: flex; gap: 12px; align-items: center; }
.opt { display: inline-flex; gap: 8px; align-items: center; background: var(--surface); border: 1px solid var(--card-border); padding: 8px 10px; border-radius: 10px; }
.toggle { margin-left: auto; background: var(--accent); color: #fff; border: none; border-radius: 10px; padding: 10px 12px; }

.goal-row { display: grid; grid-template-columns: 1fr auto auto; gap: 12px; align-items: center; }
.goal-input { display: inline-flex; align-items: center; border: 1px solid var(--card-border); border-radius: 10px; overflow: hidden; }
.goal-input input { width: 72px; text-align: center; border: none; padding: 10px; background: var(--surface); color: var(--fg); }
.goal-input .step { background: var(--surface); color: var(--fg); border: none; padding: 10px 12px; cursor: pointer; }
.goal-badge { background: var(--surface); border: 1px solid var(--card-border); padding: 6px 10px; border-radius: 999px; color: var(--muted); font-size: 0.9rem; }

/* Danger Zone */
.danger-zone {
  border: 1px solid color-mix(in srgb, var(--error-color) 30%, transparent);
  background: color-mix(in srgb, var(--error-color) 5%, var(--card-bg));
}

.danger-zone h3 {
  color: var(--error-color);
  margin-bottom: 8px;
}

.account-danger {
  margin-top: 20px;
}

.account-delete-btn {
  background: linear-gradient(135deg, var(--error-color) 0%, color-mix(in srgb, var(--error-color) 80%, black) 100%);
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  margin-top: 12px;
  transition: all 0.2s ease;
  width: 100%;
}

.account-delete-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.account-delete-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.danger-btn {
  width: 100%;
  background: transparent;
  border: 2px solid var(--error-color);
  color: var(--error-color);
  padding: 12px 20px;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  margin-top: 12px;
  transition: all 0.2s ease;
}

.danger-btn:hover {
  background: color-mix(in srgb, var(--error-color) 10%, transparent);
  transform: translateY(-1px);
}

.danger-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.danger-btn:disabled:hover {
  transform: none;
  background: transparent;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
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
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 24px 0;
  margin-bottom: 16px;
}

.modal-header h3 {
  color: var(--error-color);
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 1.5rem;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: var(--surface);
  color: var(--fg);
}

.modal-body {
  padding: 0 24px 24px;
}

.warning-text {
  color: var(--muted);
  margin-bottom: 20px;
  line-height: 1.5;
  font-size: 0.95rem;
}

.warning-list {
  margin-bottom: 24px;
  border: 1px solid color-mix(in srgb, var(--error-color) 30%, transparent);
  border-radius: 8px;
  padding: 16px;
  background: color-mix(in srgb, var(--error-color) 5%, transparent);
}

.warning-item {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  font-size: 0.9rem;
  color: var(--fg);
}

.warning-item:last-child {
  margin-bottom: 0;
}

.warning-icon {
  font-size: 1.1rem;
  width: 20px;
  text-align: center;
}

.confirm-input {
  margin-bottom: 24px;
}

.confirm-input label {
  display: block;
  color: var(--fg);
  font-weight: 500;
  margin-bottom: 8px;
  font-size: 0.9rem;
}

.confirm-input input {
  width: 100%;
  padding: 12px;
  border: 2px solid var(--card-border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--fg);
  font-size: 1rem;
  transition: border-color 0.2s ease;
}

.confirm-input input:focus {
  outline: none;
  border-color: var(--error-color);
}

.confirm-input input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.cancel-btn {
  background: var(--surface);
  border: 1px solid var(--card-border);
  color: var(--fg);
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cancel-btn:hover {
  background: color-mix(in srgb, var(--fg) 10%, var(--surface));
}

.confirm-danger-btn {
  background: var(--error-color);
  border: none;
  color: white;
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.confirm-danger-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--error-color) 85%, black);
  transform: translateY(-1px);
}

.confirm-danger-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Developer Tools */
.dev-tools {
  border: 2px solid #22c55e;
  background: color-mix(in srgb, #22c55e 5%, transparent);
}

.dev-tools h3 {
  color: #22c55e;
}

.dev-btn {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  color: white;
  border: none;
  padding: 16px 24px;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.dev-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(34, 197, 94, 0.3);
}

/* Toast Einstellungen entfernt */
</style>
