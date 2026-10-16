<template>
  <!-- Großer "Satz geschafft"-Haken unten (Absprache Paul 16.10.): Die kleine Satznummer in der Zeile ist im Training
       schwer zu treffen. Dieser Balken gilt immer dem aktuellen Satz (erster offener Arbeitssatz). Während der Pause ist
       er neutral und zeigt die Restzeit (bleibt antippbar), nach der Pause leuchtet er grün, bis er angetippt wird. -->
  <Teleport to="body">
    <div v-if="visible" class="done-bar-wrap" :class="{ lifted }">
      <button
        type="button"
        class="done-bar"
        :class="{ resting }"
        :aria-label="t('setDoneBar.aria', { set: current.setNumber, name: current.name })"
        @click="$emit('done')"
      >
        <span class="done-bar-icon" aria-hidden="true"><Check /></span>
        <span class="done-bar-text">
          <span class="done-bar-title">{{ resting ? t('setDoneBar.resting', { time: timeText }) : t('setDoneBar.label', { set: current.setNumber }) }}</span>
          <span class="done-bar-sub">{{ current.name }}</span>
        </span>
      </button>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check } from 'lucide-vue-next'
import { useRestTimerStore } from '@/stores/restTimerStore'
import { formatRest } from '@/utils/restTimerRules'

const props = defineProps({
  // { setNumber, name } des aktuellen Satzes oder null (kein laufendes Workout / kein offener Satz mehr)
  current: { type: Object, default: null },
  // z. B. Zahlenauswahl offen
  hidden: { type: Boolean, default: false }
})
defineEmits(['done'])
const { t } = useI18n()
const rest = useRestTimerStore()

// Solange ein Eingabefeld den Fokus hat (Tastatur offen), würde der Balken Eingaben verdecken.
const inputFocused = ref(false)
const isField = (el) => !!el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
const onFocusIn = (event) => { inputFocused.value = isField(event.target) }
const onFocusOut = () => { inputFocused.value = false }
onMounted(() => {
  window.addEventListener('focusin', onFocusIn)
  window.addEventListener('focusout', onFocusOut)
})
onBeforeUnmount(() => {
  window.removeEventListener('focusin', onFocusIn)
  window.removeEventListener('focusout', onFocusOut)
})

// Die große Pausen-Anzeige in der Mitte deckt den Bildschirm ohnehin ab.
const visible = computed(() => !!props.current && !props.hidden && !inputFocused.value && !rest.showOverlay)
const resting = computed(() => rest.isRunning)
const timeText = computed(() => formatRest(rest.remainingMs))
// Verkleinerte Pausen-Leiste sitzt auf derselben Höhe: darüber stapeln.
const lifted = computed(() => rest.isVisible && !rest.showOverlay)
</script>

<style scoped>
.done-bar-wrap {
  position: fixed;
  left: 10px;
  right: 10px;
  /* Über der Bottom-Navigation, unter Pausen-Leiste/Fenstern (RestTimerBar 1250, AppModal 1300). */
  bottom: calc(env(safe-area-inset-bottom, 0px) + 78px);
  z-index: 1240;
}
.done-bar-wrap.lifted { bottom: calc(env(safe-area-inset-bottom, 0px) + 78px + 96px); }
.done-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  width: 100%;
  min-height: 68px;
  padding: 10px 18px;
  border-radius: 18px;
  border: none;
  /* Grün wie der Punkt am Workout-Symbol im Menü (hell und dunkel gleich); dunkle Schrift (Kontrast > 8:1). */
  background: #34c759;
  color: #04210f;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
  cursor: pointer;
  text-align: left;
}
.done-bar:active { transform: scale(0.985); }
.done-bar-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(4, 33, 15, 0.14);
}
.done-bar-icon :deep(svg) { width: 30px; height: 30px; stroke-width: 3.2; }
.done-bar-text { display: flex; flex-direction: column; min-width: 0; }
.done-bar-title { font-size: 1.15rem; font-weight: 800; line-height: 1.2; }
.done-bar-sub { font-size: 0.82rem; font-weight: 600; opacity: 0.8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* Pause läuft: neutral, damit "jetzt ist der Satz dran" eindeutig grün ist. */
.done-bar.resting {
  background: var(--bg-panel, #1c1c1e);
  color: var(--fg);
  border: 2px solid color-mix(in srgb, var(--success, #34c759) 70%, transparent);
}
.done-bar.resting .done-bar-icon { background: color-mix(in srgb, var(--success, #34c759) 22%, transparent); }
.done-bar.resting .done-bar-icon :deep(svg) { color: var(--success, #34c759); }
</style>
