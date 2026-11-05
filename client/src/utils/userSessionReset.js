// Kontowechsel in derselben App-Sitzung (Abmelden und mit einem anderen Konto anmelden): Speicher, die zum bisherigen Konto
// gehören, werden geleert. Sonst zeigt das neue Konto zunächst den Plan und die Monatsberichte des vorherigen und fragt
// mit dessen noch zwischengespeichertem Token beim Server an (Absprache Paul 05.11.). Aufgerufen in main.js beim Abmelden
// und bei jeder Anmeldung mit geänderter Nutzer-ID (auch bei der ersten Anmeldung nach einem Kaltstart ohne gemerktes Konto).

/**
 * @param {{ subscription?: { resetForUserChange?: () => void }, monthlyReports?: { reset?: () => void },
 *   clearAuthToken?: () => void }} stores
 */
export function resetUserBoundStores({ subscription, monthlyReports, clearAuthToken } = {}) {
  // Zuerst den Token vergessen, damit alle folgenden Abfragen schon den des neuen Kontos holen.
  clearAuthToken?.()
  monthlyReports?.reset?.()
  subscription?.resetForUserChange?.()
}
