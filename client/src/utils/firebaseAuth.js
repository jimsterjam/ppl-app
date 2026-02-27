import { initializeApp, getApps, getApp } from 'firebase/app'
import {
  getAuth,
  initializeAuth,
  setPersistence,
  browserLocalPersistence,
  indexedDBLocalPersistence,
  signOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  sendEmailVerification,
  signInWithCredential,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth'

import { Capacitor } from '@capacitor/core'
import { logger } from '@/utils/logger'
import { clearAllOfflineData } from '@/utils/offlineStorage'
import { GoogleAuth } from '@southdevs/capacitor-google-auth'
import { SignInWithApple } from '@capacitor-community/apple-sign-in'

/* -------------------------------- CONFIG -------------------------------- */

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
}

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1'])

function resolveContinueUrl() {
  const fallback = (typeof window !== 'undefined' && window.location?.origin)
    ? `${window.location.origin}/?emailVerified=1`
    : ''
  const raw = import.meta.env.VITE_APP_EMAIL_VERIFY_URL || fallback || ''
  if (!raw) return null
  try {
    const parsed = new URL(raw)
    const isLocal = LOCAL_HOSTNAMES.has(parsed.hostname)
    if (parsed.protocol === 'https:' || isLocal) {
      return parsed.toString()
    }
    logger.warn('[firebaseAuth] continueUrl verworfen (nur https oder localhost erlaubt):', raw)
    return null
  } catch (err) {
    logger.warn('[firebaseAuth] continueUrl ungültig, verworfen:', raw, err?.message || err)
    return null
  }
}

const isNative = () => {
  const platform = Capacitor?.getPlatform?.()
  return platform && platform !== 'web'
}

const NONCE_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

function createRandomNonce(length = 32) {
  const bytes = new Uint8Array(length)
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  let nonce = ''
  for (let i = 0; i < bytes.length; i += 1) {
    nonce += NONCE_CHARS[bytes[i] % NONCE_CHARS.length]
  }
  return nonce
}

async function sha256Hex(input) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto API not available for SHA-256')
  }
  const data = new TextEncoder().encode(input)
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

let auth = null
let initPromise = null

/* ------------------------------ INITIALIZE ------------------------------ */

export async function initFirebaseAuth() {
  if (initPromise) return initPromise

  initPromise = (async () => {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

    if (isNative()) {
      auth = initializeAuth(app, {
        persistence: indexedDBLocalPersistence
      })
    } else {
      auth = getAuth(app)
      await setPersistence(auth, browserLocalPersistence)
    }

    return auth
  })().catch(err => {
    initPromise = null
    throw err
  })

  return initPromise
}

// Request a verification link for an existing email via backend admin endpoint
export async function requestVerificationLink(email, options = {}) {
  const apiBase = import.meta.env.VITE_API_BASE || ''
  const endpoint = (apiBase.replace(/\/$/, '') || '') + '/api/auth/resend-verification'
  const continueUrl = resolveContinueUrl()
  const body = { email }
  if (options.forceNewLink) body.forceNewLink = true
  if (continueUrl) body.continueUrl = continueUrl
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error('Verifizierungslink anfordern fehlgeschlagen: ' + (text || res.status))
  }
  const json = await res.json().catch(() => ({}))
  return json
}

/* ------------------------------ MAIN HOOK ------------------------------- */

