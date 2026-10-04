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
import { buildDeltaSentence } from '@/utils/deltaSentence'

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
  // 2 Nachkommastellen: 1,25-kg-Schritte (z.B. "+1,25 kg") nicht auf 1,3 runden.
  const rounded = Math.round(Math.abs(value) * 100) / 100
  return new Intl.NumberFormat(isDe ? 'de-DE' : 'en-US', { maximumFractionDigits: 2 }).format(rounded)
}

const rows = computed(() => {
  if (!Array.isArray(props.snapshot)) return []
  return props.snapshot
    .filter(item => item && item.exercise)
    .map(item => {
      return {
        // User-Report: hier standen die deutschen Katalognamen, obwohl Übungsnamen in der App
        // immer englisch sind (siehe exerciseTranslation.js) - jetzt wie überall übersetzt.
        exercise: getTranslatedExerciseName(item.exercise),
        isFirstSession: !!item.is_first_session,
        // Regeln siehe utils/deltaSentence.js (inkl. Spanne bei gleicher Richtung und schwerstem
        // Satz + Gesamtbilanz bei gegenläufigen Sätzen, z.B. Pyramiden).
        sentence: buildDeltaSentence(item, t, formatNumber)
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
