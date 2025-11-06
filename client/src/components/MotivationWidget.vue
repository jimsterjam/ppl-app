<template>
  <div class="motivation-widget">
    <div class="quote-content">
      <div class="quote-icon">💡</div>
      <blockquote class="quote-text">
        "{{ currentQuote.text }}"
      </blockquote>
      <cite class="quote-author">{{ currentQuote.author }}</cite>
    </div>
    <button 
      class="refresh-btn" 
      :title="t('motivation.newQuote')"
      @click="getNewQuote"
    >
      🔄
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()

const currentQuote = ref({
  text: 'Die größte Herausforderung ist nicht die im Gym, sondern die auf dem Weg dorthin.',
  author: 'Unbekannt'
})

const motivationQuotesDe = [
  {
    text: 'Die größte Herausforderung ist nicht die im Gym, sondern die auf dem Weg dorthin.',
    author: 'Unbekannt'
  },
  {
    text: 'Erfolg beginnt mit der Entscheidung, es zu versuchen.',
    author: 'John C. Maxwell'
  },
  {
    text: 'Du wirst nie bereuen, trainiert zu haben, aber du wirst es bereuen, es nicht getan zu haben.',
    author: 'Unbekannt'
  },
  {
    text: 'Ein Jahr von heute an wirst du dir wünschen, du hättest heute angefangen.',
    author: 'Karen Lamb'
  },
  {
    text: 'Stärke kommt nicht vom körperlichen Können. Sie entsteht aus unbeugsamer Willenskraft.',
    author: 'Mahatma Gandhi'
  },
  {
    text: 'Der Schmerz, den du heute fühlst, ist die Stärke, die du morgen spürst.',
    author: 'Unbekannt'
  },
  {
    text: 'Champions werden nicht in den Gyms gemacht. Champions werden aus etwas tief in ihnen gemacht - einem Wunsch, einem Traum, einer Vision.',
    author: 'Muhammad Ali'
  },
  {
    text: 'Wenn es einfach wäre, würde es jeder machen.',
    author: 'Unbekannt'
  },
  {
    text: 'Die einzige Person, gegen die du im Wettbewerb stehst, ist die Person, die du gestern warst.',
    author: 'Unbekannt'
  },
  {
    text: 'Disziplin ist die Brücke zwischen Zielen und Erfolg.',
    author: 'Jim Rohn'
  },
  {
    text: 'Tu heute etwas, wofür dein zukünftiges Ich dir danken wird.',
    author: 'Sean Patrick Flanery'
  },
  {
    text: 'Der Körper erreicht, was der Geist glaubt.',
    author: 'Unbekannt'
  },
  {
    text: 'Motivation bringt dich in Gang. Gewohnheit hält dich in Gang.',
    author: 'Jim Ryun'
  },
  {
    text: 'Du musst nicht großartig sein, um anzufangen, aber du musst anfangen, um großartig zu werden.',
    author: 'Zig Ziglar'
  },
  {
    text: 'Der Unterschied zwischen dem Unmöglichen und dem Möglichen liegt in der Entschlossenheit einer Person.',
    author: 'Tommy Lasorda'
  },
  {
    text: 'Jeder Experte war einmal ein Anfänger.',
    author: 'Helen Hayes'
  },
  {
    text: 'Gib nie auf! Versagen und Ablehnung sind nur der erste Schritt zum Erfolg.',
    author: 'Jim Valvano'
  },
  {
    text: 'Das Schwierigste ist die Entscheidung zu handeln, der Rest ist nur Hartnäckigkeit.',
    author: 'Amelia Earhart'
  },
  {
    text: 'Sei stärker als deine Ausreden.',
    author: 'Unbekannt'
  },
  {
    text: 'Ein kluger Mensch lernt aus den Fehlern anderer, ein weiser aus seinen eigenen, aber der weiseste macht gar keine.',
    author: 'Unbekannt'
  }
]

