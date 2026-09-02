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

        <!-- Mini-Trend-Grafik: nur bei tatsächlich auffälliger Veränderung (siehe
             is_notable, vom Backend anhand der Progression bestimmt) und nur, wenn genug
             Datenpunkte für eine sinnvolle Linie vorhanden sind. Absichtlich sehr sparsam
             (reines SVG, keine Chart-Bibliothek) - zeigt den Volumen-Verlauf über die
             letzten bis zu 4 passenden Sessions. -->
        <svg
          v-if="row.isNotable && row.history.length >= 2"
          class="delta-sparkline"
          viewBox="0 0 100 30"
          preserveAspectRatio="none"
          :aria-label="t('feedbackHistory.deltaTrend') || 'Verlauf über die letzten Sessions'"
        >
          <polyline
            :points="sparklinePoints(row.history)"
            fill="none"
            :stroke="sparklineColor(row.history)"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
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
      isNotable: !!item.is_notable,
      history: Array.isArray(item.history) ? item.history.map(Number).filter(Number.isFinite) : [],
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

// Reines SVG-Sparkline ohne Chart-Bibliothek - normalisiert die Werte auf eine feste
// 100x30-Viewbox. Richtung (letzter vs. erster Punkt) bestimmt nur die Farbe, keine Wertung
// im Text - siehe chipClass()/style.css für dieselbe Blau/Orange-Konvention.
function sparklinePoints(history) {
  const max = Math.max(...history)
  const min = Math.min(...history)
  const range = max - min || 1
  const stepX = history.length > 1 ? 100 / (history.length - 1) : 0
  return history
    .map((value, index) => {
      const x = index * stepX
      const y = 29 - ((value - min) / range) * 27
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

function sparklineColor(history) {
  const first = history[0]
  const last = history[history.length - 1]
  if (last > first) return 'var(--info)'
  if (last < first) return 'var(--warning)'
  return 'var(--muted)'
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

.delta-sparkline {
  width: 44px;
  height: 18px;
  flex-shrink: 0;
}
</style>
