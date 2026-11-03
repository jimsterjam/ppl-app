// Anzeigename eines Plans. Ein Plan aus einer Vorlage speichert beim Anlegen den Vorlagennamen in der damaligen App-
// Sprache ("Push/Pull/Legs · 3 Tage"). Nach einem Sprachwechsel soll er in der aktuellen Sprache erscheinen, aber nur,
// solange der Nutzer den Namen nicht selbst geändert hat: ein eigener Name bleibt immer unverändert.

/**
 * @param {{ name?: string, templateId?: string }} plan
 * @param {(key: string, params?: object, options?: object) => string} t - vue-i18n `t`
 * @returns {string}
 */
export function planDisplayName(plan, t) {
  const stored = String(plan?.name ?? '')
  const templateId = plan?.templateId
  if (!templateId || typeof t !== 'function') return stored
  const key = `plans.templates.${templateId}.name`
  const known = ['de', 'en'].map((locale) => t(key, {}, { locale }))
  // Fehlt der Schlüssel, liefert vue-i18n den Schlüssel selbst zurück: dann den gespeicherten Namen behalten.
  if (known.some((name) => name === key) || !known.includes(stored)) return stored
  return t(key)
}
