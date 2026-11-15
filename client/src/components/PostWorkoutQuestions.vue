<template>
  <div class="summary-content post-questions" role="group" :aria-label="heading">
    <!-- Angebot zum Ausschalten (nach mehrmaligem Überspringen in Folge) -->
    <template v-if="phase === 'offer'">
      <p class="pq-question">{{ t('postQuestions.offerOffText') }}</p>
      <div class="pq-options">
        <button class="pq-option" type="button" @click="turnOff">{{ t('postQuestions.offerOff') }}</button>
        <button class="primary pq-option" type="button" @click="keepAsking">{{ t('postQuestions.offerKeep') }}</button>
      </div>
    </template>

    <!-- Erklärung beim ersten Mal -->
    <template v-else-if="phase === 'intro'">
      <h3 class="pq-title">{{ t('postQuestions.introTitle') }}</h3>
      <p class="pq-text">{{ t('postQuestions.introText') }}</p>
      <div class="pq-options">
        <button class="primary pq-option" type="button" @click="startAsking">{{ t('postQuestions.introAnswer') }}</button>
        <button class="pq-option" type="button" @click="declineIntro">{{ t('postQuestions.introDecline') }}</button>
      </div>
    </template>

    <!-- Eine Frage, ein Tipp. Keine Zählung wie "Frage 1 von 2" -->
    <template v-else-if="current">
      <p class="pq-question" aria-live="polite">{{ questionText }}</p>
      <div class="pq-options">
        <button
          v-for="option in options"
          :key="option.value"
          class="pq-option"
          type="button"
          @click="choose(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
      <button class="pq-skip" type="button" @click="skip">{{ t('postQuestions.skip') }}</button>
    </template>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useExerciseTranslation } from '@/utils/exerciseTranslation'
import { markIntroSeen, setQuestionsEnabled, resetSkips } from '@/utils/postWorkoutQuestionPrefs'

const props = defineProps({
  // Ergebnis von detectQuestionTopics (höchstens zwei Themen).
  topics: { type: Array, required: true },
  // 'offer' (Ausschalten anbieten) | 'intro' (Erklärung beim ersten Mal) | 'ask' (gleich fragen)
  initialPhase: { type: String, default: 'ask' }
})

// done: { answers: [{ topic, exerciseIndex, answer, reason?, variant? }], skipped: boolean, declinedIntro?: boolean, turnedOff?: boolean }
const emit = defineEmits(['done'])

const { t } = useI18n()
const { getTranslatedExerciseName } = useExerciseTranslation()

const phase = ref(['offer', 'intro', 'ask'].includes(props.initialPhase) ? props.initialPhase : 'ask')
const stepIndex = ref(0)
const answers = ref([])
// Bei "War das Absicht?": die Antwort, auf die noch der Grund folgt.
const pendingIntent = ref('')

const current = computed(() => props.topics[stepIndex.value] || null)
const heading = computed(() => {
  if (phase.value === 'intro') return t('postQuestions.introTitle')
  if (phase.value === 'offer') return t('postQuestions.offerOffText')
  return questionText.value || t('postQuestions.settingsTitle')
})

function uniformReps(summary) {
  const list = Array.isArray(summary?.repsList) ? summary.repsList : []
  return list.length && list.every((value) => value === list[0]) ? list[0] : null
}

const questionText = computed(() => {
  const topic = current.value
  if (!topic) return ''
  const exercise = getTranslatedExerciseName(topic.facts?.name || '')
  if (topic.topic === 'last_set') {
    const now = topic.facts?.now || {}
    const reps = Array.isArray(now.repsList) && now.repsList.length ? Math.min(...now.repsList) : now.reps
    return t('postQuestions.lastSetQuestion', { exercise, sets: now.sets, reps, weight: now.weight })
  }
  if (topic.topic === 'compare') {
    return t(topic.kind === 'same' ? 'postQuestions.compareSame' : 'postQuestions.compareLess', { exercise })
  }
  // Absicht: nach der ersten Antwort kommt der Grund.
  if (pendingIntent.value) return t('postQuestions.why')
  if (topic.kind === 'skipped') return t('postQuestions.intentSkipped', { exercise })
  if (topic.kind === 'weight_drop') return t('postQuestions.intentWeight', { exercise })
  const nowReps = uniformReps(topic.facts?.now)
  const lastReps = uniformReps(topic.facts?.last)
  if (nowReps !== null && lastReps !== null) {
    return t('postQuestions.intentScheme', {
      exercise,
      now: `${topic.facts.now.sets}×${nowReps}`,
      last: `${topic.facts.last.sets}×${lastReps}`
    })
  }
  return t('postQuestions.intentSchemeGeneric', { exercise })
})

