<template>
  <!-- Eigener Abschnitt "Deine Frage" unter dem Feedback (nur wenn die Notizen dieser Einheit eine Frage enthielten).
       Trainingsfragen: Antwort der KI. Gesundheitsfragen und Fragen ohne Bezug zum Training: feste Hinweise, der Text des
       Nutzers wird nicht wiederholt. Sprache = Sprache des Feedbacks (siehe utils/feedbackLanguage.js). -->
  <section v-if="items.length > 0" class="note-answers">
    <h4 class="note-answers-title">{{ tr('noteQuestion.title') }}</h4>
    <p v-for="(item, index) in items" :key="index" class="note-answer">{{ item }}</p>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  // [{ kind: 'training' | 'health' | 'other', text: string }]
  answers: { type: Array, default: () => [] },
  // Sprache des Feedbacks ('de' | 'en'); leer = App-Sprache
  language: { type: String, default: '' }
})

const { t } = useI18n()
const tr = (key) => (props.language === 'de' || props.language === 'en' ? t(key, {}, { locale: props.language }) : t(key))

// Feste Hinweise erscheinen höchstens einmal, auch wenn zwei Fragen derselben Art gestellt wurden.
const items = computed(() => {
  const list = Array.isArray(props.answers) ? props.answers : []
  const result = []
  const seen = new Set()
  for (const entry of list) {
    const kind = entry?.kind
    if (kind === 'training') {
      const text = String(entry.text || '').trim()
      if (text) result.push(text)
    } else if ((kind === 'health' || kind === 'other') && !seen.has(kind)) {
      seen.add(kind)
      result.push(tr(`noteQuestion.${kind}`))
    }
  }
  return result
})
</script>

<style scoped>
.note-answers {
  margin-top: 1rem;
  padding: 0.75rem 0.9rem;
  border-radius: 12px;
  border: 1px solid var(--card-border);
  background: var(--surface);
}
.note-answers-title {
  margin: 0 0 0.4rem;
  font-size: 0.9rem;
  color: var(--accent-text);
}
.note-answer {
  margin: 0 0 0.5rem;
  font-size: 0.92rem;
  line-height: 1.45;
  color: var(--fg);
  white-space: pre-line;
}
.note-answer:last-child { margin-bottom: 0; }
</style>
