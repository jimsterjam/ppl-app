<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { initFirebaseAuth, useFirebaseAuth } from '@/utils/firebaseAuth'
import { useAuthStore } from '@/stores/authStore'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Capacitor } from '@capacitor/core'
import { logger } from '@/utils/logger'

// Optionaler Callback vom Wrapper (aktuell nicht genutzt, behalten für Abwärtskompat.)
defineProps({
    handleChangeDisplay: { type: Function, default: null }
})

const { signInWithGoogle, signInWithApple, signInWithAppleRedirect, signInWithEmail, signUpWithEmail, resetPassword, getCurrentUser, getIdToken, resendVerification, requestVerificationLink } = useFirebaseAuth()
const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const authStore = useAuthStore()
const isSignedIn = computed(() => authStore.isAuthenticated)
const offlineExpired = computed(() => route.query?.reason === 'offline-expired')

// Persist pending verification across reloads until verified
const PENDING_EMAIL_KEY = 'pendingVerificationEmail'
const WARNING_LABELS = {
    'continue-url-rejected': 'Weiterleitungsziel wurde von Firebase ignoriert.',
    'firebase-rate-limited': 'Firebase hat weitere Anfragen vorübergehend blockiert.'
}

// Auth Form
const email = ref('')
const password = ref('')
const isSignUp = ref(false)
const authError = ref('')
const authLoading = ref(false)
const verificationSent = ref(false)
const suppressWatcher = ref(false)
const verificationMessage = ref('')
const showResendForExisting = ref(false)
const attemptedEmail = ref('')
// Getrennt von authError: reine Erfolgs-/Status-Meldungen (z.B. "E-Mail wurde gesendet"),
// damit sie nicht versehentlich mit der roten Fehler-Optik angezeigt werden.
const statusMessage = ref('')

function toggleAuthMode() {
    isSignUp.value = !isSignUp.value
    authError.value = ''
    statusMessage.value = ''
    verificationMessage.value = ''
}
function getRedirectTarget() {
    const q = route.query?.redirect
    return typeof q === 'string' && q.startsWith('/') ? q : '/dashboard'
}

// SICHERHEITSFIX: Es gab hier vorher einen kompletten Mechanismus (persistVerificationLink/
// openVerificationLinkInBrowser/"Link öffnen"-Button), der den vom Server zurückgegebenen,
// echten Verifizierungslink lokal speicherte und per Klick direkt öffnete. Der Server gab
// diesen Link bisher OHNE jede Authentifizierung für JEDE angefragte E-Mail-Adresse zurück -
// wer also nur eine E-Mail-Adresse kannte/erriet, konnte sich darüber einen funktionierenden
// Verifizierungslink besorgen und "bestätigen", ohne je Zugriff auf das echte Postfach zu
// haben. Das hebelte den ganzen Sinn der E-Mail-Verifizierung aus. Der Server gibt den Link
// jetzt gar nicht mehr zurück (siehe server/routes/auth.js) - dieser gesamte Client-seitige
// Mechanismus ist damit gegenstandslos und wurde entfernt. Der einzig verbleibende Weg, die
// E-Mail zu bestätigen, ist der echte Klick auf den Link in der tatsächlich zugestellten E-Mail.

onMounted(() => {
    // Wenn localStorage eine noch nicht verifizierte E‑Mail enthält, Anzeige beibehalten
    try {
        const pending = localStorage.getItem(PENDING_EMAIL_KEY)
        if (pending && !route.query?.emailVerified) {
            verificationSent.value = true
            attemptedEmail.value = pending
        }
        // Falls wir bereits via Query wissen, dass E‑Mail verifiziert wurde, aufräumen
        if (route.query?.emailVerified) {
            localStorage.removeItem(PENDING_EMAIL_KEY)
            verificationSent.value = false
            attemptedEmail.value = ''
            showResendForExisting.value = false
        }
    } catch (e) {
        logger.debug('[WelcomePage] localStorage access failed:', e)
    }
})

