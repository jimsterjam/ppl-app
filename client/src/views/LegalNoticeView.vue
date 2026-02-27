<template>
  <div class="legal-layout">
    <div class="legal-card">
      <div class="legal-header">
        <button class="back-btn" type="button" @click="goBack">
          <span class="icon" aria-hidden="true">←</span>
          <span>{{ $t('common.back') }}</span>
        </button>
        <div class="legal-heading">
          <h1>{{ $t('legal.title') }}</h1>
          <p class="last-update">{{ $t('legal.lastUpdate') }}</p>
        </div>
      </div>

      <div class="legal-content">
        <section class="legal-section">
          <p class="section-title">{{ $t('legal.section1Title') }}</p>
          <p v-html="$t('legal.section1Address').replace(/\n/g, '<br>')"></p>
          <p>{{ $t('legal.section1Mail', { email: legalEmail }) }}</p>
          <p class="section-subtitle">
            {{ $t('legal.section1ResponsibleTitle') }}<br />
            <span v-html="$t('legal.section1Responsible').replace(/\n/g, '<br>')"></span>
          </p>
        </section>

        <section class="legal-section">
          <h2>{{ $t('legal.copyrightTitle') }}</h2>
          <p>{{ $t('legal.copyrightNotice') }}</p>
          <p>{{ $t('legal.copyrightLaw') }}</p>
        </section>

        <section class="legal-section">
          <h2>{{ $t('legal.disclaimerTitle') }}</h2>
          <p>{{ $t('legal.disclaimer1') }}</p>
          <p>{{ $t('legal.disclaimer2') }}</p>
        </section>

        <section class="legal-section">
          <h2>{{ $t('legal.userHintsTitle') }}</h2>
          <ul>
            <li>{{ $t('legal.userHint1') }}</li>
            <li>{{ $t('legal.userHint2') }}</li>
            <li>{{ $t('legal.userHint3') }}</li>
            <li>{{ $t('legal.userHint4') }}</li>
          </ul>
        </section>

        <section class="legal-section">
          <h2>{{ $t('legal.privacyTitle') }}</h2>
          <div class="privacy-block">
            <strong>{{ $t('legal.privacy1') }}</strong>
            <p v-html="$t('legal.privacy1Text', { email: legalEmail }).replace(/\n/g, '<br>')"></p>
          </div>
          <div class="privacy-block">
            <strong>{{ $t('legal.privacy2') }}</strong>
            <p>{{ $t('legal.privacy2Text') }}</p>
          </div>
          <div class="privacy-block">
            <strong>{{ $t('legal.privacy3') }}</strong>
            <p>{{ $t('legal.privacy3Text') }}</p>
          </div>
          <div class="privacy-block">
            <strong>{{ $t('legal.privacy4') }}</strong>
            <p>{{ $t('legal.privacy4Text', { email: legalEmail }) }}</p>
          </div>
          <div class="privacy-block">
            <strong>{{ $t('legal.privacy5') }}</strong>
            <p>{{ $t('legal.privacy5Text') }}</p>
          </div>
        </section>
      </div>
    </div>
  </div>

</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

const authStore = useAuthStore()
const router = useRouter()
const legalEmail = 'kontakt@bro-split-app.de'
const fallbackRoute = computed(() => authStore.isAuthenticated ? { name: 'settings' } : { name: 'welcome' })

function goBack() {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    router.back()
  } else {
    router.push(fallbackRoute.value)
  }
}
</script>

<style scoped>
.legal-layout {
  padding: clamp(16px, 4vw, 48px);
  padding-top: calc(env(safe-area-inset-top) + clamp(20px, 5vw, 56px));
  padding-bottom: calc(80px + env(safe-area-inset-bottom));
  min-height: 100vh;
  background: var(--bg);
}

.legal-card {
  max-width: 840px;
  margin: 0 auto;
  margin-top: clamp(8px, 3vw, 32px);
  background: var(--card-bg);
  border: 1px solid color-mix(in srgb, var(--card-border) 60%, transparent);
  border-radius: 24px;
  padding: clamp(20px, 4vw, 48px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
}

.legal-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 1.75rem;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--card-border) 40%, transparent);
  background: color-mix(in srgb, var(--surface) 60%, transparent);
  color: var(--fg);
  padding: 8px 16px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 4px;
}

.back-btn:hover {
  background: color-mix(in srgb, var(--surface) 75%, transparent);
  border-color: color-mix(in srgb, var(--card-border) 60%, transparent);
  transform: translateY(-1px);
}

.back-btn .icon {
  font-size: 1.2rem;
  line-height: 1;
}

.legal-heading {
  flex: 1;
  min-width: min(320px, 100%);
}

.legal-heading h1 {
  margin: 0;
  font-size: clamp(1.75rem, 4vw, 2.5rem);
  line-height: 1.2;
}

.last-update {
  margin: 0.35rem 0 0;
  color: var(--muted);
  font-size: 0.9rem;
}

.legal-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.legal-section {
  line-height: 1.6;
  color: var(--fg);
}

.legal-section h2 {
  font-size: 1.2rem;
  margin-bottom: 0.35rem;
}

.section-title {
  font-weight: 600;
  margin-bottom: 0.35rem;
}

.section-subtitle {
  margin-top: 0.75rem;
  font-weight: 600;
}

.legal-section ul {
  margin: 0.5rem 0 0.5rem 1.2rem;
}

.legal-section li {
  margin-bottom: 0.35rem;
}

.privacy-block {
  margin-top: 0.75rem;
}

.privacy-block strong {
  display: block;
  margin-bottom: 0.2rem;
}

@media (max-width: 600px) {
  .legal-card {
    padding: 20px 16px;
    border-radius: 18px;
  }

  .legal-header {
    flex-direction: column;
    gap: 12px;
  }

  .back-btn {
    width: fit-content;
  }
}
</style>
