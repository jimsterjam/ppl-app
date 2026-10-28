<template>
  <div class="faqs-view">
    <HeaderBar :title="$t('faqs.title')" />

    <div class="content" :aria-label="$t('nav.faqs')">
      <!-- Gleiche Gestaltung wie die Einstellungen: Gruppenüberschrift + je Eintrag eine Karte mit Titel und Pfeil. -->
      <template v-for="group in groups" :key="group.titleKey">
        <h2 class="section-title">{{ $t(`faqs.${group.titleKey}`) }}</h2>
        <button
          v-for="key in group.keys"
          :key="key"
          type="button"
          class="card faq-card"
          @click="openFaq(key)"
        >
          <span class="card-title">{{ $t(`faqs.${key}`) }}</span>
          <span class="faq-chevron" aria-hidden="true"></span>
        </button>
      </template>

      <!-- FAQ Modal/Overlay -->
      <Teleport to="body">
        <Transition name="modal" appear>
          <div v-if="selectedFaqKey" class="modal-overlay" @click="closeFaq">
            <div class="modal-content" role="dialog" aria-modal="true" @click.stop>
              <div class="modal-header">
                <h4>{{ $t(`faqs.${selectedFaqKey}`) }}</h4>
                <button class="close-btn" :aria-label="$t('common.close')" @click="closeFaq">
                  <span>×</span>
                </button>
              </div>
              <div class="modal-body">
                <p v-for="(p, pi) in splitParagraphs($t(`faqs.${selectedFaqKey}Text`))" :key="pi">{{ p }}</p>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

      <h2 class="section-title">{{ $t('faqs.about') }}</h2>
      <section class="card about">
        <p>
          {{ $t('faqs.version') }}: <strong>{{ version }}</strong>
        </p>
      </section>
    </div>

  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import HeaderBar from '@/components/HeaderBar.vue'
import { useScrollLock } from '@/composables/useScrollLock'
import pkg from '../../package.json'

const version = computed(() => pkg?.version || '0.0.0')

// FAQ modal state
const selectedFaqKey = ref('')
const { lock: lockBodyScroll, unlock: unlockBodyScroll } = useScrollLock()
watch(selectedFaqKey, (key) => (key ? lockBodyScroll() : unlockBodyScroll()), { immediate: true })
onBeforeUnmount(unlockBodyScroll)
const baseKeys = ['gettingStarted', 'pushPullLegs', 'navigation', 'workoutFlow', 'focusMode', 'symbols', 'restPauses', 'timedExercises', 'warmup', 'progressRules', 'progression', 'weightSuggestion', 'startWeight', 'statsReading', 'aiCoach', 'workouts', 'uploads', 'privacy']
// Gruppierte Anzeige (Absprache Paul 22.10.): jeder Eintrag steht in genau einer Gruppe.
const groups = [
  { titleKey: 'groupStart', keys: ['gettingStarted', 'pushPullLegs', 'trainingPlans', 'navigation'] },
  { titleKey: 'groupWorkout', keys: ['workoutFlow', 'swapExercise', 'focusMode', 'symbols', 'restPauses', 'timedExercises', 'warmup'] },
  { titleKey: 'groupProgress', keys: ['progressRules', 'progression', 'weightSuggestion', 'statsReading'] },
  { titleKey: 'groupAi', keys: ['aiCoach'] },
  { titleKey: 'groupAccount', keys: ['workouts', 'uploads', 'privacy'] }
]

function openFaq(faqKey) {
  selectedFaqKey.value = faqKey
}

// Erlaubt Deep-Links auf einen konkreten FAQ-Eintrag (z.B. von Settings aus auf die
// Fortschritts-Regeln, siehe SettingsView.vue) über ?open=<key> - nur ein bekannter Key wird
// akzeptiert, kein beliebiger Wert aus der URL wird ungeprüft als selectedFaqKey übernommen.
const route = useRoute()
const requestedOpenKey = route.query?.open
if (typeof requestedOpenKey === 'string' && baseKeys.includes(requestedOpenKey)) {
  selectedFaqKey.value = requestedOpenKey
}

function closeFaq() {
  selectedFaqKey.value = ''
}

function splitParagraphs(text) {
  return text ? text.split('\n\n').filter(p => p.trim()) : []
}
</script>

<style scoped>
.faqs-view { min-height: 100vh; background: var(--bg); color: var(--fg); padding-bottom: 70px; }
/* Gleiche Maße wie die Einstellungen (.settings-content) */
.content {
  padding: 20px;
  padding-bottom: 90px; /* Platz für BottomNav */
  max-width: 920px;
  margin: 0 auto;
  display: grid;
  gap: 14px;
}

.faq-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: 60px; /* gleiche Höhe wie eine zugeklappte Einstellungs-Karte */
  color: var(--fg);
  font: inherit;
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.faq-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

/* Pfeil wie bei den Einstellungen, nach rechts weisend (öffnet ein Fenster) */
.faq-chevron {
  flex: 0 0 auto;
  width: 9px;
  height: 9px;
  border-right: 2px solid var(--muted);
  border-bottom: 2px solid var(--muted);
  transform: rotate(-45deg);
}

.about p { margin: 0; }

/* Modal/Overlay */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: color-mix(in oklab, #000000 40%, transparent);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 1000;
}

.modal-content {
  background: var(--surface);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  max-width: 600px;
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 40px color-mix(in oklab, #000000 20%, transparent);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px 0 20px;
  border-bottom: 1px solid var(--card-border);
  margin-bottom: 20px;
}

.modal-header h4 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--fg);
}

.close-btn {
  background: transparent;
  border: none;
  font-size: 24px;
  color: var(--muted);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: color-mix(in oklab, var(--fg) 8%, transparent);
  color: var(--fg);
}

.modal-body {
  padding: 0 20px 20px 20px;
}

.modal-body p {
  margin: 0 0 16px 0;
  line-height: 1.6;
  color: var(--fg);
  /* Einfache Zeilenumbrüche (\n) im Text als Zeilen zeigen, z.B. die Liste in "Symbole & Farben". */
  white-space: pre-line;
}

.modal-body p:last-child {
  margin-bottom: 0;
}

/* Modal Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.9) translateY(20px);
}


@media (max-width: 480px) {
  .modal-overlay {
    padding: 12px;
  }
  
  .modal-content {
    max-height: 85vh;
  }
  
  .modal-header {
    padding: 16px 16px 0 16px;
    margin-bottom: 16px;
  }
  
  .modal-header h4 {
    font-size: 16px;
  }
  
  .modal-body {
    padding: 0 16px 16px 16px;
  }
  
}

@media (min-width: 768px) {
  .content { grid-template-columns: 1fr; }
}
</style>
