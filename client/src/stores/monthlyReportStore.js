// Monatsberichte (Pro): Liste vom Server (api/reports.js). Das Dashboard zeigt eine Zeile nur bei
// einem neuen Bericht - solange noch keiner existiert (auch für Nicht-Pro), einen Beispielbericht
// (utils/sampleMonthlyReport.js).
import { defineStore } from 'pinia'
import { checkMonthlyReport, fetchMonthlyReport, listMonthlyReports, markMonthlyReportSeen } from '@/api/reports'
import { getAuthToken } from '@/utils/authToken'
import { isUnseen } from '@/utils/monthlyReportView'

// Der Server prüft bei jedem Aufruf nur günstig; trotzdem nicht bei jedem Dashboard-Besuch anfragen.
const MIN_REFRESH_INTERVAL_MS = 5 * 60 * 1000

let inFlight = null
// Zählt Kontowechsel: Antworten einer vor dem Wechsel gestarteten Anfrage gehören zum alten Konto und werden verworfen
// (auch die Nachfolge-Anfragen der Fälligkeitsprüfung).
let epoch = 0

export const useMonthlyReportStore = defineStore('monthlyReports', {
  state: () => ({
    reports: [],
    // Liste wurde mindestens einmal erfolgreich geladen (vorher weiß die App nicht, ob es Berichte gibt).
    loaded: false,
    // Die Liste konnte nicht geladen werden (offline, Server sagt "Pro erforderlich", Fehler): die Ansicht zeigt dann eine
    // ruhige Meldung statt endlos "Wird geladen". Verschwindet beim nächsten erfolgreichen Laden.
    failed: false,
    lastRefreshAt: 0,
    // Vollständige Berichte nach ID: ein Bericht ändert sich nicht, zweites Öffnen ohne Wartezeit.
    details: {}
  }),
  getters: {
    hasRealReport: (s) => s.reports.length > 0,
    latest: (s) => s.reports[0] || null,
    unseen() {
      return this.reports.find(isUnseen) || null
    }
  },
  actions: {
    /**
     * Fälligkeit prüfen (Server erzeugt den Bericht bei Bedarf) und Liste laden. Nur für Pro aufrufen.
     * @returns {Promise<boolean>} Liste geladen?
     */
    async refresh({ force = false } = {}) {
      if (inFlight) return inFlight
      if (!force && this.loaded && Date.now() - this.lastRefreshAt < MIN_REFRESH_INTERVAL_MS) return true
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        if (!this.loaded) this.failed = true
        return this.loaded
      }
      const myEpoch = epoch
      const request = (async () => {
        try {
          const token = await getAuthToken().catch(() => null)
          // Liste zuerst: bestehende Berichte erscheinen sofort. Die Fälligkeitsprüfung (mehrere
          // Datenbankabfragen) läuft danach und lädt die Liste nur neu, wenn sie einen Bericht erzeugt hat.
          const list = await listMonthlyReports(token)
          if (myEpoch !== epoch) return this.loaded // Konto gewechselt: Antwort gehört zum alten Konto
          if (list.status !== 'ok') {
            if (!this.loaded) this.failed = true
            return this.loaded
          }
          this.applyList(list)
          this.checkDue(token, myEpoch)
          return true
        } finally {
          // Nur die aktive Anfrage räumt auf: nach einem Kontowechsel läuft vielleicht schon die des neuen Kontos.
          if (inFlight === request) inFlight = null
        }
      })()
      inFlight = request
      return request
    },
    applyList(list) {
      this.reports = Array.isArray(list.data?.reports) ? list.data.reports : []
      this.loaded = true
      this.failed = false
      this.lastRefreshAt = Date.now()
    },
    async checkDue(token, myEpoch = epoch) {
      const check = await checkMonthlyReport(token)
      if (myEpoch !== epoch || check?.status !== 'ok' || !check.data?.created) return
      const list = await listMonthlyReports(token)
      if (myEpoch === epoch && list.status === 'ok') this.applyList(list)
    },
    /** Vollständigen Bericht holen (aus dem Speicher, wenn schon geladen). */
    async loadDetail(id) {
      if (this.details[id]) return { status: 'ok', data: this.details[id] }
      const myEpoch = epoch
      const token = await getAuthToken().catch(() => null)
      const res = await fetchMonthlyReport(token, id)
      if (res.status === 'ok' && myEpoch === epoch) this.details[id] = res.data
      return res
    },
    /** Bericht als gesehen merken (Dashboard-Zeile verschwindet). */
    async markSeen(id) {
      const report = this.reports.find((r) => r.id === id)
      if (!report || report.seenAt) return
      const myEpoch = epoch
      report.seenAt = new Date().toISOString()
      const token = await getAuthToken().catch(() => null)
      const res = await markMonthlyReportSeen(token, id)
      // Misslungen: beim nächsten Laden erscheint der Bericht wieder als neu - kein Datenverlust.
      if (myEpoch === epoch && res.status !== 'ok') report.seenAt = null
    },
    reset() {
      epoch += 1
      inFlight = null
      this.reports = []
      this.loaded = false
      this.failed = false
      this.lastRefreshAt = 0
      this.details = {}
    }
  }
})
