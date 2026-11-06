// Capacitor-Plugins sind Proxys: jeder Zugriff auf eine unbekannte Eigenschaft liefert eine Plugin-Methode, und der
// Abruf von `.then` wirft auf iOS "<Plugin>.then() is not implemented on ios". Das passiert, sobald ein Plugin aus
// einer async-Funktion zurückgegeben oder mit `await` verarbeitet wird, denn Promises prüfen, ob das Ergebnis ein
// "thenable" ist. Darum Plugins in einem einfachen Objekt weiterreichen und erst beim Aufrufer herausnehmen.
export function wrapPlugin(plugin) {
  return { plugin: plugin || null }
}
