// client/src/utils/firebaseAuth.js
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  OAuthProvider,
  signOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  signInWithCredential
} from 'firebase/auth';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';

// Plattformspezifische Firebase-Konfiguration
const getFirebaseConfig = () => {
  const isCapacitor = !!(window.Capacitor || window.capacitor);
  
  if (isCapacitor) {
    // iOS/Android spezifische Konfiguration aus GoogleService-Info.plist
    return {
      apiKey: "AIzaSyAz_3hQdbMqxv3NiQS2O00euxsPnLSAdU0", // iOS API Key
      authDomain: "ppl-workout-01.firebaseapp.com",
      projectId: "ppl-workout-01",
      storageBucket: "ppl-workout-01.firebasestorage.app",
      messagingSenderId: "440924652132",
      appId: "1:440924652132:ios:60da56556afd2e4a219571", // iOS App ID
      iosClientId: "109118119734-ltjcuc3c0fa8qft2j20lr28adak7scbd.apps.googleusercontent.com"
    };
  } else {
    // Web-Konfiguration aus .env
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

// Firebase App initialisieren
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Provider
const googleProvider = new GoogleAuthProvider();
const appleProvider = new OAuthProvider('apple.com');

export function useFirebaseAuth() {
  return {
    auth,

    /** Email/Password Login */
    signInWithEmail: async (email, password) => {
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const token = await userCredential.user.getIdToken();
        console.log('[FirebaseAuth] Email login successful, token:', token);
        return token;
      } catch (err) {
        console.error('[FirebaseAuth] Email login failed:', err);
        throw err;
      }
    },

    /** Google Login (nativ für Capacitor, Popup für Web) */
    signInWithGoogle: async () => {
      try {
        // Prüfe, ob wir in Capacitor sind
        const isCapacitor = !!(window.Capacitor || window.capacitor);
        
        if (isCapacitor) {
          console.log('[FirebaseAuth] Using native Google Auth for Capacitor');
          
          // Native Google Auth verwenden
          const googleUser = await GoogleAuth.signIn();
          console.log('[FirebaseAuth] Native Google Auth successful:', googleUser);
          
          // Firebase Credential erstellen und anmelden
          const credential = GoogleAuthProvider.credential(googleUser.authentication.idToken);
          const userCredential = await signInWithCredential(auth, credential);
          
          const token = await userCredential.user.getIdToken();
          console.log('[FirebaseAuth] Firebase sign in successful, token:', token);
          return token;
        } else {
          console.log('[FirebaseAuth] Using popup for browser');
          const userCredential = await signInWithPopup(auth, googleProvider);
          const token = await userCredential.user.getIdToken();
          console.log('[FirebaseAuth] Google login successful, token:', token);
          return token;
        }
      } catch (err) {
        console.error('[FirebaseAuth] Google login failed:', err);
        throw err;
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
        console.log('[FirebaseAuth] Signed out successfully');
      } catch (err) {
        console.error('[FirebaseAuth] Logout failed:', err);
        throw err;
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
        console.log('[FirebaseAuth] ID Token retrieved:', token);
        return token;
      }
      return null;
    },
  };
}
