// client/src/utils/firebaseAuth.js
// Firebase Auth Helper für Vue
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged as firebaseOnAuthStateChanged } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export function useFirebaseAuth() {
  return {
    auth,
    signIn: () => signInWithPopup(auth, new GoogleAuthProvider()),
    signOut: () => signOut(auth),
    onAuthStateChanged: (cb) => firebaseOnAuthStateChanged(auth, cb),
    getCurrentUser: () => auth.currentUser,
    getIdToken: async () => {
      const user = auth.currentUser;
      if (user) return await user.getIdToken();
      return null;
    }
  };
}