const LAST_SET_VALUES = ['easy', 'hard_air', 'limit_clean', 'limit_shaky']
const COMPARE_VALUES = ['cleaner', 'same', 'harder', 'shakier']
const INTENT_VALUES = ['intended', 'adjusted', 'unsure']
const REASONS = {
  intended: ['other_goal', 'deload', 'feel_muscle', 'variety', 'other'],
  adjusted: ['too_tired', 'too_heavy', 'body_off', 'equipment_busy', 'no_time', 'other']
}

const options = computed(() => {
  const topic = current.value
  if (!topic) return []
  if (topic.topic === 'last_set') return LAST_SET_VALUES.map((value) => ({ value, label: t(`postQuestions.lastSet.${value}`) }))
  if (topic.topic === 'compare') return COMPARE_VALUES.map((value) => ({ value, label: t(`postQuestions.compare.${value}`) }))
  if (pendingIntent.value) return REASONS[pendingIntent.value].map((value) => ({ value, label: t(`postQuestions.reasons.${value}`) }))
  return INTENT_VALUES.map((value) => ({ value, label: t(`postQuestions.intent.${value}`) }))
})

function finish(extra = {}) {
  // Ist der Grund noch offen, zählt die Antwort auf "War das Absicht?" trotzdem (Beantwortetes zählt).
  if (pendingIntent.value && current.value) {
    answers.value.push({ topic: 'intent', exerciseIndex: current.value.exerciseIndex, answer: pendingIntent.value })
    pendingIntent.value = ''
  }
  emit('done', { answers: answers.value.slice(), skipped: false, ...extra })
}

function next() {
  pendingIntent.value = ''
  if (stepIndex.value + 1 >= props.topics.length) {
    emit('done', { answers: answers.value.slice(), skipped: false })
    return
  }
  stepIndex.value += 1
}

function choose(value) {
  const topic = current.value
  if (!topic) return
  if (topic.topic === 'last_set') {
    answers.value.push({ topic: 'last_set', exerciseIndex: topic.exerciseIndex, answer: value })
    return next()
  }
  if (topic.topic === 'compare') {
    answers.value.push({ topic: 'compare', exerciseIndex: topic.exerciseIndex, answer: value, variant: topic.kind })
    return next()
  }
  // Absicht
  if (pendingIntent.value) {
    answers.value.push({ topic: 'intent', exerciseIndex: topic.exerciseIndex, answer: pendingIntent.value, reason: value })
    return next()
  }
  if (value === 'unsure') {
    answers.value.push({ topic: 'intent', exerciseIndex: topic.exerciseIndex, answer: 'unsure' })
    return next()
  }
  pendingIntent.value = value
}

// "Überspringen" beendet alle Fragen; schon Beantwortetes bleibt erhalten.
function skip() {
  finish({ skipped: true })
}

function startAsking() {
  markIntroSeen()
  phase.value = 'ask'
}

function declineIntro() {
  markIntroSeen()
  emit('done', { answers: [], skipped: true, declinedIntro: true })
}

function turnOff() {
  setQuestionsEnabled(false)
  emit('done', { answers: [], skipped: true, turnedOff: true })
}

function keepAsking() {
  resetSkips()
  phase.value = 'ask'
}
</script>

<style scoped>
.post-questions {
  align-items: stretch;
  text-align: left;
  gap: 1rem;
}

.pq-title {
  margin: 0;
  font-size: 1.15rem;
}

.pq-text,
.pq-question {
  margin: 0;
  line-height: 1.45;
  color: var(--fg);
}

.pq-question {
  font-weight: 600;
}

.pq-options {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

/* Lange Antworten (z. B. "Am Limit, die Ausführung wurde wackelig") dürfen umbrechen. */
.pq-option {
  width: 100%;
  white-space: normal;
  text-align: left;
  line-height: 1.3;
  height: auto;
  padding-top: 0.7rem;
  padding-bottom: 0.7rem;
}

.pq-skip {
  align-self: center;
  background: transparent;
  border: none;
  color: var(--muted);
  text-decoration: underline;
  padding: 0.5rem 0.75rem;
}
</style>
