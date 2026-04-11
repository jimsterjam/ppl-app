<template>
  <div class="faqs-view">
    <HeaderBar :title="$t('faqs.title')" />

    <div class="content">
      <section class="faq-list glass" aria-label="FAQs">
        <h3>{{ $t('faqs.title') }}</h3>
        <div
          v-for="(item, idx) in items"
          :key="item.key"
          class="faq-item"
        >
          <button
            type="button"
            class="faq-trigger"
            @click="openFaq(item.key)"
          >
            <span class="title">{{ $t(`faqs.${item.key}`) }}</span>
            <span class="chevron" aria-hidden="true">▸</span>
          </button>
        </div>
      </section>

      <!-- FAQ Modal/Overlay -->
      <Transition name="modal" appear>
        <div v-if="selectedFaqKey" class="modal-overlay" @click="closeFaq">
          <div class="modal-content" @click.stop>
            <div class="modal-header">
              <h4>{{ $t(`faqs.${selectedFaqKey}`) }}</h4>
              <button class="close-btn" @click="closeFaq" aria-label="Schließen">
                <span>×</span>
              </button>
            </div>
            <div class="modal-body">
              <p v-for="(p, pi) in splitParagraphs($t(`faqs.${selectedFaqKey}Text`))" :key="pi">{{ p }}</p>
            </div>
          </div>
        </div>
      </Transition>

      <section class="card glass about">
        <h3>{{ $t('faqs.about') }}</h3>
        <p>
          {{ $t('faqs.version') }}: <strong>{{ version }}</strong>
        </p>
      </section>
    </div>

  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import HeaderBar from '@/components/HeaderBar.vue'
import pkg from '../../package.json'

const version = computed(() => pkg?.version || '0.0.0')

// FAQ modal state
const selectedFaqKey = ref('')
const baseKeys = ['gettingStarted', 'pushPullLegs', 'navigation', 'workouts', 'progression', 'uploads', 'privacy']
const items = computed(() => baseKeys.map(key => ({ key })))

function openFaq(faqKey) {
  selectedFaqKey.value = faqKey
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
.content { padding: 16px; display: grid; gap: 16px; }

/* FAQ List */
.faq-list { 
  padding: 16px; 
  border-radius: 12px; 
  border: 1px solid transparent; 
}

.faq-list h3 {
  margin: 0 0 16px 0; 
  color: var(--fg); 
  font-size: 1.1rem; 
  font-weight: 600;
}

.faq-item + .faq-item { 
  border-top: 1px solid var(--card-border, rgba(125,125,125,0.25)); 
}

.faq-trigger {
  width: 100%;
  text-align: left;
  padding: 16px 12px;
  background: transparent;
  border: none;
  color: var(--fg);
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
  border-radius: 10px;
}

.faq-trigger::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: color-mix(in oklab, var(--fg) 4%, transparent);
  border-radius: 10px;
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.faq-trigger:hover::before,
.faq-trigger:active::before {
  opacity: 1;
}

.faq-trigger:focus { 
  outline: 2px solid var(--accent-color); 
  outline-offset: 2px; 
}

.faq-trigger .title { 
  font-weight: 600; 
  font-size: 1rem; 
}

.chevron { 
  transition: transform 0.2s ease; 
  color: var(--muted);
  font-size: 18px;
}

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

.card { padding: 16px; border-radius: 12px; border: 1px solid transparent; }
.about h3 { margin: 0 0 8px 0; font-size: 1.1rem; color: var(--fg); }
.about p { margin: 0; color: var(--fg); }

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
  
  .faq-trigger {
    padding: 14px 12px;
  }
  
  .faq-trigger .title {
    font-size: 0.95rem;
  }
}

@media (min-width: 768px) {
  .content { grid-template-columns: 1fr; }
}
</style>
