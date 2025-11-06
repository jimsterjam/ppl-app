/**
 * 🪵 Production-Safe Logger
 * 
 * @description Strukturiertes Logging-System das nur in Development Mode aktiv ist
 * @usage import { logger } from '@/utils/logger'
 *        logger.debug('User data loaded:', data)
 *        logger.error('API failed:', error)
 * 
 * In Production werden nur warn, error und critical geloggt.
 * Debug und Info werden komplett entfernt (Tree-shaking in Build).
 */

const isDev = import.meta.env.MODE === 'development'
const isProd = import.meta.env.MODE === 'production'

/**
 * Formatiert Timestamps für Logs
 */
const getTimestamp = () => {
  const now = new Date()
  return now.toISOString().split('T')[1].slice(0, -1) // HH:MM:SS.mmm
}

/**
 * Formatiert Log-Nachricht mit Kontext
 */
const formatMessage = (level, args) => {
  const timestamp = getTimestamp()
  const prefix = `[${timestamp}] [${level}]`
  return [prefix, ...args]
}

export const logger = {
  /**
   * Debug-Level Logging (nur Development)
   * Für detaillierte Informationen während der Entwicklung
   * 
   * @param {...any} args - Beliebige Log-Argumente
   * @example logger.debug('Component mounted with props:', props)
   */
  debug: (...args) => {
    if (isDev) {
      console.log('🔍', ...formatMessage('DEBUG', args))
    }
  },

  /**
   * Info-Level Logging (nur Development)
   * Für allgemeine Informationen
   * 
   * @param {...any} args - Beliebige Log-Argumente
   * @example logger.info('Data loaded successfully')
   */
  info: (...args) => {
    if (isDev) {
      console.log('ℹ️', ...formatMessage('INFO', args))
    }
  },

  /**
   * Warning-Level Logging (Development + Production)
   * Für potenzielle Probleme die keine Fehler sind
   * 
   * @param {...any} args - Beliebige Log-Argumente
   * @example logger.warn('API timeout, using cached data')
   */
  warn: (...args) => {
    console.warn('⚠️', ...formatMessage('WARN', args))
  },

  /**
   * Error-Level Logging (Development + Production)
   * Für behandelbare Fehler
   * 
   * @param {...any} args - Beliebige Log-Argumente
   * @example logger.error('Failed to load user data:', error)
   */
  error: (...args) => {
    console.error('❌', ...formatMessage('ERROR', args))
  },

  /**
   * Critical-Level Logging (Development + Production)
   * Für kritische Fehler die sofortige Aufmerksamkeit benötigen
   * In Production: Könnte an Error-Tracking-Service gesendet werden (z.B. Sentry)
   * 
   * @param {...any} args - Beliebige Log-Argumente
   * @example logger.critical('Database connection lost:', error)
   */
  critical: (...args) => {
    console.error('🚨', ...formatMessage('CRITICAL', args))
    
    // Optional: Send to error tracking service in production
    if (isProd) {
      // TODO: Integration mit Sentry, LogRocket, etc.
      // Sentry.captureException(new Error(args.join(' ')))
    }
  },

  /**
   * Gruppiert zusammenhängende Logs (nur Development)
   * 
   * @param {string} label - Gruppen-Label
   * @param {Function} fn - Funktion die Logs ausgibt
   * @example 
   * logger.group('API Call', () => {
   *   logger.debug('Request:', config)
   *   logger.debug('Response:', data)
   * })
   */
  group: (label, fn) => {
    if (isDev) {
      console.group(`📦 ${label}`)
      fn()
      console.groupEnd()
    }
  },

  /**
   * Misst Performance eines Code-Blocks (nur Development)
   * 
   * @param {string} label - Performance-Label
   * @param {Function} fn - Funktion die gemessen werden soll
   * @returns {any} Return-Wert der Funktion
   * @example
   * const result = logger.time('Data Processing', () => {
   *   return processData(data)
   * })
   */
  time: (label, fn) => {
    if (isDev) {
      console.time(`⏱️ ${label}`)
      const result = fn()
      console.timeEnd(`⏱️ ${label}`)
      return result
    }
    return fn()
  }
}

/**
 * Alias für häufige Verwendung
 */
export default logger
