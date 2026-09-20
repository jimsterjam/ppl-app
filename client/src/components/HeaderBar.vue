<template>
  <header class="header-bar glass">
    <div class="header-content">
      <div class="header-left">
        <slot name="leading"></slot>
        <div class="header-titles">
          <h1
            :class="{ 'header-title--clickable': titleClickable }"
            @click="titleClickable && $emit('title-click')"
          >{{ title }}</h1>
          <p v-if="subtitle" class="header-subtitle">{{ subtitle }}</p>
        </div>
      </div>
      <!-- Mittlere Spalte (optional, z.B. Gesamtzeit in WorkoutDetailView.vue) - eigene Grid-
           Spalte statt nur zwischen header-left/header-actions eingefügt, damit der Inhalt
           WIRKLICH mittig im Header sitzt (unabhängig davon, wie breit Titel oder
           Abmelden-Button gerade sind), nicht nur "irgendwo dazwischen". Bleibt leer und ohne
           Breite, wenn keine Ansicht diesen Slot nutzt (siehe .header-center unten). -->
      <div class="header-center">
        <slot name="center"></slot>
      </div>
      <div class="header-actions">
        <slot name="actions"></slot>
        <div class="auth-section">
          <button v-if="!signedIn" class="auth-button" @click="signInWithGoogle">{{ $t('auth.signIn') }}</button>
          <div v-else class="user-info">
            <span v-if="showUserName" class="user-name">{{ userName }}</span>
            <button class="auth-button" @click="signOut">{{ $t('auth.signOut') }}</button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useFirebaseAuth } from '../utils/firebaseAuth'

defineProps({
  title: {
    type: String,
    required: true
  },
  subtitle: {
    type: String,
    default: ''
  },
  showUserName: {
    type: Boolean,
    default: false
  },
  // Optional: macht den Titel (h1) klickbar - z.B. für DashboardView.vue, wo ein Klick auf den
  // (Anzeige-)Namen direkt das Namens-Bearbeiten öffnen soll, statt über die Settings-Seite
  // umzuleiten. Standardmäßig aus, damit sich bestehende Verwender von HeaderBar (die meisten
  // Views zeigen hier nur den statischen Seitentitel) nicht ändern.
  titleClickable: {
    type: Boolean,
    default: false
  }
})

defineEmits(['title-click'])

const { signInWithGoogle, signOut, onAuthStateChanged, getCurrentUser } = useFirebaseAuth()
const signedIn = ref(false)
const userName = ref('')

onAuthStateChanged((user) => {
  signedIn.value = !!user
  userName.value = user?.displayName || user?.email || ''
})
</script>

<style scoped>
.header-bar {
  /* Überschreibt bewusst das globale .glass (siehe style.css: overflow:hidden, für den
     abgerundeten Rahmen/::after-Highlight anderer Panels gedacht) - hier zusätzlich als
     .header-bar[data-v-xxx] gescopt, also spezifischer als .glass und gewinnt automatisch ohne
     !important. Ohne das war das SessionStopwatch-Overlay (Start/Pause/Reset, öffnet sich
     UNTERHALB des Headers, siehe SessionStopwatch.vue) unsichtbar abgeschnitten - der Klick auf
     den Timer im Header hat zwar funktioniert (overlayOpen wurde true), das Popup war aber
     durch overflow:hidden auf dem Header selbst nicht zu sehen ("Timer lässt sich nicht
     anklicken"). */
  overflow: visible;
  background: color-mix(in srgb, var(--surface) 40%, transparent);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 1px solid color-mix(in srgb, var(--card-border) 20%, transparent);
  box-shadow: 0 2px 16px color-mix(in srgb, black 6%, transparent);
  color: var(--fg);
  padding: 12px 20px;
  padding-top: calc(12px + env(safe-area-inset-top));
  position: sticky;
  top: 0;
  z-index: 900;
}

.header-content {
  /* Grid statt flex+space-between: eine echte, unabhängige Mittelspalte für .header-center
     (siehe Template-Kommentar oben) - mit flex+space-between gäbe es nur zwei Enden, kein
     "echtes" Zentrum. gap bewusst 0, damit sich für Ansichten ohne #center-Slot (Dashboard,
     Settings, ...) rein optisch NICHTS ändert - die leere mittlere Spalte hat dann Breite 0
     und header-left/header-actions liegen exakt wie vorher an den beiden Rändern. */
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 0;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  justify-self: start;
}

.header-center {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
}

.header-titles {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-self: end;
}

.auth-section {
  display: flex;
  align-items: center;
}

.header-bar h1 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--fg);
  letter-spacing: -0.01em;
}

.header-bar h1.header-title--clickable {
  cursor: pointer;
}

.header-bar h1.header-title--clickable:active {
  opacity: 0.7;
}

.header-subtitle {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--muted);
  letter-spacing: -0.01em;
  line-height: 1.1;
}

.auth-section {
  display: flex;
  align-items: center;
}

.auth-button {
  background: color-mix(in srgb, var(--surface) 60%, transparent);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid color-mix(in srgb, var(--card-border) 30%, transparent);
  color: var(--fg);
  padding: 7px 14px;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.auth-button:hover {
  background: color-mix(in srgb, var(--surface) 70%, transparent);
  border-color: color-mix(in srgb, var(--card-border) 40%, transparent);
  transform: translateY(-1px);
}

/* Clerk UserButton Styling */
:deep(.user-button-custom) {
  color: var(--fg);
}

:deep(.user-button-trigger) {
  border: 1px solid color-mix(in srgb, var(--card-border) 30%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--surface) 60%, transparent);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: all 0.2s ease;
}

:deep(.user-button-trigger:hover) {
  border-color: color-mix(in srgb, var(--card-border) 40%, transparent);
  background: color-mix(in srgb, var(--surface) 70%, transparent);
}

/* Tablet Styles */
@media (min-width: 768px) {
  .header-bar {
    padding: 14px 24px;
    padding-top: calc(14px + env(safe-area-inset-top));
  }
  
  .header-bar h1 {
    font-size: 1.35rem;
  }
  
  .auth-button {
    padding: 8px 16px;
    font-size: 0.9rem;
  }
}

/* Desktop Styles */
@media (min-width: 1024px) {
  .header-bar {
    padding: 16px 32px;
    padding-top: calc(16px + env(safe-area-inset-top));
  }
  
  .header-bar h1 {
    font-size: 1.5rem;
  }
}
</style>