const motivationQuotesEn = [
  { text: 'The biggest challenge isn’t in the gym, it’s getting there.', author: 'Unknown' },
  { text: 'Success begins with the decision to try.', author: 'John C. Maxwell' },
  { text: 'You’ll never regret a workout, but you’ll regret skipping it.', author: 'Unknown' },
  { text: 'A year from now you may wish you had started today.', author: 'Karen Lamb' },
  { text: 'Strength does not come from physical capacity. It comes from an indomitable will.', author: 'Mahatma Gandhi' },
  { text: 'The pain you feel today is the strength you feel tomorrow.', author: 'Unknown' },
  { text: 'Champions aren’t made in gyms. Champions are made from something they have deep inside them — a desire, a dream, a vision.', author: 'Muhammad Ali' },
  { text: 'If it were easy, everyone would do it.', author: 'Unknown' },
  { text: 'The only person you are destined to become is the person you decide to be.', author: 'Unknown' },
  { text: 'Discipline is the bridge between goals and accomplishment.', author: 'Jim Rohn' },
  { text: 'Do something today that your future self will thank you for.', author: 'Sean Patrick Flanery' },
  { text: 'The body achieves what the mind believes.', author: 'Unknown' },
  { text: 'Motivation gets you going. Habit keeps you going.', author: 'Jim Ryun' },
  { text: 'You don’t have to be great to start, but you have to start to be great.', author: 'Zig Ziglar' },
  { text: 'The difference between the impossible and the possible lies in a person’s determination.', author: 'Tommy Lasorda' },
  { text: 'Every expert was once a beginner.', author: 'Helen Hayes' },
  { text: 'Never give up! Failure and rejection are only the first step to succeeding.', author: 'Jim Valvano' },
  { text: 'The most difficult thing is the decision to act, the rest is merely tenacity.', author: 'Amelia Earhart' },
  { text: 'Be stronger than your excuses.', author: 'Unknown' },
  { text: 'A smart person learns from the mistakes of others; a wise one from his own; the wisest makes none.', author: 'Unknown' }
]

function getNewQuote() {
  const list = String(locale.value).startsWith('de') ? motivationQuotesDe : motivationQuotesEn
  const currentIndex = list.findIndex(
    q => q.text === currentQuote.value.text && q.author === currentQuote.value.author
  )
  
  let newIndex
  do {
    newIndex = Math.floor(Math.random() * list.length)
  } while (newIndex === currentIndex && list.length > 1)
  
  currentQuote.value = list[newIndex]
}

onMounted(() => {
  // Bei jedem Login ein frisches Zitat
  getNewQuote()
})
</script>

<style scoped>
.motivation-widget {
  background: linear-gradient(135deg, #ff4d4d 0%, #ff6b47 50%, #4dabf7 100%);
  border-radius: 12px;
  padding: 20px;
  margin: 16px;
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.motivation-widget::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.2);
  pointer-events: none;
}

.quote-content {
  position: relative;
  z-index: 1;
  color: white;
  text-align: center;
}

.quote-icon {
  font-size: 1.5rem;
  margin-bottom: 12px;
  opacity: 0.9;
}

.quote-text {
  font-size: 1rem;
  line-height: 1.4;
  margin: 0 0 12px 0;
  font-style: italic;
  font-weight: 500;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.quote-author {
  display: block;
  font-size: 0.85rem;
  opacity: 0.9;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.quote-author::before {
  content: '— ';
}

.refresh-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.9rem;
  z-index: 2;
  backdrop-filter: blur(10px);
}

.refresh-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.5);
  transform: rotate(180deg);
}

.refresh-btn:active {
  transform: rotate(180deg) scale(0.95);
}

@media (max-width: 480px) {
  .motivation-widget {
    margin: 12px;
    padding: 16px;
  }
  
  .quote-text {
    font-size: 0.95rem;
    line-height: 1.3;
  }
  
  .quote-author {
    font-size: 0.8rem;
  }
  
  .quote-icon {
    font-size: 1.3rem;
    margin-bottom: 10px;
  }
  
  .refresh-btn {
    width: 32px;
    height: 32px;
    top: 12px;
    right: 12px;
    font-size: 0.8rem;
  }
}

@media (max-width: 380px) {
  .quote-text {
    font-size: 0.9rem;
  }
  
  .refresh-btn {
    width: 28px;
    height: 28px;
    font-size: 0.75rem;
  }
}

/* Tablet Styles */
@media (min-width: 768px) and (max-width: 1023px) {
  .motivation-widget {
    max-width: 600px;
    margin: 16px auto;
  }
}
</style>