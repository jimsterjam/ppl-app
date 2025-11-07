/**
 * 🛡️ Zentralisiertes API Error Handling
 * 
 * @description Einheitliche Fehlerbehandlung für alle API-Calls
 * @usage import { handleAPIError, APIError } from '@/api/errorHandler'
 *        
 *        try {
 *          const response = await axios.get('/api/workouts')
 *          return response.data
 *        } catch (error) {
 *          throw handleAPIError(error, 'Workouts laden')
 *        }
 * 
 * Bietet:
 * - Konsistente Error-Messages für User
 * - Status-Code-spezifische Behandlung (401, 429, 500, etc.)
 * - Automatisches Logging
 * - Integration mit Toast-Notifications (optional)
 */

import { logger } from '@/utils/logger'
import router from '@/router'

/**
 * Custom API Error Klasse mit zusätzlichem Context
 */
export class APIError extends Error {
  constructor(message, statusCode = 0, context = {}) {
    super(message)
    this.name = 'APIError'
    this.statusCode = statusCode
    this.context = context
    this.timestamp = new Date().toISOString()
    
    // Für besseren Stack Trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, APIError)
    }
  }

  /**
   * User-freundliche Nachricht
   */
  getUserMessage() {
    return this.message
  }

  /**
   * Ist der Fehler wiederholbar (retry)?
   */
  isRetryable() {
    return [429, 503, 504].includes(this.statusCode)
  }

  /**
   * Sollte der User eingeloggt sein?
   */
  requiresAuth() {
    return this.statusCode === 401
  }
}

/**
 * HTTP Status Code zu User-freundlicher Nachricht
 */
const STATUS_MESSAGES = {
  // Client Errors (4xx)
  400: 'Ungültige Anfrage. Bitte prüfe deine Eingaben.',
  401: 'Du bist nicht angemeldet. Bitte melde dich an.',
  403: 'Zugriff verweigert. Du hast keine Berechtigung für diese Aktion.',
  404: 'Die angeforderten Daten wurden nicht gefunden.',
  409: 'Konflikt: Diese Aktion kann nicht durchgeführt werden.',
  422: 'Die Daten konnten nicht verarbeitet werden.',
  429: 'Zu viele Anfragen. Bitte warte einen Moment.',
  
  // Server Errors (5xx)
  500: 'Ein Server-Fehler ist aufgetreten. Bitte versuche es später erneut.',
  502: 'Server temporär nicht erreichbar. Bitte versuche es später erneut.',
  503: 'Service temporär nicht verfügbar. Bitte versuche es später erneut.',
  504: 'Server-Timeout. Bitte versuche es später erneut.',
}

/**
 * Extrahiert Error-Message aus verschiedenen Error-Formaten
 */
const extractErrorMessage = (error) => {
  // Axios Error Response Format
  if (error.response?.data?.message) {
    return error.response.data.message
  }
  
  if (error.response?.data?.error) {
    return error.response.data.error
  }
  
  // Standard Error Message
  if (error.message) {
    return error.message
  }
  
  return 'Ein unbekannter Fehler ist aufgetreten.'
}

/**
 * Hauptfunktion: Behandelt API Errors einheitlich
 * 
 * @param {Error} error - Der gefangene Fehler
 * @param {string} context - Kontext-Information (z.B. "Workout laden", "Übung speichern")
 * @param {Object} options - Zusätzliche Optionen
 * @param {boolean} options.showToast - Zeige Toast Notification (default: true)
 * @param {boolean} options.redirectOnAuth - Redirect zu Login bei 401 (default: true)
 * @param {Function} options.onError - Custom Error Handler
 * @returns {APIError} - Wirft APIError
 */
