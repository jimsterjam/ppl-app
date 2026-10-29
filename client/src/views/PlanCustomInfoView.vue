<template>
  <div class="plan-custom-info-view">
    <HeaderBar :title="t('plans.custom.infoTitle')" />
    <div class="content">
      <button type="button" class="back-btn" @click="router.push({ name: 'plan-new' })">
        <span aria-hidden="true">←</span> {{ t('common.back') }}
      </button>

      <section class="card">
        <h2 class="section-title">{{ t('plans.custom.infoTitle') }}</h2>
        <p v-for="(text, i) in paragraphs" :key="i" class="info-text">{{ text }}</p>
      </section>

      <button type="button" class="btn-primary" @click="router.push({ name: 'plan-new' })">{{ t('plans.custom.infoToTemplates') }}</button>
      <button type="button" class="btn-secondary" @click="router.push({ name: 'plan-builder' })">{{ t('plans.custom.infoContinue') }}</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import HeaderBar from '@/components/HeaderBar.vue'

// Vor dem eigenen Plan (Absprache Paul 29.10.): Empfehlung, mit einer fertigen Vorlage zu starten - bei jedem Anlegen.
const { t } = useI18n()
const router = useRouter()
const paragraphs = computed(() => t('plans.custom.infoText').split('\n\n'))
</script>

<style scoped>
.plan-custom-info-view { min-height: 100vh; background: var(--bg); color: var(--fg); padding-bottom: 70px; }
.content { padding: 20px; padding-bottom: 90px; max-width: 920px; margin: 0 auto; display: grid; gap: 14px; }
.back-btn { justify-self: start; display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 6px 14px; border-radius: 999px; border: 1px solid var(--card-border); background: var(--surface); color: var(--fg); font: inherit; font-weight: 600; cursor: pointer; }
.card { display: grid; gap: 10px; }
.info-text { margin: 0; line-height: 1.55; }
.btn-primary { min-height: 52px; border: none; border-radius: 14px; background: var(--accent); color: var(--accent-contrast, #060606); font: inherit; font-weight: 800; cursor: pointer; }
.btn-secondary { min-height: 48px; border-radius: 14px; border: 1px solid var(--card-border); background: transparent; color: var(--muted); font: inherit; font-weight: 600; cursor: pointer; }
</style>