export function useFirebaseAuth() {
  if (!auth) throw new Error('Firebase not initialized')

  const googleProvider = new GoogleAuthProvider()
  const appleProvider = new OAuthProvider('apple.com')

  appleProvider.addScope('email')
  appleProvider.addScope('name')

  const googleConfig = {
    webClientId: import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID, // Firebase Web Client ID
    iosClientId: import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID  // iOS Client ID
  }

  const initGooglePlugin = async () => {
    if (!isNative()) return true

    try {
      await GoogleAuth.initialize({
        scopes: ['profile', 'email'],
        iosClientId: googleConfig.iosClientId,
        serverClientId: googleConfig.webClientId, // MUST be Firebase Web Client ID
        forceCodeForRefreshToken: true
      })
      return true
    } catch (err) {
      return false
    }
  }

  const signInWithGoogle = async () => {
    if (!isNative()) {
      return signInWithRedirect(auth, googleProvider)
    }

    const ok = await initGooglePlugin()
    if (!ok) return signInWithRedirect(auth, googleProvider)

    let result
    try {
      result = await GoogleAuth.signIn({
        scopes: ['profile', 'email'],
        iosClientId: googleConfig.iosClientId,
        serverClientId: googleConfig.webClientId,
        forceCodeForRefreshToken: true
      })
    } catch (err) {
      throw err
    }

    // Normalize result shape: some plugin versions return tokens at result.authentication
    const idToken = result?.idToken || result?.authentication?.idToken
    const serverAuthCode = result?.serverAuthCode || result?.authentication?.serverAuthCode
    const email = result?.email || result?.authentication?.email
    const googleId = result?.id || result?.authentication?.id


    if (!idToken && !serverAuthCode) {
      throw new Error('No idToken or serverAuthCode returned from GoogleAuth')
    }

    // Backend-Exchange: serverAuthCode -> Firebase Custom Token
    const apiBase = import.meta.env.VITE_API_BASE || ''
    const endpoint = (apiBase.replace(/\/$/, '') || '') + '/api/auth/google-native'
    // Send both idToken (if present) and serverAuthCode to allow server to choose
    const body = { email, googleId }
    if (idToken) body.idToken = idToken
    if (serverAuthCode) body.serverAuthCode = serverAuthCode

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    const json = await resp.json().catch(() => ({}))
    if (!resp.ok || !json?.customToken) {
      throw new Error('Backend exchange failed')
    }

    const userCred = await signInWithCustomToken(auth, json.customToken)

    return userCred
  }

  const signInWithAppleNative = async () => {
    const rawNonce = createRandomNonce()
    const hashedNonce = await sha256Hex(rawNonce)
    const appleClientId = import.meta.env.VITE_APPLE_SERVICE_ID || import.meta.env.VITE_APPLE_CLIENT_ID
    const appleRedirectUrl = import.meta.env.VITE_APPLE_REDIRECT_URL

    if (!appleClientId || !appleRedirectUrl) {
      throw new Error('Apple Sign-In ist nicht konfiguriert (VITE_APPLE_SERVICE_ID und VITE_APPLE_REDIRECT_URL fehlen).')
    }

    const options = {
      clientId: appleClientId,
      redirectURI: appleRedirectUrl,
      scopes: 'email name',
      nonce: hashedNonce
    }
    const result = await SignInWithApple.authorize(options)
    const idToken = result?.response?.identityToken

    if (!idToken) {
      throw new Error('No Apple identity token returned')
    }

    const credential = appleProvider.credential({ idToken, rawNonce })
    return signInWithCredential(auth, credential)
  }

  const signInWithApple = () => {
    if (!isNative()) {
      return signInWithRedirect(auth, appleProvider)
    }
    return signInWithAppleNative()
  }

  const signInWithAppleRedirect = () => signInWithRedirect(auth, appleProvider)
  const signInWithEmail = async (email, password) => {
    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password)
      // Enforce email verification: if not verified, sign out and inform user
      if (userCred?.user && !userCred.user.emailVerified) {
        await signOut(auth)
        throw new Error('Bitte bestätige deine E‑Mail-Adresse. Wir haben eine Bestätigungs‑E‑Mail gesendet.')
      }
      return userCred
    } catch (err) {
      throw new Error(mapAuthError(err))
    }
  }
  const mapAuthError = (err) => {
    const code = err?.code || err?.message || String(err)
    switch (code) {
      case 'auth/user-not-found': return 'Kein Konto gefunden. Bitte registrieren oder E‑Mail prüfen.'
      case 'auth/wrong-password': return 'Falsches Passwort. Bitte erneut versuchen.'
      case 'auth/invalid-email': return 'Ungültige E‑Mail‑Adresse.'
      case 'auth/email-already-in-use': return 'E‑Mail wird bereits verwendet.'
      case 'auth/weak-password': return 'Passwort zu schwach (min. 6 Zeichen).'
      case 'auth/too-many-requests': return 'Zu viele Anmeldeversuche. Versuche es später erneut.'
      default: return 'Authentifizierungsfehler. Bitte überprüfe Eingaben.'
    }
  }

  const signUpWithEmail = async (email, password) => {
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password)
      try {
        // Send verification email with continue URL so user returns to app/browser hint
        const continueUrl = resolveContinueUrl()
        const actionCodeSettings = continueUrl ? { url: continueUrl, handleCodeInApp: false } : undefined
        await sendEmailVerification(userCred.user, actionCodeSettings)
        // After sending verification, sign out to prevent unverified users from gaining access
        try { await signOut(auth) } catch (e) { /* ignore signOut failures */ }
      } catch (e) {
        // ignore failure to send email here; surface generic message below
      }
      // Keep user signed in but require verification before granting access
      return { pendingEmailVerification: true }
    } catch (err) {
      throw new Error(mapAuthError(err))
    }
  }

  const resendVerification = async () => {
    const user = auth.currentUser
    if (!user) throw new Error('Kein eingeloggter Nutzer vorhanden')
    try {
      const continueUrl = resolveContinueUrl()
      const actionCodeSettings = continueUrl ? { url: continueUrl, handleCodeInApp: false } : undefined
      await sendEmailVerification(user, actionCodeSettings)
      return true
    } catch (e) {
      throw new Error('Fehler beim Senden der Bestätigungs‑E‑Mail')
    }
  }
  const resetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email)
      return true
    } catch (err) {
      throw new Error(mapAuthError(err))
    }
  }

  const getIdToken = (force = false) =>
    auth.currentUser?.getIdToken(force) ?? Promise.resolve(null)

  const handleRedirectResult = () => getRedirectResult(auth)

  const logout = async () => {
    if (!auth.currentUser) return
    await signOut(auth)
  }

  const deleteAccount = async (confirmationText) => {
    if (!auth.currentUser) throw new Error('No user')

    if (!['ACCOUNT LÖSCHEN', 'DELETE ACCOUNT'].includes(confirmationText?.toUpperCase())) {
      throw new Error('Invalid confirmation text')
    }

    // DEBUG: collect token result and log claims to help diagnose auth issues on device
    // avoid logging token details in production; keep silent on success
    try { await auth.currentUser.getIdTokenResult(true) } catch (e) { /* ignore */ }

    const token = await auth.currentUser.getIdToken(true)

    const apiBase = import.meta.env.VITE_API_BASE || ''
    const endpoint = (apiBase.replace(/\/$/, '') || '') + '/api/account/delete'

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ confirmation: confirmationText })
    })

    const respText = await res.text().catch(() => null)
    let respJson = null
    try { respJson = respText ? JSON.parse(respText) : null } catch (e) { respJson = respText }
    // keep no verbose network logs here

    if (!res.ok) {
      const errMsg = (respJson && respJson.message) || (respJson && respJson.error) || `Status ${res.status}`
      throw new Error('Account deletion failed: ' + errMsg)
    }

    await signOut(auth)
    try { localStorage.clear(); sessionStorage.clear() } catch(e) {}
    try { await clearAllOfflineData() } catch(e) { logger.warn('[firebaseAuth] clearAllOfflineData failed', e) }
  }

  return {
    auth,
    onAuthStateChanged: (cb) => firebaseOnAuthStateChanged(auth, cb),
    getCurrentUser: () => auth.currentUser,

    signInWithGoogle,
    signInWithApple,
    signInWithAppleRedirect,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,

    getIdToken,
    handleRedirectResult,
    logout,
    // alias for components expecting `signOut`
    signOut: logout,
    deleteAccount,
    // backwards-compatible alias used in some views
    deleteCurrentAccount: deleteAccount
    ,resendVerification
    ,requestVerificationLink
  }
}
