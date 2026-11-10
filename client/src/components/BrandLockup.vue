<template>
  <!-- Markenzeichen: "fbe" klein in der Schrift des App-Icons (Comfortaa fett), optional mit "Form Beats Ego" darunter. -->
  <div class="brand-lockup" :class="`brand-lockup--${size}`">
    <!-- Buchstaben einzeln, damit der Abstand f-b gleich dem Abstand b-e ist (wie im App-Icon). Für Screenreader bleibt es "fbe". -->
    <span class="brand-mark" data-i18n-ignore role="img" aria-label="fbe"><span class="bm-f" aria-hidden="true">f</span><span class="bm-b" aria-hidden="true">b</span><span aria-hidden="true">e</span></span>
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
  /* Abstände von Hand, nicht über Kerning (in allen Browsern gleich): Der nächste Abstand f-b und b-e ist gleich groß
     (je ca. 0,109 der Buchstabenhöhe wie im App-Icon, Absprache Paul 10.11.2026), und die Tinte sitzt mittig. In der
     Schrift ist b-e sonst deutlich weiter als f-b (0,159 zu 0,102 der Höhe), weil der Querstrich des f zum b ragt. */
  font-kerning: none;
  font-feature-settings: "kern" 0;
  transform: translateX(0.0175em);
}
.brand-mark .bm-f { margin-right: 0.0055em; }
.brand-mark .bm-b { margin-right: -0.0395em; }
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
