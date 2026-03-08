import axios from 'axios'
import { apiUrl } from './http'
import { handleAPIError } from './errorHandler'

const API_URL = apiUrl('subscription')
const api = axios.create({ baseURL: API_URL, timeout: 12000 })

function authConfig(token) {
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {}
}

export async function fetchSubscriptionStatus(token) {
  try {
    const res = await api.get('/status', authConfig(token))
    return res.data || {}
  } catch (error) {
    throw handleAPIError(error, 'Subscription laden', { showToast: false })
  }
}

export async function upgradeSubscriptionRequest(token, payload) {
  try {
    const res = await api.post('/upgrade', payload, authConfig(token))
    return res.data || {}
  } catch (error) {
    throw handleAPIError(error, 'Upgrade durchführen')
  }
}
