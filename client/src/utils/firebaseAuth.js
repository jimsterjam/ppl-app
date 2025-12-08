// client/src/utils/firebaseAuth.js
import { initializeApp, getApp, getApps } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithRedirect,
  GoogleAuthProvider,
  OAuthProvider,
  signOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  getRedirectResult,
  signInWithCustomToken
} from 'firebase/auth';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { GoogleAuth } from '@southdevs/capacitor-google-auth';
import { http, apiUrl } from '@/api/http';

// -------- CONFIG (ENV) --------
const iosClientId = import.meta.env?.VITE_IOS_CLIENT_ID || '';
const serverClientId = import.meta.env?.VITE_GOOGLE_SERVER_CLIENT_ID || '';
const defaultScopes = ['profile', 'email'];
let googleAuthInitPromise = null;

// -------- HELPERS --------
const isNativePlatform = () => {
  const platform = Capacitor?.getPlatform?.() ?? Capacitor?.platform;
  return !!platform && platform !== 'web';
};

const isCapacitorRuntime = () => {
  if (isNativePlatform()) return true;
  return !!(window?.Capacitor || window?.capacitor);
};

// Wait until Firebase authState reflects a user (or timeout)
const waitForAuthState = (timeoutMs = 5000) =>
  new Promise((resolve) => {
    const auth = getAuth();
    if (auth.currentUser) return resolve(auth.currentUser);
    let resolved = false;
    const unbind = firebaseOnAuthStateChanged(auth, (u) => {
      if (!resolved) {
        resolved = true;
        unbind();
        resolve(u);
      }
    });
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        unbind();
        resolve(null);
      }
    }, timeoutMs);
  });

// -------- FIREBASE CONFIG (safe) --------
const getFirebaseConfig = () => {
  const nativeRuntime = isNativePlatform();
  const envConfig = {
    apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env?.VITE_FIREBASE_APP_ID || '',
    iosClientId: import.meta.env?.VITE_IOS_CLIENT_ID || ''
  };

  // If running native and env not loaded, you may want to embed fallback values
  // But leaving empty strings is safer than broken syntax.
  const authDomain = nativeRuntime
    ? // Use custom scheme or project authDomain if available
      envConfig.authDomain || undefined
    : envConfig.authDomain || undefined;

  return {
    apiKey: envConfig.apiKey || '',
    authDomain,
    projectId: envConfig.projectId || '',
    storageBucket: envConfig.storageBucket || '',
    messagingSenderId: envConfig.messagingSenderId || '',
    appId: envConfig.appId || ''
    // iosClientId not part of firebase config object; used separately
  };
};

const firebaseConfig = getFirebaseConfig();

// -------- INITIALIZE FIREBASE --------
// Robust gegen Mehrfach-Imports/HMR: nur ein App-Instance
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
// Verwende initializeAuth mit expliziter Persistence im nativen Runtime
let auth;
if (isNativePlatform()) {
  auth = initializeAuth(app, { persistence: browserLocalPersistence });
} else {
  auth = getAuth(app);
}

// Debug: Prüfe, ob fetch/Headers nativ sind (wichtiger Hinweis für Firebase-Interna)
// Minimal runtime info (keine ausführlichen Netzwerk-Diagnostics im Produktionsbetrieb)
(() => { try { console.log('[FirebaseAuth] Runtime:', { native: isNativePlatform() }); } catch {} })();

// Signal, wann Persistence gesetzt ist (wichtig für WKWebView)
let persistenceReady = Promise.resolve();

// For Capacitor native runtimes: use browserLocalPersistence (IndexedDB sometimes broken in WKWebView)
if (isNativePlatform()) {
  persistenceReady = setPersistence(auth, browserLocalPersistence).catch(() => {});
}

// -------- PROVIDERS --------
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
const appleProvider = new OAuthProvider('apple.com');

// -------- TOKEN EXCHANGE WITH BACKEND --------
const exchangeNativeGoogleToken = async (result) => {
  const payload = {
    idToken: result?.authentication?.idToken,
    accessToken: result?.authentication?.accessToken,
    serverAuthCode: result?.serverAuthCode,
    email: result?.email,
    googleId: result?.id
  };

  if (!payload.idToken) {
    throw new Error('Missing Google ID token');
  }

  try {
    console.log('[FirebaseAuth] 🔄 Exchanging native Google tokens with backend');

    // On native runtimes, prefer CapacitorHttp to avoid WKWebView proxy/ATS edge cases
    if (isNativePlatform() && typeof CapacitorHttp?.request === 'function') {
      const url = apiUrl('auth/google-native');
      const resp = await CapacitorHttp.request({
        method: 'POST',
        url,
        headers: { 'Content-Type': 'application/json' },
        data: payload
      });
      const data = resp?.data;
      if (!data?.customToken) {
        console.error('[FirebaseAuth] Backend did not return a custom token', data);
        throw new Error('No custom token from backend');
      }
      return data;
    }

    // Fallback: Axios (web or if CapacitorHttp is unavailable)
    const { data } = await http.post('auth/google-native', payload);
    if (!data?.customToken) {
      console.error('[FirebaseAuth] Backend did not return a custom token', data);
      throw new Error('No custom token from backend');
    }
    return data;
  } catch (err) {
    console.error('[FirebaseAuth] ❌ Token exchange failed:', err);
    throw err;
  }
};

