// Angaben zum Betreiber für Impressum und Datenschutzerklärung - EINZIGE Stelle, an der sie gepflegt werden.
// TODO (Paul): vor dem App-Store-Start Name und Anschrift eintragen (aktuell Platzhalter in eckigen Klammern).
export const LEGAL_OWNER = {
  name: '[Vor- und Nachname eintragen]',
  street: '[Straße und Hausnummer eintragen]',
  city: '[PLZ und Ort eintragen]',
  country: 'Deutschland',
  email: 'kontakt@bro-split-app.de'
}

export function legalAddressLines(owner = LEGAL_OWNER) {
  return [owner.name, owner.street, owner.city, owner.country].filter(Boolean)
}
