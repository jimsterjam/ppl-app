// Katalogübungen mit fester Messart "Zeit" (Halteübungen wie Planche, Front Lever, L-Sit).
// Der Quick-Generator schlägt Sätze als "Wdh. × kg" vor; für reine Halteübungen wäre das
// sinnlos, daher kommen sie dort nicht in den Katalog-Pool (Absprache 24.11.).
export function isTimedCatalogEntry(entry) {
  const mode = entry && typeof entry === 'object' ? entry.measureMode : null;
  return mode === 'time' || mode === 'repsTime';
}
