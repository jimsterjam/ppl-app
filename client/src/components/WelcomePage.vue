<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useFirebaseAuth } from '@/utils/firebaseAuth'
// import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import MotivationWidget from '@/components/MotivationWidget.vue'
import { useI18n } from 'vue-i18n'

// Optionaler Callback vom Wrapper (aktuell nicht genutzt, behalten für Abwärtskompat.)
defineProps({
    handleChangeDisplay: { type: Function, default: null }
})

const { auth, signIn, getCurrentUser, onAuthStateChanged } = useFirebaseAuth()
const isSignedIn = ref(false)
const router = useRouter()
const route = useRoute()
const { t } = useI18n()

// Motivation-Overlay Steuerung (ohne Tages-Limit: bei jedem Login anzeigen)
const showMotivation = ref(false)
let redirectTimer = null

function getRedirectTarget() {
    const q = route.query?.redirect
    return typeof q === 'string' && q.startsWith('/') ? q : '/dashboard'
}

function goNow() {
    router.replace(getRedirectTarget())
}

function startMotivationFlow() {
    showMotivation.value = true
    // Sicherheits-Reset, falls bereits ein Timer existiert
    if (redirectTimer) {
        clearTimeout(redirectTimer)
        redirectTimer = null
    }
    redirectTimer = setTimeout(() => {
        goNow()
    }, 5000)
}

function skipNow() {
    if (redirectTimer) {
        clearTimeout(redirectTimer)
        redirectTimer = null
    }
    goNow()
}

onBeforeUnmount(() => {
    if (redirectTimer) {
        clearTimeout(redirectTimer)
        redirectTimer = null
    }
})

function maybeProceed() {
    if (!isSignedIn.value) return
    // Immer Motivation anzeigen
    startMotivationFlow()
}

onMounted(() => {
    onAuthStateChanged((user) => {
        isSignedIn.value = !!user
        if (isSignedIn.value) {
            startMotivationFlow()
        }
    })
})
</script>

<template>
    <div class="welcome-page">
        <!-- Nicht eingeloggt: Sign-In -->
        <div v-if="!isSignedIn" class="sign-in-container">
            <h2>{{ t('welcome.title') }}</h2>
            <p>{{ t('welcome.signInPrompt') }}</p>
            <button class="sign-in-btn" @click="signIn">{{ t('auth.signIn') }} (Google)</button>
        </div>

        <!-- Eingeloggt: Motivation-Overlay -->
        <div v-else>
            <div v-if="showMotivation" class="motivation-overlay">
                <div class="motivation-card">
                    <MotivationWidget />
                    <button class="skip-btn" @click="skipNow">{{ t('welcome.skip') }}</button>
                </div>
            </div>

            <!-- Fallback: kleiner Loader, während der Overlay-Start initialisiert -->
            <div v-else class="loading-container">
                <h2>{{ t('welcome.redirectingTitle') }}</h2>
                <p>{{ t('welcome.redirectingMsg') }}</p>
                <div class="spinner"></div>
            </div>
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

    /* Verwende globale .spinner; skaliere hier nur Größe wenn nötig */
    .loading-container .spinner { width: 40px; height: 40px; margin-top: 1rem; }

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

        /* Motivation Overlay */
        .motivation-overlay {
            position: fixed;
            inset: 0;
            display: grid;
            place-items: center;
            background: color-mix(in oklab, var(--bg) 70%, transparent);
            backdrop-filter: blur(6px);
            z-index: 50;
            padding: 16px;
        }
        .motivation-card {
            width: min(620px, 100%);
            border-radius: 16px;
            padding: 16px;
            background: color-mix(in oklab, var(--fg) 5%, transparent);
            border: 1px solid var(--card-border);
            box-shadow: 0 10px 30px color-mix(in oklab, #000 30%, transparent);
            display: flex;
            flex-direction: column;
            gap: 12px;
            align-items: stretch;
        }
        .skip-btn {
            align-self: center;
            background: transparent;
            color: var(--muted);
            border: 1px solid color-mix(in oklab, var(--muted) 40%, transparent);
            padding: 10px 16px;
            border-radius: 10px;
            cursor: pointer;
            transition: all .2s ease;
        }
        .skip-btn:hover {
            color: var(--fg);
            border-color: var(--fg);
            transform: translateY(-1px);
        }
</style>