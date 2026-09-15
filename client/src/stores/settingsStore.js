import { defineStore } from 'pinia'
import { fetchAccountProfile, updateAccountProfile, updatePersonalData } from '@/api/account'
import { logger } from '@/utils/logger'

// Default-Objekt für personalData - 'unspecified' statt leerem String, damit direkt der
// gültige Enum-Wert des Backends verwendet wird (siehe UserProfile.js personalData.gender).
function emptyPersonalData() {
  return { ageYears: null, gender: 'unspecified', heightCm: null, weightKg: null }
}

const PROFILE_REQUEST_COOLDOWN_MS = 15000
let profileLoadPromise = null
let profileLoadPromiseToken = ''
let profileCooldownUntil = 0

function isTransientRequestError(error) {
  const statusCode = Number(error?.statusCode || error?.response?.status || error?.context?.originalError?.response?.status || 0)
  const code = String(error?.code || error?.context?.originalError?.code || '')
  return statusCode === 0 || [502, 503, 504].includes(statusCode) || code === 'ECONNABORTED' || code === 'ERR_NETWORK'
}

// Erstellt einen UID-spezifischen localStorage-Schlüssel.
// Ohne UID → generischer Schlüssel (nur als Fallback/Migration).
function pKey(uid, base) {
  return uid ? `${base}:${uid}` : base
}

function lsGet(uid, base) {
  try { return localStorage.getItem(pKey(uid, base)) || '' } catch { return '' }
}

function lsSet(uid, base, value) {
  try {
    if (value) localStorage.setItem(pKey(uid, base), value)
    else localStorage.removeItem(pKey(uid, base))
  } catch {}
}

// Bug-Fix (User-Report "Onboarding ausgefüllt, aber in den Einstellungen leer"): savePersonalData()
// wird direkt nach Onboarding-Abschluss aufgerufen - genau der Moment, in dem ein frisch
// registrierter Firebase-Nutzer noch kein zuverlässig verfügbares ID-Token hat bzw. die
// Verbindung noch nicht steht. Schlug der PUT-Request bisher fehl (oder lag noch gar kein Token
// vor), ging die Eingabe komplett verloren: der lokale State (nicht gecacht, siehe State-
// Kommentar unten) wurde beim nächsten loadProfile()-Aufruf (Settings-Screen) durch den -
// weiterhin leeren - Server-Stand überschrieben. Diese kleine, dedizierte Pending-Queue (gleiches
// Muster wie pendingAiFeedback.js) merkt sich einen fehlgeschlagenen Speicherversuch lokal und
// wird beim nächsten App-Start/Login (main.js) automatisch nachgeholt.
const PENDING_PERSONAL_DATA_BASE = 'pending-personal-data'

