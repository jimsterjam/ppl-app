<template>
  <div class="info-view">
    <HeaderBar :title="$t('info.title')" />

    <div class="content">
      <section class="card glass">
        <h3>{{ $t('info.gettingStarted') }}</h3>
        <p>{{ $t('info.gettingStartedText') }}</p>
      </section>

      <section class="card glass">
        <h3>{{ $t('info.navigation') }}</h3>
        <p>{{ $t('info.navigationText') }}</p>
      </section>

      <section class="card glass">
        <h3>{{ $t('info.workouts') }}</h3>
        <p>{{ $t('info.workoutsText') }}</p>
      </section>

      <section class="card glass">
        <h3>{{ $t('info.uploads') }}</h3>
        <p>{{ $t('info.uploadsText') }}</p>
      </section>

      <section class="card glass">
        <h3>{{ $t('info.privacy') }}</h3>
        <p>{{ $t('info.privacyText') }}</p>
      </section>

      <section class="card glass about">
        <h3>{{ $t('info.about') }}</h3>
        <p>
          {{ $t('info.version') }}: <strong>{{ version }}</strong>
        </p>
      </section>
    </div>

  </div>
</template>

<script setup>
import { computed } from 'vue'
import HeaderBar from '@/components/HeaderBar.vue'
import pkg from '../../package.json'

const version = computed(() => pkg?.version || '0.0.0')
</script>

<style scoped>
.info-view { min-height: 100vh; background: var(--bg); color: var(--fg); padding-bottom: 80px; }
.content { padding: 16px; display: grid; gap: 16px; }
.card { padding: 16px; border-radius: 12px; border: 1px solid transparent; }
.card h3 { margin: 0 0 8px 0; font-size: 1.1rem; color: var(--fg); }
.card p { margin: 0; color: var(--muted); }
.about p { color: var(--fg); }

@media (min-width: 768px) {
  .content { grid-template-columns: repeat(2, 1fr); }
}
</style>
