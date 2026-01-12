/**
 * 🪵 Production-Safe Logger (Node.js Backend)
 * 
 * @description Strukturiertes Logging-System für Backend
 * @usage import { logger } from './utils/logger.js'
 *        logger.debug('Database query:', query)
 *        logger.error('API request failed:', error)
 * 
 * In Production werden nur warn, error und critical geloggt.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const isDev = process.env.NODE_ENV !== 'production'
const isProd = process.env.NODE_ENV === 'production'

// Optional file logging (enable with LOG_TO_FILE=1)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const logFilePath = path.join(__dirname, '..', 'server.log')
const logToFile = process.env.LOG_TO_FILE === '1' || false

function writeFileLog(level, args) {
  if (!logToFile) return
  try {
    const ts = getTimestamp()
    const message = args.map(a => {
      try { return typeof a === 'string' ? a : JSON.stringify(a) }
      catch { return String(a) }
    }).join(' ')
    const line = `[${ts}] [${level}] ${message}\n`
    fs.appendFile(logFilePath, line, () => {})
  } catch (e) {
    // never throw from the logger
  }
}

/**
 * ANSI Color Codes für Terminal-Ausgabe
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Farben
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  // Hintergründe
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m'
}

/**
 * Formatiert Timestamps
 */
const getTimestamp = () => {
  const now = new Date()
  return now.toISOString()
}

/**
 * Formatiert Log-Nachricht mit Farben
 */
const formatMessage = (level, color, args) => {
  const timestamp = getTimestamp()
  if (isDev) {
    return `${colors.dim}[${timestamp}]${colors.reset} ${color}[${level}]${colors.reset}`
  }
  return `[${timestamp}] [${level}]`
}

export const logger = {
  /**
   * Debug-Level Logging (nur Development)
   */
  debug: (...args) => {
    if (isDev) {
      console.log(formatMessage('DEBUG', colors.cyan, args), ...args)
      writeFileLog('DEBUG', args)
    }
  },

  /**
   * Info-Level Logging (nur Development)
   */
  info: (...args) => {
    if (isDev) {
      console.log(formatMessage('INFO', colors.blue, args), ...args)
      writeFileLog('INFO', args)
    }
  },

  /**
   * Warning-Level Logging (Development + Production)
   */
  warn: (...args) => {
    console.warn(formatMessage('WARN', colors.yellow, args), ...args)
    writeFileLog('WARN', args)
  },

  /**
   * Error-Level Logging (Development + Production)
   */
  error: (...args) => {
    console.error(formatMessage('ERROR', colors.red, args), ...args)
    writeFileLog('ERROR', args)
  },

  /**
   * Critical-Level Logging (Development + Production)
   * Für kritische Fehler die sofortige Aufmerksamkeit benötigen
   */
  critical: (...args) => {
    console.error(
      `${colors.bgRed}${colors.white}${colors.bright} CRITICAL ${colors.reset}`,
      formatMessage('CRITICAL', colors.red, args),
      ...args
    )
    
    // Optional: Send to error tracking service in production
    if (isProd) {
      // TODO: Integration mit Sentry, etc.
      // Sentry.captureException(new Error(args.join(' ')))
    }
    writeFileLog('CRITICAL', args)
  },

  /**
   * HTTP Request Logging (nur Development)
   * Spezialisiert für Express.js Middleware
   */
  http: (method, path, statusCode, duration) => {
    if (isDev) {
      const statusColor = statusCode >= 500 ? colors.red
        : statusCode >= 400 ? colors.yellow
        : statusCode >= 300 ? colors.cyan
        : colors.green
      
      console.log(
        formatMessage('HTTP', colors.magenta),
        `${colors.bright}${method}${colors.reset}`,
        path,
        `${statusColor}${statusCode}${colors.reset}`,
        `${colors.dim}${duration}ms${colors.reset}`
      )
    }
  },

  /**
   * Database Query Logging (nur Development)
   */
  db: (operation, collection, duration) => {
    if (isDev) {
      console.log(
        formatMessage('DB', colors.green),
        `${colors.bright}${operation}${colors.reset}`,
        `on ${collection}`,
        `${colors.dim}${duration}ms${colors.reset}`
      )
    }
  }
}

/**
 * Express.js Middleware für Request Logging
 */
export const requestLogger = (req, res, next) => {
  if (!isDev) return next()
  
  const start = Date.now()
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start
    logger.http(req.method, req.path, res.statusCode, duration)
  })
  
  next()
}

export default logger
