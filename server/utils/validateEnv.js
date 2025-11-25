/**
 * 🔒 Environment Variable Validation
 * 
 * @description Validiert kritische Umgebungsvariablen beim Server-Start
 * @usage import { validateEnv } from './utils/validateEnv.js'
 *        validateEnv() // Wirft Error bei fehlenden Required-Vars
 * 
 * Beendet den Server mit exit(1) wenn kritische Variablen fehlen.
 */

import { logger } from './logger.js'

/**
 * Kritische Umgebungsvariablen die zwingend gesetzt sein müssen
 */
const REQUIRED_VARS = [
  {
    name: 'MONGO_URI',
    description: 'MongoDB Connection String',
    example: 'mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/DATABASE'
  },
  
  // Clerk-Variablen entfernt
]

/**
 * Optionale Variablen (Fallbacks vorhanden)
 */
const OPTIONAL_VARS = [
  {
    name: 'OPENAI_API_KEY',
    description: 'OpenAI API Key für AI Workout Coach',
    fallback: 'Demo-Modus mit statischen Übungen',
    example: 'sk-proj-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
  },
  // Clerk-Variablen entfernt
  {
    name: 'PORT',
    description: 'Server Port',
    fallback: '3001',
    example: '3001'
  },
  {
    name: 'NODE_ENV',
    description: 'Environment Mode',
    fallback: 'development',
    example: 'production'
  }
]

/**
 * Validiert ob eine Variable gesetzt ist
 */
const isSet = (varName) => {
  const value = process.env[varName]
  return value && value.trim().length > 0
}

/**
 * Validiert Format von spezifischen Variablen
 */
const validateFormat = (varName, value) => {
  switch (varName) {
    case 'MONGO_URI':
      if (!value.startsWith('mongodb://') && !value.startsWith('mongodb+srv://')) {
        return 'Muss mit mongodb:// oder mongodb+srv:// beginnen'
      }
      break
    
    // Clerk-Variablen entfernt
    
    case 'OPENAI_API_KEY':
      if (!value.startsWith('sk-')) {
        return 'Muss mit sk- beginnen'
      }
      break
    
    case 'PORT':
      const port = parseInt(value)
      if (isNaN(port) || port < 1 || port > 65535) {
        return 'Muss eine Zahl zwischen 1 und 65535 sein'
      }
      break
  }
  
  return null // Valid
}

/**
 * Hauptvalidierungs-Funktion
 * Wirft Error oder beendet Prozess bei fehlenden kritischen Variablen
 */
export const validateEnv = () => {
  logger.info('🔍 Validiere Umgebungsvariablen...')
  
  const errors = []
  const warnings = []
  
  // 1. Prüfe kritische Variablen
  for (const varInfo of REQUIRED_VARS) {
    const { name, description, example } = varInfo
    
    if (!isSet(name)) {
      errors.push({
        var: name,
        reason: 'Nicht gesetzt',
        description,
        example
      })
    } else {
      // Prüfe Format
      const formatError = validateFormat(name, process.env[name])
      if (formatError) {
        errors.push({
          var: name,
          reason: formatError,
          description,
          example
        })
      }
    }
  }
  
  // 2. Prüfe optionale Variablen
  for (const varInfo of OPTIONAL_VARS) {
    const { name, description, fallback } = varInfo
    
    if (!isSet(name)) {
      warnings.push({
        var: name,
        fallback,
        description
      })
    } else {
      // Prüfe Format (nur Warning bei Fehlern)
      const formatError = validateFormat(name, process.env[name])
      if (formatError) {
        warnings.push({
          var: name,
          reason: formatError,
          current: process.env[name].substring(0, 20) + '...'
        })
      }
    }
  }
  
  // 3. Ausgabe und Fehlerbehandlung
  if (errors.length > 0) {
    logger.critical('🔴 Kritische Umgebungsvariablen fehlen oder sind ungültig:')
    logger.critical('')
    
    for (const error of errors) {
      logger.critical(`❌ ${error.var}`)
      logger.critical(`   Grund: ${error.reason}`)
      logger.critical(`   Beschreibung: ${error.description}`)
      logger.critical(`   Beispiel: ${error.example}`)
      logger.critical('')
    }
    
    logger.critical('💡 Lösung: Erstelle/aktualisiere .env Datei im server/ Verzeichnis')
    logger.critical('')
    
    process.exit(1)
  }
  
  // 4. Warnungen für optionale Variablen
  if (warnings.length > 0) {
    logger.warn('⚠️  Optionale Umgebungsvariablen nicht gesetzt (Fallbacks aktiv):')
    logger.warn('')
    
    for (const warning of warnings) {
      logger.warn(`⚡ ${warning.var}`)
      if (warning.fallback) {
        logger.warn(`   Fallback: ${warning.fallback}`)
      }
      if (warning.reason) {
        logger.warn(`   Problem: ${warning.reason}`)
        logger.warn(`   Aktuell: ${warning.current}`)
      }
      logger.warn('')
    }
  }
  
  // 5. Erfolg
  logger.info('✅ Umgebungsvariablen validiert')
  logger.info(`   Environment: ${process.env.NODE_ENV || 'development'}`)
  logger.info(`   Port: ${process.env.PORT || '3001'}`)
  logger.info(`   Database: ${process.env.MONGO_URI ? '✅ Konfiguriert' : '❌ Fehlt'}`)
  // Clerk-Status entfernt
  logger.info(`   AI: ${process.env.OPENAI_API_KEY ? '✅ OpenAI' : '⚠️  Demo-Modus'}`)
  logger.info('')
}

/**
 * Gibt alle gesetzten ENV-Variablen aus (nur Development)
 * Sensitive Werte werden maskiert
 */
export const logEnvVariables = () => {
  if (process.env.NODE_ENV === 'production') return
  
  const maskSensitive = (key, value) => {
    const sensitiveKeys = ['KEY', 'SECRET', 'PASSWORD', 'TOKEN', 'URI']
    if (sensitiveKeys.some(k => key.includes(k))) {
      return value.substring(0, 8) + '...' + value.substring(value.length - 4)
    }
    return value
  }
  
  logger.debug('📋 Environment Variables:')
  Object.keys(process.env)
    .filter(key => key.startsWith('MONGO') || key.startsWith('OPENAI') || key === 'NODE_ENV' || key === 'PORT')
    .forEach(key => {
      logger.debug(`   ${key}: ${maskSensitive(key, process.env[key] || '')}`)
    })
  logger.debug('')
}

export default validateEnv
