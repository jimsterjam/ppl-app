import { createResourceApi } from './http'
import { handleAPIError } from './errorHandler'
import { logger } from '@/utils/logger'

const PROFILE_TIMEOUT_MS = Number.parseInt(import.meta.env.VITE_PROFILE_TIMEOUT_MS || '', 10) || 25000
const PROFILE_RETRY_DELAY_MS = Number.parseInt(import.meta.env.VITE_PROFILE_RETRY_DELAY_MS || '', 10) || 1000
const api = createResourceApi('account', { timeout: PROFILE_TIMEOUT_MS })

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isLikelyTransportError(error) {
  const code = String(error?.code || '').toUpperCase()
  return code === 'ERR_NETWORK' || code === 'ECONNABORTED' || !error?.response
}

function authConfig(token) {
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {}
}

export async function fetchAccountProfile(token) {
  try {
    const res = await api.get('/profile', authConfig(token))
    return res.data || {}
  } catch (error) {
    if (isLikelyTransportError(error)) {
      try {
        await sleep(PROFILE_RETRY_DELAY_MS)
        const retryRes = await api.get('/profile', authConfig(token))
        return retryRes.data || {}
      } catch (retryError) {
        if (isLikelyTransportError(retryError)) {
          logger.warn('📡 Account API - Profil Netzwerk/Transportproblem, nutze lokalen Fallback', {
            code: retryError?.code || null,
            status: retryError?.response?.status || null
          })
          return {}
        }
        throw handleAPIError(retryError, 'Profil laden')
      }
    }

    throw handleAPIError(error, 'Profil laden')
  }
}

export async function updateAccountProfile(token, payload) {
  try {
    const res = await api.put('/profile', payload, authConfig(token))
    return res.data || {}
  } catch (error) {
    throw handleAPIError(error, 'Profil speichern')
  }
}

export async function uploadProfileAvatar(token, file) {
  try {
    const form = new FormData()
    form.append('image', file)
    const res = await api.post('/profile/avatar', form, authConfig(token))
    return res.data || {}
  } catch (error) {
    throw handleAPIError(error, 'Profilbild hochladen')
  }
}

export async function addCoach(token, payload) {
  try {
    const res = await api.post('/coach/add', payload, authConfig(token))
    return res.data || {}
  } catch (error) {
    throw handleAPIError(error, 'Coach hinzufügen')
  }
}

export async function createCoachInvite(token, payload) {
  try {
    const res = await api.post('/coach/invite', payload, authConfig(token))
    return res.data || {}
  } catch (error) {
    throw handleAPIError(error, 'Coach einladen')
  }
}

export async function listOutgoingCoachInvites(token) {
  try {
    const res = await api.get('/coach/invites/outgoing', authConfig(token))
    return Array.isArray(res.data) ? res.data : []
  } catch (error) {
    throw handleAPIError(error, 'Einladungen laden')
  }
}

export async function listIncomingCoachInvites(token) {
  try {
    const res = await api.get('/coach/invites/incoming', authConfig(token))
    return Array.isArray(res.data) ? res.data : []
  } catch (error) {
    throw handleAPIError(error, 'Einladungen laden')
  }
}

export async function acceptCoachInvite(token, inviteId) {
  try {
    const res = await api.post(`/coach/invites/${encodeURIComponent(inviteId)}/accept`, {}, authConfig(token))
    return res.data || {}
  } catch (error) {
    throw handleAPIError(error, 'Einladung annehmen')
  }
}

export async function cancelCoachInvite(token, inviteId) {
  try {
    const res = await api.post(`/coach/invites/${encodeURIComponent(inviteId)}/cancel`, {}, authConfig(token))
    return res.data || {}
  } catch (error) {
    throw handleAPIError(error, 'Einladung stornieren')
  }
}

export async function revokeCoachAccess(token, payload) {
  try {
    const res = await api.post('/coach/revoke', payload, authConfig(token))
    return res.data || {}
  } catch (error) {
    throw handleAPIError(error, 'Coach entfernen')
  }
}

export async function listActiveCoaches(token) {
  try {
    const res = await api.get('/coach/active', authConfig(token))
    return Array.isArray(res.data) ? res.data : []
  } catch (error) {
    throw handleAPIError(error, 'Coaches laden')
  }
}

export async function listCoachClients(token) {
  try {
    const res = await api.get('/coach/clients', authConfig(token))
    return Array.isArray(res.data) ? res.data : []
  } catch (error) {
    throw handleAPIError(error, 'Clients laden')
  }
}

export async function fetchClientWorkouts(token, clientUid) {
  try {
    const res = await api.get(`/coach/clients/${encodeURIComponent(clientUid)}/workouts`, authConfig(token))
    return Array.isArray(res.data) ? res.data : (res.data?.workouts || [])
  } catch (error) {
    throw handleAPIError(error, 'Client-Workouts laden')
  }
}

// Client: Chat/Feedback zu einem eigenen Workout
export async function listWorkoutChat(token, workoutId, limit = 100) {
  try {
    const res = await api.get(
      `/workouts/${encodeURIComponent(workoutId)}/chat?limit=${encodeURIComponent(limit)}`,
      authConfig(token)
    )
    return Array.isArray(res.data) ? res.data : []
  } catch (error) {
    throw handleAPIError(error, 'Chat laden')
  }
}

export async function sendWorkoutChatMessage(token, workoutId, text) {
  try {
    const res = await api.post(
      `/workouts/${encodeURIComponent(workoutId)}/chat`,
      { text },
      authConfig(token)
    )
    return res.data || {}
  } catch (error) {
    throw handleAPIError(error, 'Nachricht senden')
  }
}

export async function listWorkoutChatThreads(token, limit = 30) {
  try {
    const res = await api.get(`/workouts/chat/threads?limit=${encodeURIComponent(limit)}`, authConfig(token))
    return Array.isArray(res.data) ? res.data : []
  } catch (error) {
    throw handleAPIError(error, 'Feedback laden')
  }
}

export async function fetchClientWorkoutDetail(token, clientUid, workoutId) {
  try {
    const res = await api.get(
      `/coach/clients/${encodeURIComponent(clientUid)}/workouts/${encodeURIComponent(workoutId)}`,
      authConfig(token)
    )
    return res.data || {}
  } catch (error) {
    throw handleAPIError(error, 'Workout-Details laden')
  }
}

export async function listCoachWorkoutChat(token, clientUid, workoutId, limit = 100) {
  try {
    const res = await api.get(
      `/coach/clients/${encodeURIComponent(clientUid)}/workouts/${encodeURIComponent(workoutId)}/chat?limit=${encodeURIComponent(limit)}`,
      authConfig(token)
    )
    return Array.isArray(res.data) ? res.data : []
  } catch (error) {
    throw handleAPIError(error, 'Chat laden')
  }
}

export async function sendCoachWorkoutChatMessage(token, clientUid, workoutId, text) {
  try {
    const res = await api.post(
      `/coach/clients/${encodeURIComponent(clientUid)}/workouts/${encodeURIComponent(workoutId)}/chat`,
      { text },
      authConfig(token)
    )
    return res.data || {}
  } catch (error) {
    throw handleAPIError(error, 'Nachricht senden')
  }
}
