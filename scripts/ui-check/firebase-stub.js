// Ersatz für client/src/utils/firebaseAuth.js NUR für scripts/ui-check (kein Login, keine Netzwerkzugriffe).
const noop = async () => null
export const isEffectivelyEmailVerified = () => true
export const initFirebaseAuth = noop
export const requestVerificationLink = noop
const user = { uid: 'ui-check', email: 'ui@check.local', displayName: 'UI Check', emailVerified: true }
export function onAuthStateChanged() {}
export function useFirebaseAuth() {
  return new Proxy({}, {
    get: (_, k) => (k === 'getCurrentUser' ? () => user : k === 'user' ? { value: user } : k === 'getIdToken' ? async () => 'token' : noop)
  })
}
