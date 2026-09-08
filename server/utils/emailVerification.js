/**
 * Reine Entscheidungslogik: ist eine E-Mail-Adresse anhand eines dekodierten Firebase-ID-Tokens
 * als "verifiziert" zu behandeln? Keine Datenbank-, Netzwerk- oder Firebase-Admin-SDK-
 * Abhängigkeiten - bewusst aus middleware/firebaseAuth.js herausgezogen (die dort zusätzlich
 * `utils/firebaseAdmin.js` importiert, welche beim Laden das Admin-SDK initialisiert und ohne
 * gültige Zugangsdaten/Env-Variable wirft). Diese Kopplung führte dazu, dass der reine Logik-
 * Test allein durchs Importieren von firebaseAuth.js in Umgebungen ohne Firebase-Zugangsdaten
 * (z.B. GitHub Actions ohne hinterlegtes Secret) komplett fehlschlug, obwohl der getestete Code
 * selbst gar keine Zugangsdaten braucht. Mit dieser Auslagerung läuft der Test überall ohne
 * jegliche Firebase-Credentials - und es müssen dafür KEINE Secrets in GitHub hinterlegt werden.
 */

export function isEmailVerifiedFromToken(decodedToken) {
  const signInProvider = decodedToken?.firebase?.sign_in_provider || null
  const isFederatedProvider = !!signInProvider && signInProvider !== 'password'
  return decodedToken?.email_verified === true
    || decodedToken?.emailVerified === true
    || isFederatedProvider
}
