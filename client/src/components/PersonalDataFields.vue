<template>
  <div class="personal-data-fields">
    <p class="personal-data-hint">{{ t('personalData.hint') }}</p>

    <div class="field-row">
      <label class="field-label" for="personal-data-age">{{ t('personalData.age') }}</label>
      <input
        id="personal-data-age"
        class="field-input"
        type="number"
        inputmode="numeric"
        min="10"
        max="120"
        :placeholder="t('personalData.agePlaceholder')"
        :value="modelValue.ageYears ?? ''"
        @input="onNumberInput('ageYears', $event)"
      />
    </div>

    <div class="field-row">
      <label class="field-label" for="personal-data-gender">{{ t('personalData.gender') }}</label>
      <select
        id="personal-data-gender"
        class="field-input"
        :value="modelValue.gender || 'unspecified'"
        @change="onGenderChange($event)"
      >
        <option value="unspecified">{{ t('personalData.genderUnspecified') }}</option>
        <option value="male">{{ t('personalData.genderMale') }}</option>
        <option value="female">{{ t('personalData.genderFemale') }}</option>
        <option value="diverse">{{ t('personalData.genderDiverse') }}</option>
      </select>
    </div>

    <div class="field-row">
      <label class="field-label" for="personal-data-height">{{ t('personalData.height') }}</label>
      <input
        id="personal-data-height"
        class="field-input"
        type="number"
        inputmode="numeric"
        min="100"
        max="250"
        :placeholder="t('personalData.heightPlaceholder')"
        :value="modelValue.heightCm ?? ''"
        @input="onNumberInput('heightCm', $event)"
      />
    </div>

    <div class="field-row">
      <label class="field-label" for="personal-data-weight">{{ t('personalData.weight') }}</label>
      <input
        id="personal-data-weight"
        class="field-input"
        type="number"
        inputmode="decimal"
        min="30"
        max="300"
        step="0.1"
        :placeholder="t('personalData.weightPlaceholder')"
        :value="modelValue.weightKg ?? ''"
        @input="onNumberInput('weightKg', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

// Gemeinsame Eingabefelder für die freiwilligen Profilangaben (Alter/Geschlecht/Größe/Gewicht) -
// wird sowohl im Onboarding (OnboardingFlow.vue, letzter Schritt) als auch in den Einstellungen
// (SettingsView.vue) verwendet, damit beide Stellen exakt dieselbe Validierung/UX haben statt
// zweier unabhängig gepflegter Kopien. JEDES Feld ist einzeln optional - leer lassen ist
// jederzeit ein gültiger Zustand ("keine Angabe"), es gibt bewusst keine Pflichtfeld-Markierung.
const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({ ageYears: null, gender: 'unspecified', heightCm: null, weightKg: null })
  }
})

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

// null statt NaN/'' bei leerem Feld, damit der Aufrufer (settingsStore.savePersonalData) ein
// leeres Feld sauber als "Nutzer hat das bewusst geleert" an das Backend weiterreichen kann.
function onNumberInput(field, event) {
  const raw = event?.target?.value
  const value = raw === '' || raw === null ? null : Number(raw)
  emit('update:modelValue', { ...props.modelValue, [field]: Number.isFinite(value) ? value : null })
}

function onGenderChange(event) {
  emit('update:modelValue', { ...props.modelValue, gender: event?.target?.value || 'unspecified' })
}
</script>

<style scoped>
.personal-data-fields {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.personal-data-hint {
  margin: 0 0 0.15rem;
  font-size: 0.85rem;
  color: var(--muted);
  line-height: 1.4;
}

.field-row {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--fg);
}

.field-input {
  width: 100%;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid var(--card-border, var(--line-soft));
  background: var(--surface, var(--bg-panel));
  color: var(--fg);
  font-size: 1rem;
  font-weight: 600;
  appearance: none;
}

.field-input:focus {
  outline: none;
  border-color: color-mix(in srgb, var(--accent-color, var(--accent)) 45%, var(--card-border, var(--line-soft)));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-color, var(--accent)) 18%, transparent);
}
</style>
