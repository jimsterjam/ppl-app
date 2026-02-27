<template>
  <div class="exercises-view">
    <HeaderBar :title="t('exercises.title')" />
    <main class="exercises-content">
      <ExerciseList :show-title="false" />
    </main>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import HeaderBar from '@/components/HeaderBar.vue'
import ExerciseList from '@/components/ExerciseList.vue'

const { t } = useI18n()
</script>

<style scoped>
.exercises-view {
  min-height: 100dvh;
  background: var(--bg);
  color: var(--fg);
}

.exercises-content {
  padding-bottom: calc(100px + env(safe-area-inset-bottom));
}
</style>


