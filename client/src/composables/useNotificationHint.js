// Zustand des Hinweises "Mitteilungen sind aus" für Komponenten (Warm-up-Karte, Pausentimer-Einstellungen).
// Prüft beim Einbinden und jedes Mal, wenn der Nutzer in die App zurückkehrt (z. B. aus den iPhone-Einstellungen).
import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  dismissNotificationHint, getNotificationPermission, isNotificationHintDismissed, openAppSettings, shouldShowNotificationHint
} from '@/utils/notificationPermission'

export function useNotificationHint() {
  const visible = ref(false)

  async function refresh() {
    const permission = await getNotificationPermission()
    visible.value = shouldShowNotificationHint({ permission, dismissed: isNotificationHintDismissed() })
  }

  function dismiss() {
    dismissNotificationHint()
    visible.value = false
  }

  async function openSettings() {
    await openAppSettings()
  }

  const onVisible = () => { if (typeof document === 'undefined' || document.visibilityState === 'visible') refresh() }
  onMounted(() => {
    refresh()
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible)
  })
  onBeforeUnmount(() => {
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible)
  })

  return { visible, refresh, dismiss, openSettings }
}
