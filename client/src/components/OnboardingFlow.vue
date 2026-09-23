<template>
  <div class="onboarding-overlay">
    <!-- Sprachauswahl VOR dem eigentlichen Guide - bewusst nicht Teil von totalSteps/der
         Punkte-Anzeige, da sie nur beim allerersten Start erscheint (siehe showLanguagePicker),
         nicht bei einem manuellen "Einführungsguide erneut starten" aus den Einstellungen, wenn
         schon eine Sprache gewählt wurde. Beschriftungen bewusst NICHT übersetzt ("Deutsch"/
         "English" statt $t(...)) - die Sprache des Nutzers ist an dieser Stelle ja noch unbekannt. -->
    <template v-if="showLanguagePicker">
      <div class="onboarding-content onboarding-content--centered">
        <div class="onboarding-step">
          <h1 class="onboarding-title" data-i18n-ignore>Sprache wählen<br />Choose your language</h1>
          <div class="onboarding-lang-options">
            <button type="button" class="onboarding-lang-btn" @click="chooseLanguage('de')">Deutsch</button>
            <button type="button" class="onboarding-lang-btn" @click="chooseLanguage('en')">English</button>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="onboarding-topbar">
        <div class="onboarding-dots" role="progressbar" :aria-valuenow="step + 1" :aria-valuemin="1" :aria-valuemax="totalSteps">
          <span
            v-for="i in totalSteps"
            :key="i"
            class="onboarding-dot"
            :class="{ 'onboarding-dot--active': i - 1 === step }"
          />
        </div>
        <button type="button" class="onboarding-skip" @click="handleSkip">
          {{ t('onboarding.skip') }}
        </button>
      </div>

      <div class="onboarding-content">
        <Transition name="onboarding-fade" mode="out-in">
          <div :key="step" class="onboarding-step">
            <h1 class="onboarding-title">{{ t(`onboarding.step${step + 1}Title`) }}</h1>
            <p class="onboarding-text">{{ t(`onboarding.step${step + 1}Text`) }}</p>
            <ul v-if="isRulesStep" class="onboarding-rules-list">
              <li v-for="n in 5" :key="n">{{ t(`onboarding.rulesItem${n}`) }}</li>
            </ul>
          </div>
        </Transition>
      </div>

      <div class="onboarding-footer">
        <button type="button" class="onboarding-primary-btn" @click="handleNext">
          {{ isLastStep ? t('onboarding.finish') : t('onboarding.next') }}
        </button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settingsStore'

// Vollbild-Overlay statt eigener Router-Route (siehe Begründung in onboardingStore.js/main.js):
// eine eigene Route hätte sich mit dem bestehenden, bereits fragilen Zusammenspiel aus
// Router-Guards/Resume-Snapshot/Auth-Redirect in main.js überschnitten. Als reines Overlay über
// der aktuellen Seite blockiert es keine bestehende Navigation.
// Schritt 2 ("So machst du wirklich Fortschritte") ist die einzige Seite mit einer Liste statt
// Fließtext - daher totalSteps 5 -> 6 und ein eigenes Flag, das im Template die Regel-Liste
// zusätzlich zum normalen step2Text rendert (siehe onboarding.rulesItem1-5 in i18n/index.js).
const totalSteps = 6
const RULES_STEP_INDEX = 1

const emit = defineEmits(['complete', 'skip'])

const { t, locale } = useI18n()
const settingsStore = useSettingsStore()

// Nur beim allerersten Start fragen (settingsStore.language ist null, solange nie explizit
// gewählt/gespeichert - siehe app-lang-Handling in settingsStore.js/i18n/index.js). Ein späteres
// manuelles "Einführungsguide erneut starten" (SettingsView.vue) hat dann bereits eine Sprache
// gesetzt und überspringt diesen Screen.
const showLanguagePicker = ref(!settingsStore.language)

function chooseLanguage(lang) {
  locale.value = lang
  settingsStore.setLanguage(lang)
  showLanguagePicker.value = false
}

const step = ref(0)
const isLastStep = computed(() => step.value === totalSteps - 1)
const isRulesStep = computed(() => step.value === RULES_STEP_INDEX)

function handleNext() {
  if (isLastStep.value) {
    emit('complete')
    return
  }
  step.value += 1
}

function handleSkip() {
  emit('skip')
}
</script>