// Eigene Mindestanforderungen fürs Passwort bei der Registrierung - Firebase selbst erzwingt
// standardmäßig nur "mind. 6 Zeichen", das ist zu schwach. Rein clientseitig (die Firebase-
// Auth-API wird direkt vom Client aufgerufen, es gibt keinen eigenen Server-Endpunkt für die
// Kontoerstellung) - für eine strengere, serverseitig erzwungene Passwort-Policy müsste
// zusätzlich in der Firebase Console unter Authentication -> Settings -> Password Policy
// "Enforce password policy" aktiviert werden.
const MIN_PASSWORD_LENGTH = 8
function validatePasswordStrength(pw) {
    if (String(pw || '').length < MIN_PASSWORD_LENGTH) {
        return `Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`
    }
    if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) {
        return 'Passwort muss mindestens einen Buchstaben und eine Zahl enthalten.'
    }
    return null
}

async function handleEmailAuth() {
    authError.value = ''
    statusMessage.value = ''
    authLoading.value = true
    try {
        if (isSignUp.value) {
            const passwordError = validatePasswordStrength(password.value)
            if (passwordError) {
                authError.value = passwordError
                authLoading.value = false
                return
            }
            const res = await signUpWithEmail(email.value, password.value)
            if (res && res.pendingEmailVerification) {
                verificationSent.value = true
                statusMessage.value = 'Konto erstellt. Bestätigungs‑E‑Mail wurde gesendet - bitte bestätige deine E‑Mail, bevor du dich anmeldest.'
                // switch back to sign-in view
                isSignUp.value = false
                // suppress watcher navigation for a short grace period to avoid brief auto-login redirect
                suppressWatcher.value = true
                setTimeout(() => { suppressWatcher.value = false }, 5000)
                attemptedEmail.value = email.value
                try { localStorage.setItem(PENDING_EMAIL_KEY, attemptedEmail.value) } catch(e) {}
                return
            }
        } else {
            await signInWithEmail(email.value, password.value)
        }
        // Erfolg: Auth State wird automatisch aktualisiert
    } catch (err) {
        authError.value = err.message || 'Authentifizierung fehlgeschlagen'
        // If email already in use during signup, show option to request verification link
        if (isSignUp.value && /E[-–\s]?Mail/i.test(email.value) || /E‑Mail/i.test(err.message) || /verwende/i.test(err.message) || /already in use/i.test(err.message)) {
            showResendForExisting.value = true
            attemptedEmail.value = email.value
        }
    } finally {
        authLoading.value = false
    }
}

async function handleRequestVerification() {
    authError.value = ''
    verificationMessage.value = ''
    authLoading.value = true
    try {
        const resp = await requestVerificationLink(attemptedEmail.value, { forceNewLink: true })
        verificationSent.value = true
        verificationMessage.value = 'Verifizierungslink wurde gesendet. Bitte prüfe dein Postfach und bestätige die E‑Mail.'
        if (resp?.warnings?.length) {
            const readable = resp.warnings.map((w) => WARNING_LABELS[w] || w)
            verificationMessage.value += ' Hinweis: ' + readable.join(' ')
        }
        try { localStorage.setItem(PENDING_EMAIL_KEY, attemptedEmail.value) } catch(e) {}
    } catch (e) {
        authError.value = e?.message || 'Fehler beim Anfordern des Verifizierungslinks.'
    } finally {
        authLoading.value = false
    }
}

async function handlePasswordReset() {
    if (!email.value) {
        authError.value = 'Bitte gib zuerst deine E-Mail-Adresse oben ein.'
        return
    }
    authError.value = ''
    statusMessage.value = ''
    authLoading.value = true
    try {
        await resetPassword(email.value)
        statusMessage.value = `Passwort-Reset-E-Mail wurde an ${email.value} gesendet. Bitte prüfe dein Postfach (auch den Spam-Ordner).`
    } catch (err) {
        authError.value = err.message || 'Passwort-Reset fehlgeschlagen.'
    } finally {
        authLoading.value = false
    }
}