function lsGetJSON(uid, base) {
  try {
    const raw = localStorage.getItem(pKey(uid, base))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function lsSetJSON(uid, base, value) {
  try {
    if (value == null) localStorage.removeItem(pKey(uid, base))
    else localStorage.setItem(pKey(uid, base), JSON.stringify(value))
  } catch {}
}

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    // Geräte-Einstellungen – keine UID-Bindung
    language: (() => {
      try { return localStorage.getItem('app-lang') || null } catch { return null }
    })(),
    weeklyGoal: (() => {
      const envDefault = Number.parseInt(import.meta.env.VITE_DEFAULT_WEEKLY_GOAL || '', 10)
      const fallback = Number.isFinite(envDefault) && envDefault > 0 ? envDefault : 4
      const stored = Number.parseInt((typeof localStorage !== 'undefined' && localStorage.getItem('weekly-goal')) || '', 10)
      return Number.isFinite(stored) && stored > 0 ? stored : fallback
    })(),
    // Account-spezifisch – werden erst nach switchUser(uid) geladen.
    // Beim Start leer, damit kein Account-fremdes Bild aufblitzt.
    _uid: '',
    username: '',
    avatarUrl: '',
    avatarData: '',
    // Freiwillige persönliche Angaben (Alter/Geschlecht/Größe/Gewicht) - bewusst NICHT in
    // localStorage gecacht wie username/avatarUrl (sensiblere Daten als ein Anzeigename) -
    // wird ausschließlich über loadProfile() vom Server geladen, geht also bei jedem
    // App-Neustart zunächst auf den Default zurück, bis loadProfile() einmal durchgelaufen ist.
    personalData: emptyPersonalData(),
  }),
  actions: {
    // Muss aus main.js nach jedem Firebase-onAuthStateChanged aufgerufen werden.
    // Trennt die localStorage-Slots sauber pro Account-UID.
    switchUser(uid) {
      const newUid = String(uid || '').trim()
      if (this._uid === newUid) return

      this._uid = newUid

      if (!newUid) {
        // Abgemeldet: in-memory leeren, kein cross-account leak
        this.username = ''
        this.avatarUrl = ''
        this.avatarData = ''
        this.personalData = emptyPersonalData()
        profileCooldownUntil = 0
        profileLoadPromise = null
        profileLoadPromiseToken = ''
        return
      }

      // Einmalige Migration: Daten aus alten generischen Schlüsseln übernehmen,
      // falls für diese UID noch keine UID-spezifischen Einträge existieren.
      for (const base of ['app-username', 'app-avatar-url', 'app-avatar-data']) {
        try {
          const generic = localStorage.getItem(base)
          const specific = localStorage.getItem(pKey(newUid, base))
          if (generic && !specific) {
            localStorage.setItem(pKey(newUid, base), generic)
            localStorage.removeItem(base)
          }
        } catch {}
      }

      // Account-Daten aus UID-Slot laden
      this.username = lsGet(newUid, 'app-username')
      this.avatarUrl = lsGet(newUid, 'app-avatar-url')
      this.avatarData = lsGet(newUid, 'app-avatar-data')
      // Kein lokaler Cache für personalData (siehe State-Kommentar oben) - auf Default
      // zurücksetzen, bis loadProfile() die Daten des neuen Accounts vom Server geladen hat,
      // damit nicht kurzzeitig die Angaben des vorherigen Accounts sichtbar sind. Eine noch
      // nicht erfolgreich gespeicherte Eingabe (siehe PENDING_PERSONAL_DATA_BASE oben) wird
      // trotzdem sofort optimistisch übernommen, damit sie z.B. direkt nach dem Onboarding nicht
      // kurz "leer" aussieht, bevor main.js flushPendingPersonalData() nachgeholt hat.
      const pending = lsGetJSON(newUid, PENDING_PERSONAL_DATA_BASE)
      this.personalData = pending ? { ...emptyPersonalData(), ...pending } : emptyPersonalData()

      // Cooldown zurücksetzen für neuen Account
      profileCooldownUntil = 0
      profileLoadPromise = null
      profileLoadPromiseToken = ''
    },

    async loadProfile(token, options = {}) {
      if (!token) {
        return {
          username: this.username || '',
          avatarUrl: this.avatarUrl || ''
        }
      }

      const force = options?.force === true
      const tokenKey = String(token).slice(-16)

      if (profileLoadPromise && profileLoadPromiseToken === tokenKey) {
        return profileLoadPromise
      }

      if (!force && profileCooldownUntil > Date.now()) {
        return {
          username: this.username || '',
          avatarUrl: this.avatarUrl || ''
        }
      }

      profileLoadPromiseToken = tokenKey
      profileLoadPromise = (async () => {
        try {
          const profile = await fetchAccountProfile(token)
          const username = String(profile?.username ?? '').trim().slice(0, 24)
          const avatarUrl = String(profile?.avatarUrl ?? '').trim()
          this.username = username
          this.avatarUrl = avatarUrl
          if (profile?.personalData) {
            this.personalData = { ...emptyPersonalData(), ...profile.personalData }
          }
          // Eine noch nicht erfolgreich übertragene lokale Eingabe (siehe savePersonalData/
          // flushPendingPersonalData) ist NEUER als dieser Server-Stand - überschreibt ihn
          // deshalb hier bewusst wieder, statt dass ein frisch geladenes (noch leeres)
          // Server-Profil eine wartende Eingabe fälschlich wie "verworfen" aussehen lässt.
          const pendingPersonalData = lsGetJSON(this._uid, PENDING_PERSONAL_DATA_BASE)
          if (pendingPersonalData) {
            this.personalData = { ...emptyPersonalData(), ...pendingPersonalData }
          }
          profileCooldownUntil = 0
          lsSet(this._uid, 'app-username', username)
          lsSet(this._uid, 'app-avatar-url', avatarUrl)
          return profile
        } catch (error) {
          if (isTransientRequestError(error)) {
            profileCooldownUntil = Date.now() + PROFILE_REQUEST_COOLDOWN_MS
          }
          logger.warn('⚠️ [settingsStore] loadProfile fallback to cached local values:', {
            message: error?.message,
            statusCode: error?.statusCode || 0,
            code: error?.context?.originalError?.code || null
          })
          return {
            username: this.username || '',
            avatarUrl: this.avatarUrl || ''
          }
        }
      })().finally(() => {
        profileLoadPromise = null
        profileLoadPromiseToken = ''
      })

      return profileLoadPromise
    },

    async saveUsername(token, name) {
      const clean = String(name ?? '').trim().slice(0, 24)
      this.username = clean
      lsSet(this._uid, 'app-username', clean)

      if (!token) return { username: clean }
      const updated = await updateAccountProfile(token, { username: clean })
      const serverName = String(updated?.username ?? clean).trim().slice(0, 24)
      this.username = serverName
      lsSet(this._uid, 'app-username', serverName)
      return updated
    },

    // Speichert nur die tatsächlich übergebenen Felder (partial update) - siehe PUT
    // /profile/personal-data: ein Feld, das im payload fehlt (undefined), bleibt server-seitig
    // unverändert; null/'' löscht ein Feld bewusst (Nutzer hat es geleert).
    //
    // Robustheit (User-Report "Onboarding ausgefüllt, aber in den Einstellungen leer"): schlägt
    // der Request fehl (z.B. kein/abgelaufenes Token direkt nach frischer Registrierung, oder
    // Netzwerkfehler), geht die Eingabe NICHT mehr verloren - sie landet in der lokalen
    // Pending-Queue und wird beim nächsten App-Start/Login automatisch nachgeholt (siehe
    // flushPendingPersonalData, aufgerufen aus main.js). Der Fehler wird trotzdem weitergereicht,
    // damit ein Aufruf aus den Einstellungen (mit sichtbarem Speichern-Button) weiterhin eine
    // Fehlermeldung zeigen kann.
    async savePersonalData(token, payload) {
      this.personalData = { ...this.personalData, ...payload }
      if (!token) {
        lsSetJSON(this._uid, PENDING_PERSONAL_DATA_BASE, this.personalData)
        return { personalData: this.personalData }
      }
      try {
        const updated = await updatePersonalData(token, payload)
        if (updated?.personalData) {
          this.personalData = { ...emptyPersonalData(), ...updated.personalData }
        }
        // Erfolgreich übertragen - eine evtl. noch offene ältere Pending-Eingabe ist damit
        // hinfällig (der gerade erfolgreiche Request enthält den aktuellsten Stand).
        lsSetJSON(this._uid, PENDING_PERSONAL_DATA_BASE, null)
        return updated
      } catch (error) {
        lsSetJSON(this._uid, PENDING_PERSONAL_DATA_BASE, this.personalData)
        logger.warn('⚠️ [settingsStore] savePersonalData fehlgeschlagen, für späteren Retry gequeued:', error?.message)
        throw error
      }
    },

    // Wird aus main.js einmal pro Login/App-Start aufgerufen (analog processPendingAiFeedback) -
    // holt eine wegen fehlendem Token/Netzwerkfehler zuvor fehlgeschlagene savePersonalData()-
    // Eingabe nach. Kein-Op, wenn nichts aussteht.
    async flushPendingPersonalData(token) {
      const pending = lsGetJSON(this._uid, PENDING_PERSONAL_DATA_BASE)
      if (!pending || !token) return
      try {
        const updated = await updatePersonalData(token, pending)
        if (updated?.personalData) {
          this.personalData = { ...emptyPersonalData(), ...updated.personalData }
        }
        lsSetJSON(this._uid, PENDING_PERSONAL_DATA_BASE, null)
        logger.debug('✅ [settingsStore] flushPendingPersonalData erfolgreich nachgeholt')
      } catch (error) {
        logger.warn('⚠️ [settingsStore] flushPendingPersonalData fehlgeschlagen, versuche es beim nächsten Start erneut:', error?.message)
      }
    },

    setAvatarUrl(url) {
      const clean = String(url ?? '').trim()
      this.avatarUrl = clean
      lsSet(this._uid, 'app-avatar-url', clean)
      // Gecachten DataURL löschen wenn Avatar zurückgesetzt wird
      if (!clean) {
        this.avatarData = ''
        lsSet(this._uid, 'app-avatar-data', '')
      }
    },

    setAvatarData(dataUrl) {
      const clean = String(dataUrl ?? '').trim()
      this.avatarData = clean
      lsSet(this._uid, 'app-avatar-data', clean)
    },

    // Backwards-compat: keep old call sites working
    setUsername(name) {
      const clean = String(name ?? '').trim().slice(0, 24)
      this.username = clean
      lsSet(this._uid, 'app-username', clean)
    },
    setLanguage(locale) {
      this.language = locale
      try { localStorage.setItem('app-lang', locale) } catch {}
    },
    setWeeklyGoal(val) {
      const v = Number.parseInt(val, 10)
      // Clamp auf sinnvollen Bereich
      const clamped = Number.isFinite(v) ? Math.max(1, Math.min(14, v)) : 4
      this.weeklyGoal = clamped
      try {
        localStorage.setItem('weekly-goal', String(clamped))
      } catch {}
    }
  }
})
