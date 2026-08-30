<template>
  <div v-if="rows.length > 0" class="delta-summary">
    <div v-for="row in rows" :key="row.exercise" class="delta-row">
      <span class="delta-exercise">{{ row.exercise }}</span>

      <span v-if="row.isFirstSession" class="delta-chip delta-chip--neutral">
        {{ t('feedbackHistory.deltaFirstSession') || 'Erstes Training' }}
      </span>

      <template v-else>
        <span class="delta-chip" :class="chipClass(row.setsChange)">
          {{ formatSigned(row.setsChange) }} {{ t('feedbackHistory.deltaSets') || 'Sätze' }}
        </span>
        <span class="delta-chip" :class="chipClass(row.repsChange)">
          {{ formatSigned(row.repsChange) }} {{ t('feedbackHistory.deltaReps') || 'Wdh.' }}
        </span>
        <span class="delta-chip" :class="chipClass(row.weightChangeKg)">
          {{ formatSigned(row.weightChangeKg) }} kg
        </span>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

// Kompakte, farblich unterscheidbare Zusammenfassung der wichtigsten Zahlen je Übung
// (Sätze/Wiederholungen/Gewicht mehr bzw. weniger als die letzte Session), als Ersatz für das
// vollständige Aufzählen jeder einzelnen Übung im KI-Fließtext (siehe OpenAIProvider.js -
// die Prompt-Ausgabe konzentriert sich jetzt auf Zusammenfassung/Einordnung/Empfehlungen,
// die reinen Zahlen kommen strukturiert von hier). Farbe zeigt NUR die Richtung der Zahl
// (mehr/weniger), keine Wertung gut/schlecht - siehe --info/--warning in style.css.
const props = defineProps({
  snapshot: {
    type: Array,
    default: () => []
  }
})

const { t } = useI18n()

const rows = computed(() => {
  if (!Array.isArray(props.snapshot)) return []
  return props.snapshot
    .filter(item => item && item.exercise)
    .map(item => ({
      exercise: item.exercise,
      isFirstSession: !!item.is_first_session,
      setsChange: Number(item.sets_change) || 0,
      repsChange: Number(item.reps_change) || 0,
      weightChangeKg: Number(item.weight_change_kg) || 0
    }))
})

function formatSigned(value) {
  const rounded = Math.round(value * 10) / 10
  if (rounded > 0) return `+${rounded}`
  return `${rounded}`
}

function chipClass(value) {
  if (value > 0) return 'delta-chip--up'
  if (value < 0) return 'delta-chip--down'
  return 'delta-chip--neutral'
}
</script>

<style scoped>
.delta-summary {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.delta-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.delta-exercise {
  font-weight: 600;
  font-size: 0.88rem;
  color: var(--fg);
  margin-right: 0.15rem;
}

.delta-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.6rem;
  border-radius: var(--chip-radius, 16px);
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
}

.delta-chip--up {
  color: var(--info-text);
  background: var(--info-bg);
}

.delta-chip--down {
  color: var(--warning-text);
  background: var(--warning-bg);
}

.delta-chip--neutral {
  color: var(--muted);
  background: var(--surface-strong);
}
</style>
