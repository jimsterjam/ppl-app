import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSubscriptionStore } from '@/stores/subscriptionStore'

// Ab so vielen verbleibenden Anfragen wird die Anzeige orange.
export const AI_QUOTA_WARN_AT = 10

// Gemeinsames Monatskontingent (KI-Auswertung + KI-Workout) für Gratis-Nutzer.
// Die Zahlen kommen vom Server (checkSubscription / aiUsage-Snapshots); nur für Free relevant.
export function useAiQuota({ refresh = true } = {}) {
  const { locale } = useI18n()
  const store = useSubscriptionStore()

  const limit = computed(() => {
    const value = Number(store.usage?.aiMonthlyLimit)
    return Number.isFinite(value) && value >= 0 ? value : 0
  })
  const isFree = computed(() => !store.isPremium && limit.value > 0)
  const used = computed(() => Math.min(limit.value, store.quickGenerationsUsedThisMonth))
  const remaining = computed(() => Math.max(0, limit.value - used.value))
  const percentLeft = computed(() => (limit.value ? Math.round((remaining.value / limit.value) * 100) : 0))
  const level = computed(() => {
    if (remaining.value <= 0) return 'empty'
    return remaining.value <= AI_QUOTA_WARN_AT ? 'low' : 'ok'
  })
  const resetDateLabel = computed(() =>
    new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
      store.quickGeneratorResetDate
    )
  )

  const reload = () => store.checkSubscription(null, { force: true }).catch(() => {})
  if (refresh) onMounted(reload)

  return { isFree, limit, used, remaining, percentLeft, level, resetDateLabel, reload }
}
