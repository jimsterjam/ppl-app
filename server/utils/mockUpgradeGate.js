// Die Upgrade-Route vergibt Pro/Elite ohne Zahlung (Mock). Sie ist nur für lokale Entwicklung
// gedacht und in Produktion immer gesperrt, bis echte In-App-Käufe samt Prüfung existieren.
export function isMockUpgradeAllowed(env = process.env) {
  if (env.NODE_ENV === 'production') return false
  return env.ALLOW_MOCK_UPGRADE === 'true'
}