async function handleResendVerification() {
    verificationMessage.value = ''
    authError.value = ''
    authLoading.value = true
    try {
        // Wenn ein Nutzer eingeloggt ist, nutze clientseitiges resend
        const user = getCurrentUser()
        if (user) {
            await resendVerification()
            verificationMessage.value = 'Bestätigungs‑E‑Mail wurde erneut gesendet.'
        } else if (attemptedEmail.value) {
            // Fallback: Admin-Endpoint anfragen, falls kein eingeloggter Nutzer vorhanden
            const resp = await requestVerificationLink(attemptedEmail.value, { forceNewLink: true })
            verificationMessage.value = 'Verifizierungslink wurde erneut gesendet. Bitte prüfe dein Postfach.'
            if (resp?.warnings?.length) {
                const readable = resp.warnings.map((w) => WARNING_LABELS[w] || w)
                verificationMessage.value += ' Hinweis: ' + readable.join(' ')
            }
        } else {
            throw new Error('Kein eingeloggter Nutzer vorhanden')
        }
        try { localStorage.setItem(PENDING_EMAIL_KEY, attemptedEmail.value) } catch(e) {}
    } catch (err) {
        authError.value = err.message || 'Fehler beim erneuten Senden der E‑Mail.'
    } finally {
        authLoading.value = false
    }
}

async function handleGoogleLogin() {
    authError.value = ''
    authLoading.value = true
    try {
        // Stelle sicher, dass Auth initialisiert ist (doppelt hält besser)
        await initFirebaseAuth()

        const platform = Capacitor?.getPlatform?.() ?? Capacitor?.platform ?? 'unknown'
        const native = platform !== 'web'
        logger.debug('[WelcomePage] Google login start', { platform, native })

        const result = await signInWithGoogle()
        // Kein direktes Setzen des Stores mehr – nur echter Firebase-Status zählt
        const token = await getIdToken()
        const user = getCurrentUser()
        logger.debug('[WelcomePage] Post-login check (should rely on auth listener):', { hasUser: !!user, hasToken: !!token, pending: !!result?.pending })
        // Falls bereits jetzt verfügbar, übernimmt der globale Listener dennoch das Setzen
        // Wir triggern hier nur eine Navigation, wenn wirklich token vorhanden ist
        if (user && token) {
            const target = getRedirectTarget()
            try { document.activeElement?.blur() } catch {}
            await new Promise((res) => setTimeout(res, 0))
            logger.debug('[WelcomePage] Navigating after confirmed token to:', target)
            await router.replace(target)
        } else {
            // Andernfalls warten wir auf den globalen onAuthStateChanged-Flow
            logger.debug('[WelcomePage] Waiting for auth state; no immediate navigation')
        }
    } catch (err) {
        logger.error('[WelcomePage] Google login failed:', err?.message || err, err)
        authError.value = err.message || 'Google Login fehlgeschlagen'
    } finally {
        logger.debug('[WelcomePage] Google login finished, resetting loading state')
        authLoading.value = false
    }
}

async function handleAppleLogin() {
    authError.value = ''
    authLoading.value = true
    try {
        await initFirebaseAuth()

        const platform = Capacitor?.getPlatform?.() ?? Capacitor?.platform ?? 'unknown'
        const native = platform !== 'web'
        logger.debug('[WelcomePage] Apple login start', { platform, native })

        await signInWithApple()

        const token = await getIdToken()
        const user = getCurrentUser()
        if (user && token) {
            const target = getRedirectTarget()
            try { document.activeElement?.blur() } catch {}
            await new Promise((res) => setTimeout(res, 0))
            logger.debug('[WelcomePage] Navigating after confirmed token to:', target)
            await router.replace(target)
        } else {
            logger.debug('[WelcomePage] Waiting for auth state; no immediate navigation')
        }
    } catch (err) {
        logger.error('[WelcomePage] Apple login failed:', err?.message || err, err)
        authError.value = err.message || 'Apple Login fehlgeschlagen'
    } finally {
        logger.debug('[WelcomePage] Apple login finished, resetting loading state')
        authLoading.value = false
    }
}

