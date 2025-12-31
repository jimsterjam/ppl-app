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
  signInWithCredential,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth'

import { Capacitor } from '@capacitor/core'
import { GoogleAuth } from '@southdevs/capacitor-google-auth'

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

const isNative = () => {
  const platform = Capacitor?.getPlatform?.()
  return platform && platform !== 'web'
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

  const signInWithApple = () => signInWithRedirect(auth, appleProvider)
  const signInWithEmail = (email, password) => signInWithEmailAndPassword(auth, email, password)
  const signUpWithEmail = (email, password) => createUserWithEmailAndPassword(auth, email, password)
  const resetPassword = (email) => sendPasswordResetEmail(auth, email)

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

    const token = await auth.currentUser.getIdToken(true)

    const res = await fetch('/api/account/delete', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ confirmation: confirmationText })
    })

    if (!res.ok) throw new Error('Account deletion failed')

    await signOut(auth)
    localStorage.clear()
    sessionStorage.clear()
  }

  return {
    auth,
    onAuthStateChanged: (cb) => firebaseOnAuthStateChanged(auth, cb),
    getCurrentUser: () => auth.currentUser,

    signInWithGoogle,
    signInWithApple,
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
  }
}
