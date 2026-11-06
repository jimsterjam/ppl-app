// Einstellungen gehören zum Konto, nicht zum Gerät (Absprache Paul 06.11.2026): Meldet sich ein zweiter Nutzer auf
// demselben Gerät an, übernimmt er keine Einstellungen des ersten (Farbmodus, Sprache, Pausenzeiten ...).
//
// Schlüssel im localStorage: `<name>:<UID>`. Ohne angemeldeten Nutzer (Willkommens-/Anmeldeseite) wird nichts
// gespeichert; Änderungen gelten nur im Arbeitsspeicher und werden vom Konto übernommen, das sich als Nächstes
// anmeldet UND für diesen Wert noch nichts Eigenes hat (die Wahl traf die Person, die sich gerade anmeldet).
//
// Die UID des angemeldeten Kontos merkt sich das Gerät (ACTIVE_UID_KEY), damit die Einstellungen beim App-Start
// sofort passen und nichts aufblitzt, bevor Firebase die Anmeldung meldet. Beim Abmelden wird sie gelöscht.

export const ACTIVE_UID_KEY = 'ppl_active_uid_v1'
export const MIGRATION_FLAG_KEY = 'ppl_user_prefs_migrated_v1'

// Frühere, geräteweite Schlüssel (vor dieser Änderung). Werden einmalig dem ersten angemeldeten Konto übergeben
// und danach gelöscht.
export const LEGACY_PREF_KEYS = Object.freeze([
  'theme',
  'theme-accent',
  'app-lang',
  'weekly-goal',
  'keep-awake-mode',
  'ppl_rest_timer_sound_v1',
  'ppl_rest_timer_durations_v1',
  'ppl_warmup_durations_v1',
  'timer_settings_v1',
  'ppl_notification_hint_dismissed_v1'
])

const memory = new Map()
let activeUid = ''

function lsGet(key) {
  try { return localStorage.getItem(key) } catch { return null }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, value); return true } catch { return false }
}
function lsRemove(key) {
  try { localStorage.removeItem(key) } catch {}
}

const clean = (uid) => String(uid || '').trim()

// Beim Laden des Moduls: gemerktes Konto übernehmen.
activeUid = clean(lsGet(ACTIVE_UID_KEY))

export const scopedKey = (base, uid) => `${base}:${uid}`
export const getActiveUid = () => activeUid

/**
 * Aktives Konto setzen (beim Anmelden) bzw. leeren (beim Abmelden).
 * Beim Anmelden: einmalige Übernahme der alten geräteweiten Werte und Übernahme von Wahlen aus der Zeit ohne Konto.
 * @returns {{ uid: string, changed: boolean }}
 */
export function setActiveUid(uid) {
  const next = clean(uid)
  const changed = next !== activeUid
  activeUid = next
  if (!next) {
    lsRemove(ACTIVE_UID_KEY)
    return { uid: '', changed }
  }
  lsSet(ACTIVE_UID_KEY, next)
  migrateLegacyPrefs(next)
  adoptMemoryPrefs(next)
  return { uid: next, changed }
}

/** Alte geräteweite Werte einmalig an das erste angemeldete Konto übergeben, danach löschen. */
export function migrateLegacyPrefs(uid) {
  const owner = clean(uid)
  if (!owner || lsGet(MIGRATION_FLAG_KEY)) return false
  for (const base of LEGACY_PREF_KEYS) {
    const legacy = lsGet(base)
    if (legacy == null) continue
    if (lsGet(scopedKey(base, owner)) == null) lsSet(scopedKey(base, owner), legacy)
    lsRemove(base)
  }
  lsSet(MIGRATION_FLAG_KEY, '1')
  return true
}

function adoptMemoryPrefs(uid) {
  for (const [base, value] of memory) {
    if (lsGet(scopedKey(base, uid)) == null) lsSet(scopedKey(base, uid), value)
  }
  memory.clear()
}

/** Wert des aktiven Kontos (oder einer angegebenen UID); null = nichts gespeichert / kein Konto. */
export function readPref(base, uid = activeUid) {
  const owner = clean(uid)
  if (!owner) return memory.has(base) ? memory.get(base) : null
  return lsGet(scopedKey(base, owner))
}

/** Wert speichern. Ohne Konto nur im Arbeitsspeicher (siehe Kopfkommentar). */
export function writePref(base, value, uid = activeUid) {
  const owner = clean(uid)
  const text = String(value)
  if (!owner) { memory.set(base, text); return true }
  return lsSet(scopedKey(base, owner), text)
}

export function removePref(base, uid = activeUid) {
  const owner = clean(uid)
  if (!owner) { memory.delete(base); return }
  lsRemove(scopedKey(base, owner))
}

/**
 * Gehört ein gespeicherter Zustand/Eintrag (mit Feld `uid`) zum angemeldeten Konto? Einträge ohne `uid` stammen aus der Zeit
 * vor dieser Änderung und zählen für das aktive Konto (sie sind kurzlebig bzw. der Server prüft die Konto-ID ohnehin).
 */
export function belongsToActiveAccount(record) {
  const owner = record?.uid
  return owner === undefined || owner === null || String(owner) === activeUid
}

/** Nur für Tests. */
export function __resetUserScopedStorageForTests() {
  memory.clear()
  activeUid = ''
}
