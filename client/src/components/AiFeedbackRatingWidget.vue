<template>
  <div class="rating-widget">
    <!-- Bereits bewertet: kompakte Anzeige mit Änderung/Entfernen-Option -->
    <div v-if="submittedRating && !editing" class="rating-summary">
      <span class="rating-summary-text">
        {{ t('feedbackHistory.ratingSaved') }}
        <span class="rating-summary-value">
          {{ submittedRating.rating === 'helpful' ? t('feedbackHistory.ratingHelpful') : t('feedbackHistory.ratingNotHelpful') }}
        </span>
      </span>
      <div class="rating-summary-actions">
        <button type="button" class="rating-link-btn" @click="startEdit">{{ t('feedbackHistory.ratingChange') }}</button>
        <button type="button" class="rating-link-btn rating-link-btn--danger" @click="removeRating">{{ t('feedbackHistory.ratingRemove') }}</button>
      </div>
    </div>

    <!-- Frage + Daumen hoch/runter (freiwillig, nie blockierend) -->
    <div v-else-if="!pendingRating" class="rating-question">
      <span class="rating-question-text">{{ t('feedbackHistory.ratingQuestion') }}</span>
      <div class="rating-thumbs">
        <button type="button" class="rating-thumb" :aria-label="t('feedbackHistory.ratingHelpful')" @click="choose('helpful')">
          <ThumbsUp class="rating-thumb-icon" aria-hidden="true" />
        </button>
        <button type="button" class="rating-thumb" :aria-label="t('feedbackHistory.ratingNotHelpful')" @click="choose('not_helpful')">
          <ThumbsDown class="rating-thumb-icon" aria-hidden="true" />
        </button>
      </div>
    </div>

    <!-- Optionale Gründe + (nur bei "nicht hilfreich") Freitext -->
    <div v-else class="rating-details">
      <div class="rating-reason-chips">
        <button
          v-for="code in reasonCodesForCurrentRating"
          :key="code"
          type="button"
          class="rating-reason-chip"
          :class="{ selected: selectedReasons.includes(code) }"
          @click="toggleReason(code)"
        >
          {{ t(`feedbackHistory.ratingReason${pendingRating === 'helpful' ? 'Helpful' : 'NotHelpful'}_${code}`) }}
        </button>
      </div>

      <textarea
        v-if="pendingRating === 'not_helpful'"
        v-model="correctionText"
        class="rating-correction-input"
        rows="2"
        maxlength="1000"
        :placeholder="t('feedbackHistory.ratingCorrectionPlaceholder')"
      />

      <p v-if="submitError" class="rating-error">{{ submitError }}</p>

      <div class="rating-submit-actions">
        <button type="button" class="rating-cancel-btn" @click="cancel">{{ t('feedbackHistory.ratingCancel') }}</button>
        <button type="button" class="rating-submit-btn" :disabled="submitting" @click="submit">
          <span v-if="submitting" class="rating-submit-spinner spin-indicator" aria-hidden="true"></span>
          {{ submitting ? t('feedbackHistory.ratingSaving') : t('feedbackHistory.ratingSubmit') }}
        </button>
      </div>
    </div>

    <!-- Persönliche Lernlogik: Korrektur einer konkreten Übung zuordnen, dann ausdrücklich
         bestätigen lassen, bevor irgendetwas in einem persönlichen Übungsprofil landet
         (siehe Prompt "Persönliche Lernlogik" - nie automatisch, immer nach Bestätigung). -->
    <div v-if="showExercisePicker" class="rating-note-flow">
      <p class="rating-note-question">{{ t('feedbackHistory.ratingWhichExercise') }}</p>
      <div class="rating-exercise-list">
        <button
          v-for="name in exerciseNames"
          :key="name"
          type="button"
          class="rating-reason-chip"
          @click="pickExerciseForNote(name)"
        >
          {{ name }}
        </button>
      </div>
      <button type="button" class="rating-link-btn" @click="skipNoteFlow">{{ t('feedbackHistory.ratingCancel') }}</button>
    </div>

    <div v-else-if="showConfirmNote" class="rating-note-flow">
      <p class="rating-note-question">{{ t('feedbackHistory.ratingConfirmNoteQuestion') }}</p>
      <div class="rating-submit-actions">
        <button type="button" class="rating-cancel-btn" @click="skipNoteFlow">{{ t('feedbackHistory.ratingConfirmNoteNo') }}</button>
        <button type="button" class="rating-submit-btn" @click="confirmNote">{{ t('feedbackHistory.ratingConfirmNoteYes') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ThumbsUp, ThumbsDown } from 'lucide-vue-next'
import { useFirebaseAuth } from '@/utils/firebaseAuth'
import { useToastStore } from '@/stores/toastStore'
import {
  fetchFeedbackRating,
  submitFeedbackRating,
  deleteFeedbackRating,
  confirmExerciseNote
} from '@/api/feedbackRatings'
import { logger } from '@/utils/logger'
import { reasonCodesForRating, toggleReasonCode, shouldOfferExerciseNote } from '@/utils/feedbackRatingHelpers'

// Freiwillige Bewertung eines einzelnen KI-Feedbacks ("War dieses Feedback hilfreich?").
// Rein additiv/nicht-blockierend - ein Fehler hier darf laut Vorgabe niemals das eigentliche
// KI-Feedback beeinträchtigen (siehe try/catch in allen Handlern unten, kein Werfen nach
// außen, nur ein unaufdringlicher Fehlertext innerhalb dieses Widgets).
const props = defineProps({
  workoutId: {
    type: String,
    required: true
  },
  // Übungsnamen dieses Workouts, für die optionale "welche Übung meinst du?"-Zuordnung bei
  // einer Korrektur. Leer bei älteren Verlaufseinträgen ohne gespeicherten Snapshot - dann
  // wird die Notiz-Zuordnung einfach übersprungen (kein Blocker).
  exerciseNames: {
    type: Array,
    default: () => []
  }
})

const { t } = useI18n()
const router = useRouter()
const { getIdToken } = useFirebaseAuth()
const toast = useToastStore()

// Nach Abschluss der kompletten Bewertung (inkl. optionaler "welche Übung"-Zuordnung, falls
// eine Korrektur angegeben wurde) automatisch zurück zum Dashboard springen - auf Wunsch, statt
// den Nutzer in der Zusammenfassung/im Feedback-Verlauf "hängen" zu lassen. Kurze Verzögerung,
// damit die Erfolgsmeldung/das Ergebnis noch kurz sichtbar ist, bevor navigiert wird.
function returnToDashboardAfterRating() {
  setTimeout(() => {
    router.push('/dashboard').catch(() => {})
  }, 700)
}

const submittedRating = ref(null)
const editing = ref(false)
const pendingRating = ref(null)
const selectedReasons = ref([])
const correctionText = ref('')
const submitting = ref(false)
const submitError = ref('')

const showExercisePicker = ref(false)
const showConfirmNote = ref(false)
const pendingNoteExercise = ref('')
const pendingNoteText = ref('')

const reasonCodesForCurrentRating = computed(() => reasonCodesForRating(pendingRating.value))

function choose(rating) {
  pendingRating.value = rating
  selectedReasons.value = []
  correctionText.value = ''
  submitError.value = ''
}

function toggleReason(code) {
  selectedReasons.value = toggleReasonCode(selectedReasons.value, code)
}

function cancel() {
  pendingRating.value = null
  editing.value = false
  selectedReasons.value = []
  correctionText.value = ''
  submitError.value = ''
}

function startEdit() {
  editing.value = true
  pendingRating.value = submittedRating.value?.rating || 'helpful'
  selectedReasons.value = [...(submittedRating.value?.reasonCodes || [])]
  correctionText.value = submittedRating.value?.correctionText || ''
  submitError.value = ''
}

async function submit() {
  submitting.value = true
  submitError.value = ''
  try {
    const token = await getIdToken().catch(() => null)
    const saved = await submitFeedbackRating(props.workoutId, {
      rating: pendingRating.value,
      reasonCodes: selectedReasons.value,
      correctionText: correctionText.value.trim() || null
    }, token)
    submittedRating.value = saved
    editing.value = false
    const finishedText = correctionText.value.trim()
    const finishedRating = pendingRating.value
    pendingRating.value = null

    // Persönliche Lernlogik nur anstoßen, wenn tatsächlich ein Korrekturtext da ist UND wir
    // wissen, um welche Übung(en) es in diesem Workout überhaupt geht.
    if (shouldOfferExerciseNote({ rating: finishedRating, correctionText: finishedText, exerciseNames: props.exerciseNames })) {
      pendingNoteText.value = finishedText
      if (props.exerciseNames.length === 1) {
        pendingNoteExercise.value = props.exerciseNames[0]
        showConfirmNote.value = true
      } else {
        showExercisePicker.value = true
      }
    } else {
      // Keine Übungs-Notiz-Zuordnung nötig - die Bewertung ist damit vollständig abgeschlossen.
      returnToDashboardAfterRating()
    }
  } catch (err) {
    logger.warn('[AiFeedbackRatingWidget] submit failed', err?.message)
    submitError.value = t('feedbackHistory.ratingSaveError')
  } finally {
    submitting.value = false
  }
}

async function removeRating() {
  try {
    const token = await getIdToken().catch(() => null)
    await deleteFeedbackRating(props.workoutId, token)
    submittedRating.value = null
    editing.value = false
  } catch (err) {
    logger.warn('[AiFeedbackRatingWidget] removeRating failed', err?.message)
    toast.error(t('feedbackHistory.ratingDeleteError'))
  }
}

function pickExerciseForNote(name) {
  pendingNoteExercise.value = name
  showExercisePicker.value = false
  showConfirmNote.value = true
}

function skipNoteFlow() {
  showExercisePicker.value = false
  showConfirmNote.value = false
  pendingNoteExercise.value = ''
  pendingNoteText.value = ''
  // Auch wenn die Notiz-Zuordnung übersprungen wird, ist die Bewertung selbst damit fertig.
  returnToDashboardAfterRating()
}

async function confirmNote() {
  const exerciseName = pendingNoteExercise.value
  const noteText = pendingNoteText.value
  skipNoteFlow()
  try {
    const token = await getIdToken().catch(() => null)
    await confirmExerciseNote(exerciseName, noteText, token)
    toast.success(t('feedbackHistory.ratingNoteSaved'))
  } catch (err) {
    logger.warn('[AiFeedbackRatingWidget] confirmNote failed', err?.message)
    toast.error(t('feedbackHistory.ratingNoteSaveError'))
  }
}

onMounted(async () => {
  try {
    const token = await getIdToken().catch(() => null)
    const existing = await fetchFeedbackRating(props.workoutId, token)
    if (existing) submittedRating.value = existing
  } catch (err) {
    // Nicht-blockierend: ohne geladene Bewertung zeigt das Widget einfach den unbewerteten
    // Ausgangszustand - kein Fehler für den Nutzer sichtbar.
    logger.debug('[AiFeedbackRatingWidget] fetchFeedbackRating failed', err?.message)
  }
})
</script>

<style scoped>
.rating-widget {
  margin-top: 0.85rem;
  padding-top: 0.85rem;
  border-top: 1px solid var(--line-soft);
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.rating-question,
.rating-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.rating-question-text,
.rating-summary-text {
  font-size: 0.85rem;
  color: var(--muted);
}

.rating-summary-value {
  color: var(--fg);
  font-weight: 600;
}

.rating-summary-actions {
  display: flex;
  gap: 0.75rem;
}

.rating-thumbs {
  display: flex;
  gap: 0.5rem;
}

.rating-thumb {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /* War vorher 2.25rem/18px-Icon - auf einem Telefon kaum antippbar/erkennbar. Apple/Google
     empfehlen mind. 44x44px Tap-Ziel für Buttons - jetzt entsprechend größer. */
  /* width: 3rem; */
  height: 3rem;
  border-radius: 999px;
  border: 1px solid var(--line-soft);
  background: var(--surface);
  cursor: pointer;
  flex-shrink: 0;
}

.rating-thumb:active {
  background: var(--surface-strong);
}

.rating-thumb-icon {
  width: 26px;
  height: 26px;
  stroke: var(--fg);
  stroke-width: 2;
  fill: none;
}

.rating-link-btn {
  background: none;
  border: none;
  padding: 0;
  color: var(--accent);
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
}

.rating-link-btn--danger {
  color: var(--warning-text);
}

.rating-details {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.rating-reason-chips,
.rating-exercise-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.rating-reason-chip {
  padding: 0.35rem 0.7rem;
  border-radius: var(--chip-radius, 16px);
  border: 1px solid var(--line-soft);
  background: var(--surface);
  color: var(--fg);
  font-size: 0.8rem;
  cursor: pointer;
}

.rating-reason-chip.selected {
  border-color: color-mix(in srgb, var(--accent) 60%, var(--line-strong));
  background: var(--accent-soft);
  color: var(--fg);
  font-weight: 600;
}

.rating-correction-input {
  width: 100%;
  padding: 0.6rem 0.7rem;
  border-radius: 0.6rem;
  border: 1px solid var(--line-soft);
  background: var(--bg-panel);
  color: var(--fg);
  font-size: 0.85rem;
  resize: vertical;
  font-family: inherit;
}

.rating-error {
  color: var(--warning-text);
  font-size: 0.8rem;
  margin: 0;
}

.rating-submit-actions {
  display: flex;
  gap: 0.6rem;
  justify-content: flex-end;
}

.rating-cancel-btn {
  padding: 0.5rem 0.9rem;
  border-radius: 0.5rem;
  border: 1px solid var(--line-soft);
  background: transparent;
  color: var(--muted);
  font-size: 0.85rem;
  cursor: pointer;
}

.rating-submit-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0.5rem 0.9rem;
  border-radius: 0.5rem;
  border: none;
  background: var(--accent);
  color: var(--accent-contrast);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.rating-submit-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

/* Sichtbarer Ladeindikator, falls das Speichern der Bewertung etwas länger dauert (z.B.
   langsames Netz) - bisher änderte sich nur der Button-Text, was leicht übersehen wurde. */
.rating-submit-spinner {
  width: 0.9rem;
  height: 0.9rem;
  border: 2px solid color-mix(in srgb, var(--accent-contrast) 35%, transparent);
  border-top-color: var(--accent-contrast);
  border-radius: 50%;
  animation: rating-spin 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes rating-spin {
  to { transform: rotate(360deg); }
}

.rating-note-flow {
  padding: 0.6rem 0.7rem;
  border-radius: 0.6rem;
  background: var(--surface);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.rating-note-question {
  margin: 0;
  font-size: 0.85rem;
  color: var(--fg);
}
</style>
