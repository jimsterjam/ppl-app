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

beforeEach(() => {
  setActivePinia(createPinia())
  Object.values(api).forEach((fn) => fn.mockReset())
  api.checkMonthlyReport.mockResolvedValue({ status: 'ok', data: { created: false } })
})

describe('Monatsberichte: Liste nicht ladbar', () => {
  it.each(['locked', 'error', 'rate_limited'])('Status %s: failed statt endlos zu laden', async (status) => {
    const store = useMonthlyReportStore()
    api.listMonthlyReports.mockResolvedValueOnce({ status })
    await store.refresh({ force: true })
    expect(store.loaded).toBe(false)
    expect(store.failed).toBe(true)
  })

  it('ein späterer erfolgreicher Abruf nimmt die Fehlermeldung zurück', async () => {
    const store = useMonthlyReportStore()
    api.listMonthlyReports.mockResolvedValueOnce({ status: 'error' })
    await store.refresh({ force: true })
    expect(store.failed).toBe(true)
    api.listMonthlyReports.mockResolvedValueOnce({ status: 'ok', data: { reports: [] } })
    await store.refresh({ force: true })
    expect(store.failed).toBe(false)
    expect(store.loaded).toBe(true)
  })

  it('schon geladene Berichte bleiben bei einem späteren Fehler erhalten', async () => {
    const store = useMonthlyReportStore()
    api.listMonthlyReports.mockResolvedValueOnce({ status: 'ok', data: { reports: [{ id: 'a', periodStart: '2026-10-01', periodEnd: '2026-10-31' }] } })
    await store.refresh({ force: true })
    api.listMonthlyReports.mockResolvedValueOnce({ status: 'error' })
    await store.refresh({ force: true })
    expect(store.failed).toBe(false)
    expect(store.reports).toHaveLength(1)
  })

  it('Kontowechsel setzt die Fehlermeldung zurück', async () => {
    const store = useMonthlyReportStore()
    api.listMonthlyReports.mockResolvedValueOnce({ status: 'locked' })
    await store.refresh({ force: true })
    store.reset()
    expect(store.failed).toBe(false)
  })
})
