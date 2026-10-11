// Zustand des Hinweises "Mitteilungen sind aus" für Komponenten (Warm-up-Karte, Pausentimer-Einstellungen).
// Prüft beim Einbinden und jedes Mal, wenn der Nutzer in die App zurückkehrt (z. B. aus den iPhone-Einstellungen).
import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  dismissNotificationHint, getNotificationPermission, isNotificationHintDismissed, openAppSettings,
  requestNotificationPermission, shouldShowNotificationHint
} from '@/utils/notificationPermission'

export function useNotificationHint() {
  const visible = ref(false)
  // 'prompt' = iOS hat noch nie gefragt (Knopf Erlauben), 'denied' = abgelehnt (Knopf Einstellungen)
  const permission = ref('granted')

  async function refresh() {
    apply(await getNotificationPermission())
  }

  function apply(next) {
    permission.value = next
    visible.value = shouldShowNotificationHint({ permission: next, dismissed: isNotificationHintDismissed(next) })
  }

  function dismiss() {
    dismissNotificationHint(permission.value)
    visible.value = false
  }

  async function allow() {
    apply(await requestNotificationPermission())
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

  return { visible, permission, refresh, dismiss, allow, openSettings }
}