// -------- EXPORTED HOOK --------
export function useFirebaseAuth() {
  return {
    auth,

    // ... email methods kept unchanged
    signInWithEmail: async (email, password) => {
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const token = await userCredential.user.getIdToken();
        return token;
      } catch (err) {
        throw err;
      }
    },

    signUpWithEmail: async (email, password) => {
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const token = await userCredential.user.getIdToken();
        return token;
      } catch (err) {
        throw err;
      }
    },

    resetPassword: async (email) => {
      try {
        await sendPasswordResetEmail(auth, email);
      } catch (err) {
        throw err;
      }
    },

    // -------- MAIN: Google sign-in (native path -> exchange -> signInWithCustomToken) --------
    signInWithGoogle: async () => {
      try {
        console.log('[FirebaseAuth] 🚀 Starting Google sign-in process...');
        const native = isNativePlatform();
        const capacRuntime = isCapacitorRuntime();
        console.log('[FirebaseAuth] 📱 Environment check - native:', native, 'capacitor runtime:', capacRuntime);

        // NATIVE FLOW using capacitor plugin
        if (native && typeof GoogleAuth?.signIn === 'function') {
          console.log('[FirebaseAuth] 📲 Using Capacitor Google Auth plugin');

          // initialize plugin once, avoid race conditions
          if (!googleAuthInitPromise && typeof GoogleAuth?.initialize === 'function') {
            googleAuthInitPromise = (async () => {
              try {
                await GoogleAuth.initialize({
                  clientId: iosClientId,
                  serverClientId,
                  scopes: defaultScopes,
                  forceCodeForRefreshToken: true
                });
                console.log('[FirebaseAuth] ✅ Capacitor GoogleAuth initialized');
              } catch (err) {
                console.error('[FirebaseAuth] ❌ GoogleAuth initialization failed:', err);
                googleAuthInitPromise = null;
                throw err;
              }
            })();
          }

          if (googleAuthInitPromise) {
            await googleAuthInitPromise;
          }

          // sign in natively
          const result = await GoogleAuth.signIn({
            clientId: iosClientId,
            serverClientId,
            scopes: defaultScopes
          });

          console.log('[FirebaseAuth] ✅ Google Auth result received');

          if (!result?.authentication?.idToken) {
            throw new Error('No Google ID token received from Capacitor Google Auth');
          }

          // exchange native token at backend for firebase custom token
          const exchange = await exchangeNativeGoogleToken(result);
          console.log('[FirebaseAuth] 🔐 Received custom Firebase token from backend');

          // Ensure persistence fully ready (await it properly)
          try {
            await Promise.race([
              persistenceReady,
              new Promise((res) => setTimeout(res, 5000))
            ]);
          } catch (e) {
            console.warn('[FirebaseAuth] ⚠️ persistenceReady failed or timed out, continuing anyway', e?.message || e);
          }

          // Helper: optional timeout wrapper (disabled for native to avoid premature rejection)
                    const withTimeout = (p, ms) =>
                      isNativePlatform()
                        ? p
                        : new Promise((resolve, reject) => {
                            const t = setTimeout(() => reject(new Error('customToken sign-in timeout')), ms);
                            p.then((v) => { clearTimeout(t); resolve(v); }).catch((e) => { clearTimeout(t); reject(e); });
                          });

          // Try primary sign-in (longer timeout)
          let userCredential = null;
          try {
            // Auf Native kein künstlicher Timeout, um WKWebView-Latenzen zu tolerieren
            userCredential = await withTimeout(signInWithCustomToken(auth, exchange.customToken), 30000);
            console.log('[FirebaseAuth] ✅ signInWithCustomToken succeeded');

          } catch (err) {
            console.warn('[FirebaseAuth] signInWithCustomToken failed:', err?.message || err);
          }

          // If primary didn't set current user, do a small retry loop with backoff
          const ensureAuthState = async () => {
            if (auth.currentUser) return auth.currentUser;
            // if userCredential exists, try reload
            try {
              if (userCredential?.user?.reload) {
                await userCredential.user.reload();
              }
            } catch (reloadErr) {
              console.warn('[FirebaseAuth] reload() after signIn failed:', reloadErr?.message || reloadErr);
            }

            // wait for auth state event for up to 8s
            const maybe = await waitForAuthState(8000);
            if (maybe) return maybe;

            // exponential backoff retries calling signInWithCustomToken again (in background) up to 3 times
            let backoff = 300;
            for (let attempt = 1; attempt <= 3; attempt++) {
              try {
                await signInWithCustomToken(auth, exchange.customToken);
                const after = await waitForAuthState(5000);
                if (after) return after;
              } catch {}
              await new Promise((r) => setTimeout(r, backoff));
              backoff *= 2;
            }

            return null;
          };

          const finalUser = await ensureAuthState();

          if (!finalUser) {
            console.warn('[FirebaseAuth] ❗️ After retries, auth.currentUser still null. Returning pending state.');
            // Keep UI deferred — caller should detect pending or null user and handle appropriately
            return { user: null, token: null, pending: true };
          }

          // Final token and success
          const token = await finalUser.getIdToken();
          console.log('[FirebaseAuth] 🎉 Capacitor Google login successful via custom token (final user):', finalUser.uid);
          return { user: finalUser, token };
        }

        // If running native but plugin missing -> explicit error (so you can handle it)
        if (native) {
          console.error('[FirebaseAuth] ❌ GoogleAuth plugin not available on native platform');
          throw new Error('Capacitor GoogleAuth plugin unavailable');
        }

        // WEB flow (popup)
        {
          console.log('[FirebaseAuth] 🌐 Web Google login via popup is disabled in this build');
          throw new Error('Web Google popup flow disabled');
        }
      } catch (err) {
        console.error('[FirebaseAuth] 💥 Google login failed:', err);
        console.error('[FirebaseAuth] 📋 Error details:', {
          message: err?.message,
          code: err?.code,
          name: err?.name,
          stack: err?.stack
        });
        throw err;
      }
    },

    // redirect helpers (unchanged)
    signInWithGoogleRedirect: async () => {
      await signInWithRedirect(auth, googleProvider);
    },

    handleRedirectResult: async () => {
      try {
        // On native Capacitor runtimes we don't use web redirects; skip gracefully
        if (isNativePlatform()) {
          return null;
        }
        const result = await getRedirectResult(auth);
        if (result && result.user) {
          const token = await result.user.getIdToken();
          console.log('[FirebaseAuth] 🔁 Redirect result handled, user signed in, token:', token);
          return token;
        }
        return null;
      } catch (err) {
        // Benign when no redirect has occurred or environment doesn't support it
        const code = err?.code || err?.message || '';
        if (code === 'auth/argument-error' || code === 'auth/no-auth-event') {
          console.warn('[FirebaseAuth] Redirect result not available (benign):', code);
          return null;
        }
        console.error('[FirebaseAuth] ❌ Handling redirect result failed:', err);
        throw err;
      }
    },

    signInWithAppleRedirect: async () => {
      await signInWithRedirect(auth, appleProvider);
    },

    signOut: async () => {
      try {
        if (isNativePlatform() && typeof GoogleAuth?.signOut === 'function') {
          try {
            await GoogleAuth.signOut();
            console.log('[FirebaseAuth] Capacitor Google Auth sign out');
          } catch (err) {
            console.warn('[FirebaseAuth] Capacitor Google Auth sign out failed:', err);
          }
        }
        await signOut(auth);
        console.log('[FirebaseAuth] Signed out successfully');
      } catch (err) {
        console.error('[FirebaseAuth] Logout failed:', err);
        throw err;
      }
    },

    onAuthStateChanged: (callback) => {
      firebaseOnAuthStateChanged(auth, callback);
    },

    getCurrentUser: () => auth.currentUser,

    getIdToken: async () => {
      let user = auth.currentUser;
      if (!user) {
        // wait briefly for auth state to settle (e.g., after custom token sign-in in WKWebView)
        user = await waitForAuthState(6000);
      }
      if (user) {
        try {
          const token = await user.getIdToken();
          console.log('[FirebaseAuth] ID Token retrieved (wait-aware):', !!token);
          return token;
        } catch (e) {
          console.warn('[FirebaseAuth] getIdToken failed once, retrying shortly...', e?.message || e);
          // tiny backoff retry
          await new Promise((r) => setTimeout(r, 300));
          return user.getIdToken().catch(() => null);
        }
      }
      console.warn('[FirebaseAuth] getIdToken: no current user after wait');
      return null;
    }
  };
}
