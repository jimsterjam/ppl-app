<template>
  <div class="plan-new-view">
    <HeaderBar :title="t('plans.newTitle')" />

    <div class="content">
      <button type="button" class="back-btn" @click="router.push({ name: 'plans' })">
        <span aria-hidden="true">←</span> {{ t('common.back') }}
      </button>

      <h2 class="section-title">{{ t('plans.templatesSection') }}</h2>
      <p class="muted small">{{ t('plans.templatesIntro') }}</p>
      <button
        v-for="template in templates"
        :key="template.id"
        type="button"
        class="card template-card"
        @click="openTemplate(template)"
      >
        <span class="template-main">
          <span class="card-title">{{ t(`plans.templates.${template.id}.name`) }}</span>
          <span class="muted">{{ t(`plans.templates.${template.id}.desc`) }}</span>
          <span class="muted days-line">{{ t('plans.daysShort', { count: template.days.length }) }} · {{ dayLine(template) }}</span>
        </span>
        <span class="chevron" aria-hidden="true"></span>
      </button>
      <p class="muted small">{{ t('plans.templateDisclaimer') }}</p>
      <p class="muted small">{{ t('plans.abExplain') }}</p>

      <h2 class="section-title">{{ t('plans.custom.sectionTitle') }}</h2>
      <button type="button" class="card template-card" @click="router.push({ name: 'plan-custom-info' })">
        <span class="template-main">
          <span class="card-title">{{ t('plans.custom.cardTitle') }}</span>
          <span class="muted">{{ t('plans.custom.cardSub') }}</span>
        </span>
        <span class="chevron" aria-hidden="true"></span>
      </button>
    </div>

  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import HeaderBar from '@/components/HeaderBar.vue'
import { PLAN_TEMPLATES, PLAN_TEMPLATE_IDS } from '@/utils/planTemplates'

const { t } = useI18n()
const router = useRouter()

const templates = PLAN_TEMPLATE_IDS.map((id) => PLAN_TEMPLATES[id])

function dayLine(template) {
  return template.days.map((day) => t(`plans.dayLabel.${day.labelKey}`)).join(' · ')
}

function openTemplate(template) {
  router.push({ name: 'plan-template', params: { templateId: template.id } })
}
</script>

<style scoped>
.plan-new-view { min-height: 100vh; background: var(--bg); color: var(--fg); padding-bottom: 70px; }
.content { padding: 20px; padding-bottom: 90px; max-width: 920px; margin: 0 auto; display: grid; gap: 14px; }
.back-btn { justify-self: start; display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 6px 14px; border-radius: 999px; border: 1px solid var(--card-border); background: var(--surface); color: var(--fg); font: inherit; font-weight: 600; cursor: pointer; }
.muted { color: var(--muted); margin: 0; font-size: 0.9rem; }
.small { font-size: 0.8rem; line-height: 1.5; }
.template-card { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; min-height: 64px; color: var(--fg); font: inherit; text-align: left; cursor: pointer; }
.template-main { display: grid; gap: 6px; min-width: 0; }
.days-line { font-size: 0.78rem; }
.chevron { flex: 0 0 auto; width: 9px; height: 9px; border-right: 2px solid var(--muted); border-bottom: 2px solid var(--muted); transform: rotate(-45deg); }
.error { color: var(--danger); margin: 0; font-size: 0.9rem; }
.custom-form { display: grid; gap: 14px; }
.field { display: grid; gap: 6px; font-size: 0.9rem; }
.field input[type='text'] { min-height: 44px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--card-border); background: var(--bg); color: var(--fg); font: inherit; }
.pick { display: flex; align-items: center; gap: 10px; min-height: 40px; }
</style>
