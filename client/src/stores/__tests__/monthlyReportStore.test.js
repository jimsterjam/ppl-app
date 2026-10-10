import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const api = vi.hoisted(() => ({
  checkMonthlyReport: vi.fn(),
  listMonthlyReports: vi.fn(),
  markMonthlyReportSeen: vi.fn()
}))
vi.mock('@/api/reports', () => api)
vi.mock('@/utils/authToken', () => ({ getAuthToken: vi.fn().mockResolvedValue('token') }))

import { useMonthlyReportStore } from '../monthlyReportStore.js'

const report = (id, seenAt = null) => ({ id, periodStart: '2026-09-12T00:00:00Z', periodEnd: '2026-10-09T00:00:00Z', seenAt })

describe('monthlyReportStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('navigator', { onLine: true })
    Object.values(api).forEach((fn) => fn.mockReset())
    api.checkMonthlyReport.mockResolvedValue({ status: 'ok', data: { created: false } })
  })

  it('refresh: prüft die Fälligkeit und lädt die Liste', async () => {
    api.listMonthlyReports.mockResolvedValue({ status: 'ok', data: { reports: [report('a'), report('b', '2026-09-01T00:00:00Z')] } })
    const store = useMonthlyReportStore()
    expect(store.loaded).toBe(false)
    await store.refresh()
    expect(api.checkMonthlyReport).toHaveBeenCalledWith('token')
    expect(store.loaded).toBe(true)
    expect(store.hasRealReport).toBe(true)
    expect(store.unseen.id).toBe('a')
  })

  it('ohne Berichte: geladen, aber kein echter Bericht (dann gilt der Beispielbericht)', async () => {
    api.listMonthlyReports.mockResolvedValue({ status: 'ok', data: { reports: [] } })
    const store = useMonthlyReportStore()
    await store.refresh()
    expect(store.loaded).toBe(true)
    expect(store.hasRealReport).toBe(false)
    expect(store.unseen).toBeNull()
  })

  it('Fehler beim Laden: nicht als geladen markieren (kein Beispiel-Aufblitzen, nächster Versuch möglich)', async () => {
    api.listMonthlyReports.mockResolvedValue({ status: 'error' })
    const store = useMonthlyReportStore()
    expect(await store.refresh()).toBe(false)
    expect(store.loaded).toBe(false)
  })

  it('nicht bei jedem Aufruf neu anfragen, mit force schon', async () => {
    api.listMonthlyReports.mockResolvedValue({ status: 'ok', data: { reports: [] } })
    const store = useMonthlyReportStore()
    await store.refresh()
    await store.refresh()
    expect(api.listMonthlyReports).toHaveBeenCalledTimes(1)
    await store.refresh({ force: true })
    expect(api.listMonthlyReports).toHaveBeenCalledTimes(2)
  })

  it('gleichzeitige Aufrufe teilen sich eine Anfrage', async () => {
    api.listMonthlyReports.mockResolvedValue({ status: 'ok', data: { reports: [] } })
    const store = useMonthlyReportStore()
    await Promise.all([store.refresh({ force: true }), store.refresh({ force: true })])
    expect(api.listMonthlyReports).toHaveBeenCalledTimes(1)
  })

  it('offline: keine Anfrage', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    const store = useMonthlyReportStore()
    expect(await store.refresh({ force: true })).toBe(false)
    expect(api.checkMonthlyReport).not.toHaveBeenCalled()
  })

  it('markSeen: sofort lokal gesehen; schlägt der Server fehl, wieder "neu"', async () => {
    api.listMonthlyReports.mockResolvedValue({ status: 'ok', data: { reports: [report('a')] } })
    const store = useMonthlyReportStore()
    await store.refresh()
    api.markMonthlyReportSeen.mockResolvedValue({ status: 'ok', data: { ok: true } })
    await store.markSeen('a')
    expect(store.unseen).toBeNull()
    expect(api.markMonthlyReportSeen).toHaveBeenCalledWith('token', 'a')

    store.reports[0].seenAt = null
    api.markMonthlyReportSeen.mockResolvedValue({ status: 'error' })
    await store.markSeen('a')
    expect(store.unseen.id).toBe('a')
  })

  it('reset leert alles (Nutzerwechsel)', async () => {
    api.listMonthlyReports.mockResolvedValue({ status: 'ok', data: { reports: [report('a')] } })
    const store = useMonthlyReportStore()
    await store.refresh()
    store.reset()
    expect(store.reports).toEqual([])
    expect(store.loaded).toBe(false)
  })
})