watch(isSignedIn, async (loggedIn) => {
    logger.debug('[WelcomePage] watch isSignedIn ->', loggedIn, 'route:', router.currentRoute?.value?.fullPath)
    // If an auth action is in progress (signup/login), avoid auto-navigation
    if (authLoading.value) {
        logger.debug('[WelcomePage] auth action in progress; skipping watcher navigation')
        return
    }
    // If we temporarily suppressed watcher (short grace after signup), skip navigation
    if (suppressWatcher.value) {
        logger.debug('[WelcomePage] watcher suppressed; skipping navigation')
        return
    }
    if (!loggedIn) {
        return
    }
    // Nur navigieren, wenn auch wirklich ein Token verfügbar ist
    const token = await getIdToken().catch(() => null)
    if (token) {
        const target = getRedirectTarget()
        try { document.activeElement?.blur() } catch {}
        await new Promise((res) => setTimeout(res, 0))
        logger.debug('[WelcomePage] Auth confirmed via watcher; navigating to:', target)
        router.replace(target)
        // Nach erfolgreichem Login: aufräumen, falls noch pending verification gesetzt war.
        // BUGFIX: Diese Komponente wird beim Ein-/Ausloggen nicht neu gemountet (nur der v-if
        // im Template wechselt), daher überlebten verificationSent/statusMessage/etc. bisher
        // einen erfolgreichen Login - beim nächsten Logout tauchte der alte "E-Mail wurde
        // gesendet"-Hinweis fälschlich wieder auf. Jetzt werden alle Anzeige-States zurückgesetzt.
        try { localStorage.removeItem(PENDING_EMAIL_KEY) } catch(e) {}
        verificationSent.value = false
        verificationMessage.value = ''
        statusMessage.value = ''
        authError.value = ''
        showResendForExisting.value = false
        attemptedEmail.value = ''
    } else {
        logger.debug('[WelcomePage] isSignedIn true but no token yet; holding')
    }
}, { immediate: true })

// Watch für Query-Änderungen (z.B. nach Rückkehr aus Browser mit emailVerified)
watch(() => route.query?.emailVerified, (val) => {
    if (val) {
        try { localStorage.removeItem(PENDING_EMAIL_KEY) } catch(e) {}
        verificationSent.value = false
        attemptedEmail.value = ''
        showResendForExisting.value = false
    }
})
</script>

