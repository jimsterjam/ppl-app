import { computed } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { useFirebaseAuth } from '@/utils/firebaseAuth'

// Nutzer-ID für Favoriten und Trainingspläne (gleiche Regel wie das Dashboard: getCurrentFavoritesUserId).
export function usePlanUserId() {
  const authStore = useAuthStore()
  const { getCurrentUser } = useFirebaseAuth()
  return computed(() => String(getCurrentUser?.()?.uid || authStore.user?.uid || authStore.uid || 'guest'))
}

/** Kurzes Datum ohne Jahr (z. B. 24.10.), passend zur App-Sprache. */
export function formatPlanDate(value, locale) {
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return ''
  return new Intl.DateTimeFormat(locale || 'de', { day: '2-digit', month: '2-digit' }).format(time)
}
