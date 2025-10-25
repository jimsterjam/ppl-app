<script setup>
import { useClerk, useUser } from '@clerk/vue';
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';

const props = defineProps({
        handleChangeDisplay: Function
});

const clerk = useClerk();
const { user, isSignedIn } = useUser();
const router = useRouter();

// Router-Guard übernimmt die Weiterleitung; hier keine verzögerten Redirects mehr
</script>

<template>
  <div class="welcome-page">
    <div v-if="!isSignedIn" class="sign-in-container">
      <h2>Willkommen bei der Bro Split App!</h2>
      <p>Bitte melden Sie sich an, um fortzufahren.</p>
      <button @click="clerk.openSignIn()" class="sign-in-btn">Anmelden</button>
    </div>
    
    <div v-else class="loading-container">
      <h2>Weiterleitung...</h2>
      <p>Sie werden zum Dashboard weitergeleitet.</p>
      <div class="spinner"></div>
    </div>
  </div>
</template>

<style scoped>
    .welcome-page {
        position: fixed;
        inset: 0; /* top/right/bottom/left 0 -> voller Viewport */
        width: 100vw;
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0; /* kein Außenabstand */
    background: var(--bg);
    color: var(--fg);
        box-sizing: border-box;
    }

    .sign-in-container,
    .loading-container {
        width: 100%;
        max-width: min(800px, 100%);
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        padding: 2rem;
        text-align: center;
    background: color-mix(in oklab, var(--fg) 5%, transparent);
        border-radius: 16px;
        backdrop-filter: blur(10px);
    border: 1px solid var(--card-border);
    }

    .loading-container {
    border: 1px solid color-mix(in oklab, var(--accent-color) 30%, transparent);
    }

    .spinner {
        width: 40px;
        height: 40px;
    border: 4px solid color-mix(in oklab, var(--accent-color) 30%, transparent);
    border-top: 4px solid var(--accent-color);
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-top: 1rem;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    .sign-in-btn { background: var(--accent); color: var(--accent-contrast); border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: 600; transition: all 0.3s ease; }

    .sign-in-btn:hover { transform: translateY(-2px); }

    h2 {
        font-size: 1.8rem;
        margin-bottom: 1rem;
    background: var(--accent);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }

    p {
        line-height: 1.6;
    color: var(--muted);
    }

    @media (min-width: 640px) {
        h2 { font-size: 2.2rem; }
    }
</style>