<style scoped>
/* z-index bewusst über BottomNav (1000) und PostWorkoutSummary (1010) - dieser Flow soll
   direkt nach dem Login alles überlagern. Kein backdrop-filter (siehe Absturz-Hinweis in
   PostWorkoutSummary.vue: backdrop-filter auf einem fixed-Element ist auf iOS/WKWebView ein
   bekanntes GPU-Compositing-Absturzmuster, besonders wenn während der Anzeige die Tastatur
   aufklappt) - deckender Hintergrund über var(--bg) reicht für ein ruhiges, klares Erscheinungsbild. */
.onboarding-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: var(--bg);
  color: var(--fg);
  display: flex;
  flex-direction: column;
  /* env(safe-area-inset-*) direkt hier statt über die globalen .safe-area-top/-bottom-Klassen
     (siehe style.css): die waren zwar im Template gesetzt, aber diese Regel hier hatte durch
     das automatisch angehängte Scoped-Attribut höhere Spezifität und überschrieb deren
     padding-top/-bottom vollständig mit dem festen 1.25rem - der "Überspringen"-Button landete
     dadurch zu nah an Notch/Dynamic Island statt darunter (Rückmeldung: "zu weit oben"). */
  padding: calc(1.25rem + env(safe-area-inset-top, 0px)) 1.5rem calc(1.25rem + env(safe-area-inset-bottom, 0px));
}

.onboarding-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 44px;
}

.onboarding-dots {
  display: flex;
  gap: 0.5rem;
}

.onboarding-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--line-soft);
  transition: background 0.2s ease, transform 0.2s ease;
}

.onboarding-dot--active {
  background: var(--accent);
  transform: scale(1.25);
}

/* Sichtbar, aber bewusst weniger dominant als der primäre Button (siehe Vorgabe) - kein
   gefüllter Button, keine Akzentfarbe, nur gedämpfter Text mit ausreichend großer Tap-Fläche. */
.onboarding-skip {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 0.95rem;
  font-weight: 500;
  padding: 0.5rem 0.25rem;
  cursor: pointer;
  min-height: 44px;
}

.onboarding-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  text-align: left;
  padding: 1rem 0.25rem;
  overflow-y: auto;
}

.onboarding-step {
  width: 100%;
}

.onboarding-content--centered {
  align-items: center;
  text-align: center;
}

.onboarding-lang-options {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.onboarding-lang-btn {
  width: 100%;
  min-height: 54px;
  border-radius: var(--panel-radius, 28px);
  border: 1px solid var(--line-soft);
  background: var(--surface);
  color: var(--fg);
  font-size: 1.05rem;
  font-weight: 700;
  cursor: pointer;
}

.onboarding-lang-btn:active {
  opacity: 0.85;
}

.onboarding-title {
  font-size: clamp(1.6rem, 6vw, 2.1rem);
  font-weight: 700;
  line-height: 1.25;
  margin: 0 0 1rem;
  /* Kein festes max-height/overflow: hidden - Texte dürfen bei größeren Systemschriftgrößen
     (Dynamic Type) mehrzeilig umbrechen, statt abgeschnitten zu werden (siehe Vorgabe). */
}

.onboarding-text {
  font-size: clamp(1.05rem, 4vw, 1.2rem);
  line-height: 1.55;
  color: var(--muted);
  margin: 0;
}

.onboarding-rules-list {
  list-style: none;
  margin: 1.25rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.onboarding-rules-list li {
  position: relative;
  padding-left: 1.6rem;
  font-size: clamp(0.98rem, 3.6vw, 1.08rem);
  line-height: 1.4;
  color: var(--fg);
}

.onboarding-rules-list li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: var(--accent);
  font-weight: 700;
}

.onboarding-footer {
  padding-top: 1rem;
}

.onboarding-primary-btn {
  width: 100%;
  min-height: 54px;
  border-radius: var(--panel-radius, 28px);
  border: none;
  background: var(--accent);
  color: var(--accent-contrast);
  font-size: 1.05rem;
  font-weight: 700;
  cursor: pointer;
}

.onboarding-primary-btn:active {
  opacity: 0.85;
}

.onboarding-fade-enter-active,
.onboarding-fade-leave-active {
  transition: opacity 0.18s ease;
}

.onboarding-fade-enter-from,
.onboarding-fade-leave-to {
  opacity: 0;
}
</style>
