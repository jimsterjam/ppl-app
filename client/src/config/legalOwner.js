// Angaben zum Betreiber für Impressum und Datenschutzerklärung - EINZIGE Stelle, an der sie gepflegt werden.
// Angaben von Jimmy am 24.10.2026 eingetragen und am 10.11.2026 als richtig bestätigt. Sie stehen im Impressum und in der
// Datenschutzerklärung der App und der Website (site/), also öffentlich.
// E-Mail: support@formbeatsego.de (Absprache Jimmy 10.11.2026), auch Ziel von "Feedback per E-Mail" in der App.
export const LEGAL_OWNER = {
  name: 'Cem Özdemir',
  street: 'Wildenbruchstr. 91',
  city: '12045 Berlin',
  country: 'Deutschland',
  email: 'support@formbeatsego.de'
}

export function legalAddressLines(owner = LEGAL_OWNER) {
  return [owner.name, owner.street, owner.city, owner.country].filter(Boolean)
}
