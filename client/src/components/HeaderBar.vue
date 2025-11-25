<template>
  <header class="header-bar glass">
    <div class="header-content">
      <h1>{{ title }}</h1>
      <div class="header-actions">
        <slot name="actions"></slot>
        <div class="auth-section">
          <button v-if="!signedIn" class="auth-button" @click="signIn">{{ $t('auth.signIn') }}</button>
          <div v-else class="user-info">
            <span class="user-name">{{ userName }}</span>
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
  }
})

const { signIn, signOut, onAuthStateChanged, getCurrentUser } = useFirebaseAuth()
const signedIn = ref(false)
const userName = ref('')

onAuthStateChanged((user) => {
  signedIn.value = !!user
  userName.value = user?.displayName || user?.email || ''
})
</script>

<style scoped>
.header-bar {
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
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
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