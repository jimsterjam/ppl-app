// client/src/utils/firebaseAuth.js
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  signOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  signInWithCredential
} from 'firebase/auth';

// Konstanten für bessere Wartbarkeit
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const LOG_PREFIX = '[FirebaseAuth]';

// Dynamisch geladenes Plugin
let GoogleAuth = null;

// Plattformspezifische Firebase-Konfiguration
const getFirebaseConfig = () => {
  const isRunningInCapacitor = !!(window.Capacitor || window.capacitor);
  
  if (isRunningInCapacitor) {
    return {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
      iosClientId: GOOGLE_CLIENT_ID
    };
  } else {
    return {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };
  }
};

const firebaseConfig = getFirebaseConfig();
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const appleProvider = new OAuthProvider('apple.com');

// Hilfsfunktionen
const log = (message, level = 'log') => {
  console[level](`${LOG_PREFIX} ${message}`);
};

const handleAuthError = (error, context) => {
  log(`Error in ${context}: ${error.message}`, 'error');
  log(`Details: ${JSON.stringify({ code: error.code, name: error.name })}`, 'error');
  throw error;
};

const createFirebaseCredential = async (idToken) => {
  if (!idToken) throw new Error('No ID token provided');
  const credential = GoogleAuthProvider.credential(idToken);
  const userCredential = await signInWithCredential(auth, credential);
  return await userCredential.user.getIdToken();
};

const loadGoogleAuthPlugin = async () => {
  if (GoogleAuth) return GoogleAuth;
  try {
    const { GoogleAuth: CapacitorGoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
    GoogleAuth = CapacitorGoogleAuth;
    log('GoogleAuth plugin loaded dynamically');
    return GoogleAuth;
  } catch (error) {
    throw new Error('GoogleAuth plugin not available in Capacitor environment');
  }
};

const initializeGoogleAuth = async () => {
  await GoogleAuth.initialize({
    clientId: GOOGLE_CLIENT_ID,
    scopes: ['profile', 'email'],
    grantOfflineAccess: true
  });
  log('GoogleAuth initialized successfully');
};

const performCapacitorAuth = async () => {
  const plugin = await loadGoogleAuthPlugin();
  await initializeGoogleAuth();
  
  log('Calling GoogleAuth.signIn()...');
  const googleUser = await plugin.signIn();
  
  if (!googleUser?.authentication?.idToken) {
    throw new Error('No ID token received from Google Auth');
  }
  
  log('ID Token received, creating Firebase credential...');
  return await createFirebaseCredential(googleUser.authentication.idToken);
};

const performWebAuth = async () => {
  log('Using Firebase popup for web browser');
  const userCredential = await signInWithPopup(auth, googleProvider);
  return await userCredential.user.getIdToken();
};

export function useFirebaseAuth() {
  return {
    auth,

    /** Email/Password Login */
    signInWithEmail: async (email, password) => {
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const token = await userCredential.user.getIdToken();
        log(`Email login successful, token: ${token}`);
        return token;
      } catch (error) {
        handleAuthError(error, 'Email login');
      }
    },

    /** Google Login (nativ für Capacitor, Popup für Web) */
    signInWithGoogle: async () => {
      try {
        log('Starting Google sign-in process...');
        const isRunningInCapacitor = !!(window.Capacitor || window.capacitor);
        log(`Environment check - isCapacitor: ${isRunningInCapacitor}`);
        
        if (isRunningInCapacitor) {
          log('Using native Google Auth for Capacitor');
          return await performCapacitorAuth();
        } else {
          return await performWebAuth();
        }
      } catch (error) {
        // Fallback zu Web-Popup nur bei Plugin-Fehlern in Capacitor
        if (error.message.includes('GoogleAuth plugin')) {
          log('Plugin error, falling back to Firebase popup', 'warn');
          try {
            return await performWebAuth();
          } catch (fallbackError) {
            handleAuthError(fallbackError, 'Fallback Google login');
          }
        }
        handleAuthError(error, 'Google login');
      }
    },

    /** Google Login via Redirect (für Capacitor-WebView) */
    signInWithGoogleRedirect: async () => {
      await signInWithRedirect(auth, googleProvider);
    },

    /** Apple Login via Redirect (Popup funktioniert in WebView nicht zuverlässig) */
    signInWithAppleRedirect: async () => {
      await signInWithRedirect(auth, appleProvider);
    },

    /** Logout */
    signOut: async () => {
      try {
        await signOut(auth);
        log('Signed out successfully');
      } catch (error) {
        handleAuthError(error, 'Logout');
      }
    },

    /** Auth State Listener */
    onAuthStateChanged: (callback) => {
      firebaseOnAuthStateChanged(auth, callback);
    },

    /** Aktueller User */
    getCurrentUser: () => auth.currentUser,

    /** ID Token für Server */
    getIdToken: async () => {
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        log(`ID Token retrieved: ${token}`);
        return token;
      }
      return null;
    },
  };
}
