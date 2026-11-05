import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSubscriptionStore } from '@/stores/subscriptionStore'

// Die Anzeige wird orange, wenn nur noch ein Viertel (mindestens 1 Anfrage) übrig ist. Ein fester Wert passt nicht,
// weil das Kontingent je nach Phase unterschiedlich groß ist (Willkommenskontingent bzw. Monatskontingent).
export const AI_QUOTA_WARN_FRACTION = 0.25
export const aiQuotaWarnAt = (limit) => Math.max(1, Math.ceil((Number(limit) || 0) * AI_QUOTA_WARN_FRACTION))

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
    return remaining.value <= aiQuotaWarnAt(limit.value) ? 'low' : 'ok'
  })
  const resetDateLabel = computed(() =>
    new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
      store.quickGeneratorResetDate
    )
  )

  // Willkommensphase: das Kontingent gilt bis zu einem Datum, danach der reguläre Monatswert.
  const isWelcome = computed(() => store.usage?.aiPhase === 'welcome')
  const regularLimit = computed(() => {
    const value = Number(store.usage?.aiRegularLimit)
    return Number.isFinite(value) && value >= 0 ? value : null
  })

  const reload = () => store.checkSubscription(null, { force: true }).catch(() => {})
  if (refresh) onMounted(reload)

  return { isFree, isWelcome, regularLimit, limit, used, remaining, percentLeft, level, resetDateLabel, reload }
}
