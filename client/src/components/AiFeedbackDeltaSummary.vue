<template>
  <div v-if="rows.length > 0" class="delta-summary">
    <p v-for="row in rows" :key="row.exercise" class="delta-sentence">
      <span class="delta-exercise">{{ row.exercise }}:</span>
      {{ row.isFirstSession ? t('feedbackHistory.deltaFirstSession') : row.sentence }}
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

// Zusammenhängender, natürlichsprachlicher Vergleichssatz je Übung (Sätze/Wiederholungen/
// Gewicht vs. letzte Session) statt der früheren drei isolierten Chips + SVG-Sparkline. Die
// Chips zeigten Rohzahlen wie "+6,7kg" ganz ohne Einordnung - laut Rückmeldung unverständlich
// und ohne Mehrwert für den Nutzer. Bewusst KEINE Aufschlüsselung pro einzelnem Satz (z.B.
// "in Satz 4 ...") - dafür würden feinere, pro-Satz-aufgelöste Rohdaten benötigt, die aktuell
// nicht bis hierher durchgereicht werden; die vorhandenen Werte sind bereits Session-vs-Session-
// Summen (sets_change/reps_change/weight_change_kg).
const props = defineProps({
  snapshot: {
    type: Array,
    default: () => []
  }
})

const { t, locale } = useI18n()

function formatNumber(value) {
  const isDe = String(locale.value || 'de').toLowerCase().startsWith('de')
  const rounded = Math.round(Math.abs(value) * 10) / 10
  return new Intl.NumberFormat(isDe ? 'de-DE' : 'en-US', { maximumFractionDigits: 1 }).format(rounded)
}

/**
 * Baut aus den drei Delta-Werten EINEN Satz. Nennt nur die Werte, die sich tatsächlich
 * verändert haben, und ergänzt explizit, was gleich geblieben ist (sonst wirkt z.B. "20 kg
 * mehr" isoliert, ohne dass klar ist, ob auch mehr/weniger Sätze oder Wiederholungen
 * dahinterstecken). "Steigerung" wird nur angehängt, wenn ALLE veränderten Werte in dieselbe
 * (positive) Richtung zeigen - bei gegenläufigen Änderungen (z.B. mehr Gewicht, aber weniger
 * Wiederholungen) bewusst keine automatische Wertung, analog zur Zurückhaltung in
 * OpenAIProvider.js Regel 8/9 (keine automatische Bewertung von Gewichts-/Volumenänderungen).
 */
function buildSentence({ setsChange, repsChange, weightChangeKg }) {
  const clauses = []
  if (weightChangeKg !== 0) {
    clauses.push(t(
      weightChangeKg > 0 ? 'feedbackHistory.deltaWeightMore' : 'feedbackHistory.deltaWeightLess',
      { kg: formatNumber(weightChangeKg) }
    ))
  }
  if (repsChange !== 0) {
    clauses.push(t(
      repsChange > 0 ? 'feedbackHistory.deltaRepsMore' : 'feedbackHistory.deltaRepsLess',
      { n: formatNumber(repsChange) }
    ))
  }
  if (setsChange !== 0) {
    clauses.push(t(
      setsChange > 0 ? 'feedbackHistory.deltaSetsMore' : 'feedbackHistory.deltaSetsLess',
      { n: formatNumber(setsChange) }
    ))
  }

  if (clauses.length === 0) {
    return t('feedbackHistory.deltaNoChange')
  }

  let suffix = ''
  if (clauses.length === 1) {
    // Genau EIN Wert verändert - benennt die beiden gleich gebliebenen Werte zusammen.
    if (weightChangeKg !== 0) suffix = t('feedbackHistory.deltaSuffixWeightChanged')
    else if (repsChange !== 0) suffix = t('feedbackHistory.deltaSuffixRepsChanged')
    else suffix = t('feedbackHistory.deltaSuffixSetsChanged')
  } else if (clauses.length === 2) {
    // Genau EIN Wert unverändert - nur den einen benennen.
    if (weightChangeKg === 0) suffix = t('feedbackHistory.deltaSuffixOnlyWeightUnchanged')
    else if (repsChange === 0) suffix = t('feedbackHistory.deltaSuffixOnlyRepsUnchanged')
    else suffix = t('feedbackHistory.deltaSuffixOnlySetsUnchanged')
  }
  // Bei allen drei Werten verändert (clauses.length === 3): kein Suffix nötig, ist bereits
  // vollständig durch die drei Klauseln beschrieben.

  const changedValues = [weightChangeKg, repsChange, setsChange].filter((v) => v !== 0)
  const isImprovement = changedValues.length > 0 && changedValues.every((v) => v > 0)

  let sentence = clauses.join(` ${t('feedbackHistory.deltaAnd')} `)
  if (suffix) sentence += `, ${suffix}`
  sentence += isImprovement ? ` – ${t('feedbackHistory.deltaImprovement')}.` : '.'
  return sentence
}

const rows = computed(() => {
  if (!Array.isArray(props.snapshot)) return []
  return props.snapshot
    .filter(item => item && item.exercise)
    .map(item => {
      const setsChange = Number(item.sets_change) || 0
      const repsChange = Number(item.reps_change) || 0
      const weightChangeKg = Number(item.weight_change_kg) || 0
      return {
        exercise: item.exercise,
        isFirstSession: !!item.is_first_session,
        sentence: buildSentence({ setsChange, repsChange, weightChangeKg })
      }
    })
})
</script>

<style scoped>
.delta-summary {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.delta-sentence {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.4;
  color: var(--fg);
}

.delta-exercise {
  font-weight: 600;
  margin-right: 0.25rem;
}
</style>
