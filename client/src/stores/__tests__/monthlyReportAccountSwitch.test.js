import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const api = vi.hoisted(() => ({
  listMonthlyReports: vi.fn(),
  checkMonthlyReport: vi.fn(),
  fetchMonthlyReport: vi.fn(),
  markMonthlyReportSeen: vi.fn()
}))
vi.mock('@/api/reports', () => api)
vi.mock('@/utils/authToken', () => ({ getAuthToken: vi.fn().mockResolvedValue('token') }))

import { useMonthlyReportStore } from '../monthlyReportStore.js'

const report = (id) => ({ id, periodStart: '2026-10-01T00:00:00.000Z', periodEnd: '2026-10-31T00:00:00.000Z', seenAt: null })
const tick = async (n = 4) => { for (let i = 0; i < n; i += 1) await Promise.resolve() }

beforeEach(() => {
  setActivePinia(createPinia())
  Object.values(api).forEach((fn) => fn.mockReset())
})

describe('Monatsberichte: Kontowechsel mit laufenden Anfragen', () => {
  it('die Liste des alten Kontos füllt den zurückgesetzten Speicher nicht mehr', async () => {
    const store = useMonthlyReportStore()
    let releaseList
    api.listMonthlyReports.mockImplementationOnce(() => new Promise((resolve) => { releaseList = resolve }))
    const pending = store.refresh({ force: true })
    await tick()
    store.reset() // Kontowechsel, während die Liste des alten Kontos noch geladen wird
    releaseList({ status: 'ok', data: { reports: [report('alt')] } })
    await pending
    expect(store.reports).toEqual([])
    expect(store.loaded).toBe(false)
    expect(api.checkMonthlyReport).not.toHaveBeenCalled()
  })

  it('auch die Nachfolge-Anfrage der Fälligkeitsprüfung wird verworfen', async () => {
    const store = useMonthlyReportStore()
    api.listMonthlyReports.mockResolvedValueOnce({ status: 'ok', data: { reports: [] } })
    let releaseCheck
    api.checkMonthlyReport.mockImplementationOnce(() => new Promise((resolve) => { releaseCheck = resolve }))
    await store.refresh({ force: true })
    await tick()
    store.reset()
    api.listMonthlyReports.mockResolvedValueOnce({ status: 'ok', data: { reports: [report('alt')] } })
    releaseCheck({ status: 'ok', data: { created: true } })
    await tick(8)
    expect(store.reports).toEqual([])
  })

  it('Berichtsdetails des alten Kontos werden nicht mehr gespeichert', async () => {
    const store = useMonthlyReportStore()
    let releaseDetail
    api.fetchMonthlyReport.mockImplementationOnce(() => new Promise((resolve) => { releaseDetail = resolve }))
    const pending = store.loadDetail('alt')
    await tick()
    store.reset()
    releaseDetail({ status: 'ok', data: { totals: { sessions: 12 } } })
    await pending
    expect(store.details).toEqual({})
  })

  it('eine neue Anfrage des neuen Kontos wird vom Ende der alten nicht ausgebremst', async () => {
    const store = useMonthlyReportStore()
    let releaseOld
    api.listMonthlyReports.mockImplementationOnce(() => new Promise((resolve) => { releaseOld = resolve }))
    const oldRefresh = store.refresh({ force: true })
    await tick()
    store.reset()
    api.listMonthlyReports.mockResolvedValueOnce({ status: 'ok', data: { reports: [report('neu')] } })
    api.checkMonthlyReport.mockResolvedValue({ status: 'ok', data: { created: false } })
    await store.refresh({ force: true }) // Konto B: darf nicht an die alte, noch offene Anfrage gehängt werden
    expect(store.reports.map((r) => r.id)).toEqual(['neu'])
    releaseOld({ status: 'ok', data: { reports: [report('alt')] } })
    await oldRefresh
    expect(store.reports.map((r) => r.id)).toEqual(['neu'])
  })
})
