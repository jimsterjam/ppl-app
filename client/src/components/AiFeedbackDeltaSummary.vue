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
import { useExerciseTranslation } from '@/utils/exerciseTranslation'

// Zusammenhängender, natürlichsprachlicher Vergleichssatz je Übung (Sätze/Wiederholungen/
// Gewicht vs. letzte Session) statt der früheren drei isolierten Chips + SVG-Sparkline. Die
// Chips zeigten Rohzahlen wie "+6,7kg" ganz ohne Einordnung - laut Rückmeldung unverständlich
// und ohne Mehrwert für den Nutzer.
//
// Bug-Fix (User-Report "Bankdrücken 0,5kg mehr" statt satzgenau "2,5kg im dritten Satz"):
// weight_change_kg war früher IMMER eine Session-Ø-Differenz (Durchschnitt über alle Sätze) -
// hat nur ein einzelner Satz sich verändert, verwässerte der Durchschnitt die reale Zahl
// (z.B. 2,5kg in einem von drei Sätzen -> Ø 0,83kg). Das Backend liefert jetzt zusätzlich
// weight_change_scope ('uniform'|'partial'|'mixed'|'none'|'unknown') und bei 'partial' die
// konkret betroffenen Satznummern (siehe resolveSatzgenauWeightChange in
// trainingAnalysisService.js) - dieser Satz nennt bei 'partial' jetzt den/die betroffenen Satz/
// Sätze explizit, bei 'uniform' bleibt es (korrekterweise) bei der einfachen Zahl, bei 'mixed'
// (Sätze gegenläufig verändert) wird bewusst KEINE Zahl behauptet.
const props = defineProps({
  snapshot: {
    type: Array,
    default: () => []
  }
})

const { t, locale } = useI18n()
const { getTranslatedExerciseName } = useExerciseTranslation()

function formatNumber(value) {
  const isDe = String(locale.value || 'de').toLowerCase().startsWith('de')
  const rounded = Math.round(Math.abs(value) * 10) / 10
  return new Intl.NumberFormat(isDe ? 'de-DE' : 'en-US', { maximumFractionDigits: 1 }).format(rounded)
}

// Baut "3" oder "1 und 3" aus einer Liste von Satznummern (siehe weight_change_set_numbers) -
// für die satzgenaue Formulierung bei scope 'partial' (siehe buildSentence unten).
function formatSetList(setNumbers) {
  const sorted = [...(setNumbers || [])].sort((a, b) => a - b)
  if (sorted.length <= 1) return String(sorted[0] ?? '')
  const last = sorted[sorted.length - 1]
  return `${sorted.slice(0, -1).join(', ')} ${t('feedbackHistory.deltaAnd')} ${last}`
}

/**
 * Baut aus den Delta-Werten EINEN Satz. Nennt nur die Werte, die sich tatsächlich verändert
 * haben, und ergänzt explizit, was gleich geblieben ist (sonst wirkt z.B. "20 kg mehr" isoliert,
 * ohne dass klar ist, ob auch mehr/weniger Sätze oder Wiederholungen dahinterstecken).
 * "Steigerung" wird nur angehängt, wenn ALLE veränderten Werte in dieselbe (positive) Richtung
 * zeigen - bei gegenläufigen Änderungen (z.B. mehr Gewicht, aber weniger Wiederholungen) bewusst
 * keine automatische Wertung, analog zur Zurückhaltung in OpenAIProvider.js Regel 8/9 (keine
 * automatische Bewertung von Gewichts-/Volumenänderungen).
 *
 * Gewicht (weightChangeKg/weightScope/weightSetNumbers): siehe resolveSatzgenauWeightChange()
 * in trainingAnalysisService.js - bei scope 'partial' wird/werden der/die betroffene(n) Satz/
 * Sätze konkret genannt statt eine (potenziell irreführende) pauschale Zahl zu behaupten; bei
 * 'mixed' (Sätze gegenläufig verändert) wird bewusst GAR KEINE Zahl genannt.
 */
function buildSentence({ setsChange, repsChange, weightChangeKg, weightScope, weightSetNumbers }) {
  const clauses = []
  const weightIsMixed = weightScope === 'mixed'
  const weightChanged = weightIsMixed || weightChangeKg !== 0

  if (weightIsMixed) {
    clauses.push(t('feedbackHistory.deltaWeightMixed'))
  } else if (weightChangeKg !== 0) {
    if (weightScope === 'partial' && Array.isArray(weightSetNumbers) && weightSetNumbers.length > 0) {
      clauses.push(t(
        weightChangeKg > 0 ? 'feedbackHistory.deltaWeightMoreInSet' : 'feedbackHistory.deltaWeightLessInSet',
        { kg: formatNumber(weightChangeKg), sets: formatSetList(weightSetNumbers) }
      ))
    } else {
      clauses.push(t(
        weightChangeKg > 0 ? 'feedbackHistory.deltaWeightMore' : 'feedbackHistory.deltaWeightLess',
        { kg: formatNumber(weightChangeKg) }
      ))
    }
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
    if (weightChanged) suffix = t('feedbackHistory.deltaSuffixWeightChanged')
    else if (repsChange !== 0) suffix = t('feedbackHistory.deltaSuffixRepsChanged')
    else suffix = t('feedbackHistory.deltaSuffixSetsChanged')
  } else if (clauses.length === 2) {
    // Genau EIN Wert unverändert - nur den einen benennen.
    if (!weightChanged) suffix = t('feedbackHistory.deltaSuffixOnlyWeightUnchanged')
    else if (repsChange === 0) suffix = t('feedbackHistory.deltaSuffixOnlyRepsUnchanged')
    else suffix = t('feedbackHistory.deltaSuffixOnlySetsUnchanged')
  }
  // Bei allen drei Werten verändert (clauses.length === 3): kein Suffix nötig, ist bereits
  // vollständig durch die drei Klauseln beschrieben.

  // 'mixed' Gewicht (gegenläufige Sätze) fließt bewusst NICHT in die Verbesserungs-Wertung ein -
  // es gibt keine einzelne Zahl, deren Vorzeichen man dafür heranziehen könnte.
  const changedValues = [repsChange, setsChange].filter((v) => v !== 0)
  if (!weightIsMixed && weightChangeKg !== 0) changedValues.push(weightChangeKg)
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
      const weightScope = item.weight_change_scope || 'unknown'
      const weightSetNumbers = Array.isArray(item.weight_change_set_numbers) ? item.weight_change_set_numbers : []
      return {
        // User-Report: hier standen die deutschen Katalognamen, obwohl Übungsnamen in der App
        // immer englisch sind (siehe exerciseTranslation.js) - jetzt wie überall übersetzt.
        exercise: getTranslatedExerciseName(item.exercise),
        isFirstSession: !!item.is_first_session,
        sentence: buildSentence({ setsChange, repsChange, weightChangeKg, weightScope, weightSetNumbers })
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
  /* Katalognamen sind klein geschrieben ("calf press lever") - wie im KI-Text groß. */
  text-transform: capitalize;
  margin-right: 0.25rem;
}
</style>
