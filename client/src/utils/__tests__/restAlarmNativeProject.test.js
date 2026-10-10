import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Swift lässt sich in der Cloud-Session nicht kompilieren. Diese Tests sichern wenigstens die
// Verdrahtung ab, an der ein Tippfehler den Wecker still abschalten würde (Plugin-Name, Methoden,
// Registrierung, Xcode-Projekt, Info.plist-Text).
const iosDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../ios/App')
const read = (rel) => readFileSync(resolve(iosDir, rel), 'utf8')
const jsBridge = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../restAlarm.js'), 'utf8')

describe('RestAlarm-Plugin: Verdrahtung', () => {
  const plugin = read('App/RestAlarmPlugin.swift')

  it('JS-Name und Methoden stimmen mit der JS-Brücke überein', () => {
    expect(plugin).toContain('public let jsName = "RestAlarm"')
    expect(jsBridge).toContain("registerPlugin('RestAlarm')")
    for (const method of ['isAvailable', 'schedule', 'cancel']) {
      expect(plugin).toContain(`CAPPluginMethod(name: "${method}", returnType: CAPPluginReturnPromise)`)
      expect(plugin).toContain(`@objc func ${method}(_ call: CAPPluginCall)`)
    }
    expect(jsBridge).toContain('RestAlarm.schedule(')
    expect(jsBridge).toContain('RestAlarm.cancel(')
  })

  it('AlarmKit nur unter iOS 26 und nur wenn das SDK es kennt (Build bleibt auf älteren SDKs heil)', () => {
    expect(plugin).toContain('#if canImport(AlarmKit)')
    expect(plugin).toContain('#available(iOS 26.0, *)')
    expect(plugin).toContain('@available(iOS 26.0, *)')
  })

  it('Plugin wird beim Start registriert: MainViewController als Hauptansicht', () => {
    expect(read('App/MainViewController.swift')).toContain('registerPluginInstance(RestAlarmPlugin())')
    expect(read('App/SceneDelegate.swift')).toContain('rootViewController = MainViewController()')
  })

  it('Info.plist hat den Erlaubnis-Text für AlarmKit', () => {
    const plist = read('App/Info.plist')
    expect(plist).toMatch(/<key>NSAlarmKitUsageDescription<\/key>\s*<string>[^<]{20,}<\/string>/)
  })

  it('beide Swift-Dateien sind im Xcode-Projekt: Dateiliste, Gruppe "App", Sources-Phase', () => {
    const pbx = read('App.xcodeproj/project.pbxproj')
    for (const file of ['RestAlarmPlugin.swift', 'MainViewController.swift']) {
      const ref = pbx.match(new RegExp(`([0-9A-F]{24}) /\\* ${file} \\*/ = \\{isa = PBXFileReference;[^}]*path = ${file};`))
      const build = pbx.match(new RegExp(`([0-9A-F]{24}) /\\* ${file} in Sources \\*/ = \\{isa = PBXBuildFile; fileRef = ([0-9A-F]{24})`))
      expect(ref, `${file}: PBXFileReference`).not.toBeNull()
      expect(build, `${file}: PBXBuildFile`).not.toBeNull()
      expect(build[2]).toBe(ref[1])
      expect(pbx.split(`${ref[1]} /* ${file} */,`).length, `${file}: in Gruppe`).toBe(2)
      expect(pbx.split(`${build[1]} /* ${file} in Sources */,`).length, `${file}: in Sources-Phase`).toBe(2)
    }
  })
})
