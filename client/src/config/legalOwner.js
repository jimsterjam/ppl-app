// Angaben zum Betreiber für Impressum und Datenschutzerklärung - EINZIGE Stelle, an der sie gepflegt werden.
// TODO (Paul): vor dem App-Store-Start Name und Anschrift eintragen (aktuell Platzhalter in eckigen Klammern).
export const LEGAL_OWNER = {
  name: 'Cem Özdemir',
  street: 'Wildenbruchstr. 91',
  city: '12045 Berlin',
  country: 'Deutschland',
  email: 'admin@push-pull-legs.de'
}

export function legalAddressLines(owner = LEGAL_OWNER) {
  return [owner.name, owner.street, owner.city, owner.country].filter(Boolean)
}
