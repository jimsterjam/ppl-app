<template>
  <!-- Markenzeichen: "fbe" klein in der Schrift des App-Icons (Comfortaa fett), optional mit "Form Beats Ego" darunter. -->
  <div class="brand-lockup" :class="`brand-lockup--${size}`">
    <span class="brand-mark" data-i18n-ignore>fbe</span>
    <span v-if="slogan" class="brand-slogan">{{ t('brand.slogan') }}</span>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

defineProps({
  size: { type: String, default: 'lg' },
  slogan: { type: Boolean, default: true }
})
const { t } = useI18n()
</script>

<style scoped>
.brand-lockup { display: flex; flex-direction: column; align-items: center; gap: 0.35rem; color: var(--fg); }
.brand-mark {
  font-family: var(--font-heading);
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0;
  text-transform: none;
}
.brand-slogan {
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--muted);
}
.brand-lockup--lg .brand-mark { font-size: 4.2rem; }
.brand-lockup--md .brand-mark { font-size: 2.6rem; }
.brand-lockup--sm { flex-direction: row; gap: 0.6rem; align-items: baseline; }
.brand-lockup--sm .brand-mark { font-size: 1.4rem; }
.brand-lockup--sm .brand-slogan { font-size: 0.7rem; }
</style>