<template>
    <div class="welcome-page">
        <!-- Nicht eingeloggt: Sign-In -->
        <div v-if="!isSignedIn" class="sign-in-container">
            <div v-if="offlineExpired" class="info-banner">
                <p>Deine Offline‑Sitzung ist abgelaufen. Bitte einmal online anmelden.</p>
            </div>
            <h2>{{ t('welcome.title') }}</h2>
            <div class="mode-badge" :class="isSignUp ? 'mode-signup' : 'mode-signin'">
                {{ isSignUp ? 'Neues Konto registrieren' : 'Anmeldung' }}
            </div>
            <p>{{ isSignUp ? 'Erstelle ein neues Konto mit E‑Mail und Passwort.' : t('welcome.signInPrompt') }}</p>

            <!-- Email/Passwort Form -->
            <div v-if="verificationSent" class="info-banner">
                <p>Bestätigungs‑E‑Mail wurde gesendet. Bitte öffne deine E‑Mail und klicke den Bestätigungslink.</p>
                <div class="resend-row">
                    <button class="resend-btn" @click="handleResendVerification" :disabled="authLoading">E‑Mail erneut senden</button>
                    <span class="small-info" v-if="verificationMessage">{{ verificationMessage }}</span>
                </div>
            </div>
            <div v-else-if="route.query?.emailVerified" class="success-banner">
                <p>E‑Mail erfolgreich bestätigt. Du kannst dich jetzt anmelden.</p>
            </div>
            <div v-if="statusMessage" class="success-banner">
                <p>{{ statusMessage }}</p>
            </div>
            <form @submit.prevent="handleEmailAuth" class="auth-form">
                <input 
                    v-model="email" 
                    type="email" 
                    :placeholder="t('auth.email')" 
                    required 
                    class="auth-input"
                >
                <input
                    v-model="password"
                    type="password"
                    :placeholder="t('auth.password')"
                    required
                    :minlength="isSignUp ? 8 : undefined"
                    :autocomplete="isSignUp ? 'new-password' : 'current-password'"
                    class="auth-input"
                >
                <p v-if="isSignUp" class="password-hint">Mindestens 8 Zeichen, mit Buchstaben und Zahl.</p>
                <button
                    type="submit" 
                    :disabled="authLoading" 
                    class="auth-btn primary"
                >
                    {{ authLoading ? t('auth.loading') : (isSignUp ? t('auth.signUp') : t('auth.signIn')) }}
                </button>
                <div class="auth-links">
                    <button 
                        type="button" 
                        @click="handlePasswordReset" 
                        class="forgot-password"
                        :disabled="authLoading"
                    >
                        {{ t('auth.forgotPassword') }}
                    </button>
                    <button v-if="showResendForExisting" type="button" @click="handleRequestVerification" class="resend-existing" :disabled="authLoading">
                        Verifizierungs‑E‑Mail erneut anfordern
                    </button>
                </div>
                <p v-if="authError" class="error">{{ authError }}</p>
            </form>

            <!-- Toggle zwischen Login und Sign Up -->
            <button
                type="button"
                @click="toggleAuthMode"
                class="toggle-btn"
            >
                {{ isSignUp ? t('auth.haveAccount') : t('auth.noAccount') }}
            </button>
            
            <!-- Oder mit Google oder Apple -->
            <div class="divider">
                <span>{{ t('auth.or') }}</span>
            </div>
            <div class="social-buttons">
                <button class="google-btn" @click="handleGoogleLogin" :disabled="authLoading">
                    <svg class="google-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Google
                </button>
                <button class="apple-btn" @click="handleAppleLogin" :disabled="authLoading">
                    <svg class="apple-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                    Apple
                </button>
            </div>
        </div>

        <!-- Eingeloggt -->
        <div v-else>
            <div class="loading-container">
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
        height: 100dvh;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0; /* kein Außenabstand */
        padding-top: env(safe-area-inset-top, 0px);
        padding-bottom: env(safe-area-inset-bottom, 0px);
        padding-left: env(safe-area-inset-left, 0px);
        padding-right: env(safe-area-inset-right, 0px);
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
        background: transparent;
        border-radius: 0;
        backdrop-filter: none;
        border: none;
        box-shadow: none;
    }

    .loading-container {
        border: none;
    }

    /* Verwende globale .spinner; skaliere hier nur Größe wenn nötig */
    .loading-container .spinner { width: 40px; height: 40px; margin-top: 1rem; }

    .sign-in-btn { background: var(--accent); color: var(--accent-contrast); border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: 600; transition: all 0.3s ease; }

    .sign-in-btn:hover { transform: translateY(-2px); }

    .google-btn {
        background: #fff;
        color: #757575;
        border: 1px solid #dadce0;
        padding: 12px 24px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 16px;
        font-weight: 500;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        gap: 12px;
        justify-content: center;
    }

    .google-btn:hover:not(:disabled) {
        background: #f8f9fa;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .google-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .google-icon {
        width: 20px;
        height: 20px;
        flex-shrink: 0;
    }

    .social-buttons {
        display: flex;
        gap: 12px;
        justify-content: center;
    }

    .google-btn,
    .apple-btn {
        flex: 1;
        max-width: 160px;
        min-width: 140px;
    }

    .apple-btn {
        background: #fff;
        color: #000;
        border: 1px solid #dadce0;
        padding: 12px 24px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 16px;
        font-weight: 500;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        gap: 12px;
        justify-content: center;
    }

    .apple-btn:hover:not(:disabled) {
        background: #f8f9fa;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .apple-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .apple-icon {
        width: 20px;
        height: 20px;
        flex-shrink: 0;
    }

    .auth-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
        width: 100%;
        max-width: 300px;
    }

    .auth-input {
        padding: 12px;
        border: 1px solid var(--card-border);
        border-radius: 8px;
        background: var(--surface);
        color: var(--fg);
        font-size: 16px;
    }

    .password-hint {
        margin: -8px 0 0;
        font-size: 0.8rem;
        color: var(--muted);
    }

    .auth-btn {
        padding: 12px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 16px;
        font-weight: 600;
        transition: all 0.3s ease;
    }

    .auth-btn.primary {
        background: var(--accent);
        color: var(--accent-contrast);
        border: none;
    }

    .auth-btn.primary:hover:not(:disabled) {
        transform: translateY(-2px);
    }

    .auth-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .auth-links {
        display: flex;
        justify-content: flex-end;
        margin-top: 8px;
    }

    .resend-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        justify-content: center;
        margin-top: 8px;
    }

    .resend-btn {
        padding: 8px 16px;
        border-radius: 999px;
        border: 1px solid var(--accent);
        background: var(--accent);
        color: var(--accent-contrast);
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: opacity .2s ease;
    }

    .resend-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .resend-btn.ghost {
        background: transparent;
        color: var(--accent);
    }

    .forgot-password {
        background: transparent;
        color: var(--accent);
        border: none;
        cursor: pointer;
        font-size: 14px;
        text-decoration: underline;
    }

    .forgot-password:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .divider {
        display: flex;
        align-items: center;
        width: 100%;
        max-width: 300px;
        margin: 16px 0;
    }

    .divider::before,
    .divider::after {
        content: '';
        flex: 1;
        height: 1px;
        background: var(--card-border);
    }

    .divider span {
        padding: 0 16px;
        color: var(--muted);
        font-size: 14px;
    }

    .error {
        color: var(--danger-text, var(--danger, #ff5f5f));
        font-size: 14px;
        font-weight: 600;
        text-align: center;
        background: var(--danger-bg, rgba(255, 95, 95, 0.15));
        border: 1px solid var(--danger, #ff5f5f);
        border-radius: 8px;
        padding: 10px 14px;
        margin: 0;
    }

    .mode-badge {
        display: inline-block;
        padding: 4px 14px;
        border-radius: 999px;
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.02em;
        text-transform: uppercase;
    }

    .mode-badge.mode-signin {
        background: var(--surface);
        color: var(--accent);
        border: 1px solid var(--accent);
    }

    .mode-badge.mode-signup {
        background: var(--success-bg, rgba(121, 255, 180, 0.2));
        color: var(--success-text, var(--success, #16a34a));
        border: 1px solid var(--success, #16a34a);
    }

    .info-banner,
    .success-banner {
        width: 100%;
        max-width: 300px;
        border-radius: 10px;
        padding: 12px 14px;
        text-align: center;
        box-sizing: border-box;
    }

    .info-banner {
        background: var(--surface);
        border: 1px solid var(--accent);
    }

    .success-banner {
        background: var(--success-bg, rgba(121, 255, 180, 0.2));
        border: 1px solid var(--success, #16a34a);
    }

    .info-banner p,
    .success-banner p {
        margin: 0;
        color: var(--fg);
        font-size: 14px;
    }

    .success-banner p {
        color: var(--success-text, var(--success, #16a34a));
        font-weight: 600;
    }

    .small-info {
        font-size: 12px;
        color: var(--muted);
    }

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