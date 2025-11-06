/**
 * 🧪 DEVELOPMENT ONLY - Browser Console Helper für Feature Testing
 * 
 * @description
 * Stellt globale Test-Funktionen in der Browser-Konsole bereit.
 * Nur für Development - wird in Production automatisch deaktiviert.
 * 
 * @usage
 * Öffne Browser DevTools (F12) und tippe:
 * ```javascript
 * testApp.help()              // Zeigt alle verfügbaren Funktionen
 * testApp.openFeatureTest()   // Navigiert zum Test-Dashboard
 * testApp.enableDebug()       // Aktiviert Debug-Logging
 * ```
 * 
 * @example
 * // Subscription zurücksetzen
 * testApp.resetSubscription()
 * 
 * // Alle Daten löschen
 * testApp.clearAllData()
 * 
 * @version 1.0.0
 * @author Bro Split App Team
 * @since 2025-11-06
 */

// Global verfügbare Test-Funktionen (nur Development)
window.testApp = {
  /**
   * Navigiert zum Feature Test Dashboard
   * @returns {void}
   */
  openFeatureTest() {
    window.location.href = '/features-test'
  },
  
  /**
   * Aktiviert Developer Tools in den Settings
   * @returns {void}
   */
  enableDevTools() {
    localStorage.setItem('enableDevTools', 'true')
    console.log('✅ Developer Tools aktiviert! Gehe zu /settings')
  },
  
  /**
   * Setzt Subscription auf Free Plan zurück
   * @returns {void}
   */
  resetSubscription() {
    localStorage.removeItem('subscription')
    sessionStorage.clear()
    console.log('✅ Subscription zurückgesetzt!')
  },
  
  /**
   * Löscht ALLE App-Daten (localStorage, sessionStorage, IndexedDB)
   * ⚠️ ACHTUNG: Nicht rückgängig zu machen!
   * @returns {void}
   */
  clearAllData() {
    localStorage.clear()
    sessionStorage.clear() 
    if ('indexedDB' in window) {
      indexedDB.deleteDatabase('fitness-app')
    }
    console.log('✅ Alle App-Daten gelöscht!')
  },
  
  /**
   * Aktiviert Debug-Logging für verschiedene Module
   * @returns {void}
   */
  enableDebug() {
    localStorage.setItem('debug', 'subscription,ai,social,api')
    console.log('✅ Debug-Modus aktiviert!')
  },
  
  /**
   * Zeigt alle verfügbaren Test-Funktionen und deren Beschreibung
   * @returns {void}
   */
  help() {
    console.log(`
🧪 Test App Helper Functions:

📱 Navigation:
  testApp.openFeatureTest()    → Öffne Feature Test Dashboard

🔧 Development:
  testApp.enableDevTools()    → Aktiviere Developer Tools
  testApp.enableDebug()       → Aktiviere Debug Logging

💾 Data Management:
  testApp.resetSubscription() → Reset zu Free Plan
  testApp.clearAllData()      → Lösche alle App-Daten

❓ Help:
  testApp.help()             → Diese Hilfe anzeigen

📚 Direkte URLs:
  /features-test             → Feature Test Dashboard
  /dashboard                 → App Dashboard  
  /settings                  → Einstellungen (mit Dev Tools)
    `)
  }
}

/**
 * Automatische Initialisierung im Development Mode
 * Zeigt Hinweis in Browser-Konsole wenn auf localhost
 */
if (window.location.hostname === 'localhost') {
  console.log(`
🚀 Fitness App - Development Mode

Schnellzugriff:
  testApp.openFeatureTest() → Feature Testing
  testApp.help()           → Alle Funktionen

Direct Link: http://localhost:5173/features-test
  `)
}

export default window.testApp