export const handleAPIError = (error, context = '', options = {}) => {
  const {
    showToast = true,
    redirectOnAuth = true,
    onError = null
  } = options
  
  logger.error(`API Error [${context}]:`, error)
  
  // 1. Server hat mit Error-Status geantwortet (4xx, 5xx)
  if (error.response) {
    const { status, data } = error.response
    const serverMessage = extractErrorMessage(error)
    const userMessage = STATUS_MESSAGES[status] || serverMessage
    
    logger.debug(`Status ${status}: ${serverMessage}`)
    
    // Status-spezifische Behandlung
    switch (status) {
      case 401:
        // Nicht authentifiziert - Redirect zu Login
        if (redirectOnAuth) {
          logger.warn('Nicht authentifiziert - Redirect zu /')
          router.push('/')
        }
        throw new APIError(
          'Du musst angemeldet sein, um diese Aktion durchzuführen.',
          401,
          { context, originalError: error }
        )
        
      case 403:
        // Keine Berechtigung
        throw new APIError(
          'Du hast keine Berechtigung für diese Aktion.',
          403,
          { context, originalError: error }
        )
        
      case 404:
        // Nicht gefunden
        throw new APIError(
          data?.message || 'Die angeforderten Daten wurden nicht gefunden.',
          404,
          { context, originalError: error }
        )
        
      case 409:
        // Konflikt (z.B. Duplikat)
        throw new APIError(
          serverMessage,
          409,
          { context, originalError: error }
        )
        
      case 422:
        // Validierungsfehler
        throw new APIError(
          serverMessage,
          422,
          { context, originalError: error, validationErrors: data?.errors }
        )
        
      case 429:
        // Rate Limit
        throw new APIError(
          'Zu viele Anfragen. Bitte warte einen Moment und versuche es erneut.',
          429,
          { context, originalError: error, retryAfter: data?.retryAfter }
        )
        
      case 500:
      case 502:
      case 503:
      case 504:
        // Server Errors
        throw new APIError(
          userMessage,
          status,
          { context, originalError: error, retryable: true }
        )
        
      default:
        // Unbekannter Status Code
        throw new APIError(
          userMessage,
          status,
          { context, originalError: error }
        )
    }
  }
  
  // 2. Request wurde gesendet, aber keine Antwort erhalten (Network Error)
  if (error.request) {
    logger.error(`Network Error [${context}]:`, error)
    throw new APIError(
      'Netzwerkfehler: Keine Verbindung zum Server. Prüfe deine Internetverbindung.',
      0,
      { context, originalError: error, type: 'network' }
    )
  }
  
  // 3. Fehler beim Erstellen des Requests (Programming Error)
  logger.error(`Request Setup Error [${context}]:`, error)
  throw new APIError(
    'Ein unerwarteter Fehler ist aufgetreten.',
    0,
    { context, originalError: error, type: 'setup' }
  )
}

/**
 * Wrapper für API-Calls mit automatischem Error Handling
 * 
 * @param {Function} apiCall - Die API-Funktion die ausgeführt werden soll
 * @param {string} context - Kontext-Information
 * @param {Object} options - Error Handler Optionen
 * @returns {Promise} - Promise mit den Daten oder APIError
 * 
 * @example
 * const workouts = await withErrorHandling(
 *   () => axios.get('/api/workouts'),
 *   'Workouts laden'
 * )
 */
export const withErrorHandling = async (apiCall, context, options = {}) => {
  try {
    const response = await apiCall()
    return response.data
  } catch (error) {
    throw handleAPIError(error, context, options)
  }
}

/**
 * Retry Logic für fehlgeschlagene Requests
 * 
 * @param {Function} apiCall - Die API-Funktion
 * @param {Object} options - Retry Optionen
 * @returns {Promise}
 * 
 * @example
 * const data = await retryRequest(
 *   () => axios.get('/api/workouts'),
 *   { maxRetries: 3, delay: 1000 }
 * )
 */
export const retryRequest = async (apiCall, options = {}) => {
  const {
    maxRetries = 3,
    delay = 1000,
    backoff = 2,
    context = 'API Request'
  } = options
  
  let lastError
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.debug(`Attempt ${attempt}/${maxRetries}: ${context}`)
      return await apiCall()
    } catch (error) {
      lastError = error
      
      // Prüfe ob Retry sinnvoll ist
      if (error instanceof APIError && !error.isRetryable()) {
        throw error
      }
      
      // Letzter Versuch - werfe Error
      if (attempt === maxRetries) {
        logger.error(`Max retries reached for ${context}`)
        throw error
      }
      
      // Warte vor nächstem Versuch (exponential backoff)
      const waitTime = delay * Math.pow(backoff, attempt - 1)
      logger.debug(`Waiting ${waitTime}ms before retry...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
  }
  
  throw lastError
}

export default {
  APIError,
  handleAPIError,
  withErrorHandling,
  retryRequest
}
