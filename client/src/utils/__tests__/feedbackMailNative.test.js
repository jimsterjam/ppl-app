import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Der Öffnungsweg hängt an zwei Annahmen, die hier abgesichert werden: @capacitor/app 7 hat keine openUrl-Methode,
// und Capacitor reicht Navigationen auf fremde URLs (mailto:) an iOS weiter.
const clientDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

describe('Feedback-Mail: native Voraussetzungen', () => {
  it('@capacitor/app bietet kein openUrl (deshalb nicht verwenden)', () => {
    const defs = readFileSync(resolve(clientDir, 'node_modules/@capacitor/app/dist/esm/definitions.d.ts'), 'utf8')
    expect(defs).not.toMatch(/openUrl\s*\(/)
    expect(readFileSync(resolve(clientDir, 'src/utils/feedbackMail.js'), 'utf8')).not.toMatch(/\.openUrl\(/)
  })

  it('Capacitor öffnet fremde Top-Level-Navigationen über UIApplication.open', () => {
    const handler = readFileSync(
      resolve(clientDir, 'node_modules/@capacitor/ios/Capacitor/Capacitor/WebViewDelegationHandler.swift'),
      'utf8'
    )
    expect(handler).toContain('UIApplication.shared.open(navURL')
    expect(handler).toContain('toplevelNavigation')
  })
})
