<template>
  <header class="header-bar">
    <div class="header-content">
      <h1>{{ title }}</h1>
      <div class="auth-section">
        <SignedOut>
          <SignInButton class="sign-in-btn">
            <template #default>
              <button class="auth-button">Anmelden</button>
            </template>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <UserButton 
            :appearance="{
              elements: {
                userButtonBox: 'user-button-custom',
                userButtonTrigger: 'user-button-trigger'
              }
            }"
          />
        </SignedIn>
      </div>
    </div>
  </header>
</template>

<script setup>
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/vue'

defineProps({
  title: {
    type: String,
    required: true
  }
})
</script>

<style scoped>
.header-bar {
  background: var(--surface);
  color: var(--fg);
  padding: 16px 20px;
  padding-top: calc(16px + env(safe-area-inset-top));
  border-bottom: 1px solid var(--card-border);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto;
}

.header-bar h1 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--fg);
}

.auth-section {
  display: flex;
  align-items: center;
}

.auth-button {
  background: var(--surface);
  border: 1px solid var(--card-border);
  color: var(--fg);
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.auth-button:hover {
  background: rgba(127,127,127,0.08);
  border-color: var(--card-border);
  transform: translateY(-1px);
}

/* Clerk UserButton Styling */
:deep(.user-button-custom) {
  color: var(--fg);
}

:deep(.user-button-trigger) {
  border: 1px solid var(--card-border);
  border-radius: 8px;
  transition: all 0.2s ease;
}

:deep(.user-button-trigger:hover) {
  border-color: var(--card-border);
  background: rgba(127,127,127,0.08);
}

/* Tablet Styles */
@media (min-width: 768px) {
  .header-bar {
    padding: 20px 24px;
    padding-top: calc(20px + env(safe-area-inset-top));
  }
  
  .header-bar h1 {
    font-size: 1.5rem;
  }
  
  .auth-button {
    padding: 10px 20px;
    font-size: 1rem;
  }
}

/* Desktop Styles */
@media (min-width: 1024px) {
  .header-bar {
    padding: 24px 32px;
    padding-top: calc(24px + env(safe-area-inset-top));
  }
  
  .header-bar h1 {
    font-size: 1.75rem;
  }
}
</style>