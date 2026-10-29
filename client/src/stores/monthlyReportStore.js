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

export const useMonthlyReportStore = defineStore('monthlyReports', {
  state: () => ({
    reports: [],
    // Liste wurde mindestens einmal erfolgreich geladen (vorher weiß die App nicht, ob es Berichte gibt).
    loaded: false,
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
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return this.loaded
      inFlight = (async () => {
        try {
          const token = await getAuthToken().catch(() => null)
          // Liste zuerst: bestehende Berichte erscheinen sofort. Die Fälligkeitsprüfung (mehrere
          // Datenbankabfragen) läuft danach und lädt die Liste nur neu, wenn sie einen Bericht erzeugt hat.
          const list = await listMonthlyReports(token)
          if (list.status !== 'ok') return this.loaded
          this.applyList(list)
          this.checkDue(token)
          return true
        } finally {
          inFlight = null
        }
      })()
      return inFlight
    },
    applyList(list) {
      this.reports = Array.isArray(list.data?.reports) ? list.data.reports : []
      this.loaded = true
      this.lastRefreshAt = Date.now()
    },
    async checkDue(token) {
      const check = await checkMonthlyReport(token)
      if (check?.status !== 'ok' || !check.data?.created) return
      const list = await listMonthlyReports(token)
      if (list.status === 'ok') this.applyList(list)
    },
    /** Vollständigen Bericht holen (aus dem Speicher, wenn schon geladen). */
    async loadDetail(id) {
      if (this.details[id]) return { status: 'ok', data: this.details[id] }
      const token = await getAuthToken().catch(() => null)
      const res = await fetchMonthlyReport(token, id)
      if (res.status === 'ok') this.details[id] = res.data
      return res
    },
    /** Bericht als gesehen merken (Dashboard-Zeile verschwindet). */
    async markSeen(id) {
      const report = this.reports.find((r) => r.id === id)
      if (!report || report.seenAt) return
      report.seenAt = new Date().toISOString()
      const token = await getAuthToken().catch(() => null)
      const res = await markMonthlyReportSeen(token, id)
      // Misslungen: beim nächsten Laden erscheint der Bericht wieder als neu - kein Datenverlust.
      if (res.status !== 'ok') report.seenAt = null
    },
    reset() {
      this.reports = []
      this.loaded = false
      this.lastRefreshAt = 0
      this.details = {}
    }
  }
})
