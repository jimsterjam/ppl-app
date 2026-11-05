// Kontowechsel in derselben App-Sitzung (Abmelden und mit einem anderen Konto anmelden): Speicher, die zum bisherigen Konto
// gehören, werden geleert. Sonst zeigt das neue Konto zunächst den Plan und die Monatsberichte des vorherigen
// (Absprache Paul 05.11.). Aufgerufen in main.js beim Abmelden und beim Wechsel der Nutzer-ID.

/**
 * @param {{ subscription?: { resetForUserChange?: () => void }, monthlyReports?: { reset?: () => void } }} stores
 */
export function resetUserBoundStores({ subscription, monthlyReports } = {}) {
  monthlyReports?.reset?.()
  subscription?.resetForUserChange?.()
}
