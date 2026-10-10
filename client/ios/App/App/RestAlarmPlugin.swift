import Foundation
import Capacitor
#if canImport(AlarmKit)
import AlarmKit
import SwiftUI
#endif

/// Wecker für das Ende der Satzpause (AlarmKit, iOS 26+).
///
/// Klingelt wie der Wecker der Uhr-App - auch bei Stumm-Schalter, Fokus und gesperrtem Bildschirm.
/// Normale Mitteilungen werden dort von iOS unterdrückt (Tester-Meldung 09./10.10.).
///
/// JS-Seite: client/src/utils/restAlarm.js (jsName "RestAlarm"). Registrierung: MainViewController.swift.
/// Es gibt immer höchstens EINEN Pausen-Wecker; seine ID liegt in UserDefaults, damit er auch nach
/// einem App-Neustart noch abgebrochen werden kann.
///
/// HINWEIS: Geschrieben ohne Xcode (Cloud-Session) nach Anleitungen zu AlarmKit, nicht kompiliert und nicht auf
/// einem Gerät getestet. Die AlarmKit-Aufrufe in scheduleAlarm() (AlarmPresentation.Alert, AlarmButton,
/// AlarmAttributes, AlarmConfiguration, schedule/cancel) können sich je nach SDK-Stand in Namen oder
/// Parametern unterscheiden - bei einer Fehlermeldung im Xcode-Build genau dort nachziehen.
///
/// Alle Methoden antworten mit resolve (nie reject): Klappt etwas nicht, steht `scheduled: false` und
/// ein `reason` im Ergebnis - die App fällt dann auf die normale Mitteilung zurück.
@objc(RestAlarmPlugin)
public class RestAlarmPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RestAlarmPlugin"
    public let jsName = "RestAlarm"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "schedule", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise)
    ]

    private let storedIdKey = "rest_alarm_id_v1"

    private var storedId: UUID? {
        get {
            guard let raw = UserDefaults.standard.string(forKey: storedIdKey) else { return nil }
            return UUID(uuidString: raw)
        }
        set {
            if let value = newValue {
                UserDefaults.standard.set(value.uuidString, forKey: storedIdKey)
            } else {
                UserDefaults.standard.removeObject(forKey: storedIdKey)
            }
        }
    }

    /// { available: Bool, authorization: "unavailable" | "notDetermined" | "authorized" | "denied" }
    @objc func isAvailable(_ call: CAPPluginCall) {
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            call.resolve(["available": true, "authorization": authorizationName()])
            return
        }
        #endif
        call.resolve(["available": false, "authorization": "unavailable"])
    }

    /// Parameter: at (Millisekunden seit 1970), title, stopLabel, sound (optional, Dateiname im App-Paket).
    /// Ergebnis: { scheduled: Bool, reason?: String, message?: String }
    @objc func schedule(_ call: CAPPluginCall) {
        guard let atMs = call.getDouble("at") else {
            call.resolve(["scheduled": false, "reason": "invalid-arguments"])
            return
        }
        let title = call.getString("title") ?? "Pause vorbei"
        let stopLabel = call.getString("stopLabel") ?? "Stopp"
        let sound = call.getString("sound")
        let fireDate = Date(timeIntervalSince1970: atMs / 1000.0)

        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            Task {
                do {
                    try await self.scheduleAlarm(at: fireDate, title: title, stopLabel: stopLabel, sound: sound)
                    call.resolve(["scheduled": true])
                } catch let failure as RestAlarmFailure {
                    call.resolve(["scheduled": false, "reason": failure.reason])
                } catch {
                    call.resolve(["scheduled": false, "reason": "error", "message": error.localizedDescription])
                }
            }
            return
        }
        #endif
        call.resolve(["scheduled": false, "reason": "unavailable"])
    }

    /// Bricht den Pausen-Wecker ab (kein Fehler, wenn keiner existiert oder er schon geklingelt hat).
    @objc func cancel(_ call: CAPPluginCall) {
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            cancelStoredAlarm()
        }
        #endif
        call.resolve()
    }

    // MARK: - AlarmKit (iOS 26+)

    #if canImport(AlarmKit)

    private struct RestAlarmFailure: Error {
        let reason: String
    }

    @available(iOS 26.0, *)
    private func authorizationName() -> String {
        switch AlarmManager.shared.authorizationState {
        case .notDetermined: return "notDetermined"
        case .authorized: return "authorized"
        case .denied: return "denied"
        @unknown default: return "denied"
        }
    }

    @available(iOS 26.0, *)
    private func cancelStoredAlarm() {
        guard let id = storedId else { return }
        try? AlarmManager.shared.cancel(id: id)
        storedId = nil
    }

    @available(iOS 26.0, *)
    private func scheduleAlarm(at date: Date, title: String, stopLabel: String, sound: String?) async throws {
        let manager = AlarmManager.shared

        // Erlaubnis: beim ersten Mal fragt iOS den Nutzer (Text: NSAlarmKitUsageDescription in Info.plist).
        switch manager.authorizationState {
        case .authorized:
            break
        case .notDetermined:
            let state = try await manager.requestAuthorization()
            if state != .authorized { throw RestAlarmFailure(reason: "denied") }
        default:
            throw RestAlarmFailure(reason: "denied")
        }

        // Vorherigen Pausen-Wecker ersetzen (z.B. Pause verlängert).
        cancelStoredAlarm()

        let stopButton = AlarmButton(
            text: LocalizedStringResource(stringLiteral: stopLabel),
            textColor: .white,
            systemImageName: "stop.circle"
        )
        let alert = AlarmPresentation.Alert(
            title: LocalizedStringResource(stringLiteral: title),
            stopButton: stopButton
        )
        let attributes = AlarmAttributes<RestAlarmMetadata>(
            presentation: AlarmPresentation(alert: alert),
            metadata: RestAlarmMetadata(),
            tintColor: Color.orange
        )

        // Feste Weckzeit (Alarm.Schedule.fixed), einmalig. Eigener Ton aus dem App-Paket (rest-end.wav).
        let configuration: AlarmManager.AlarmConfiguration<RestAlarmMetadata>
        if let sound = sound, !sound.isEmpty {
            configuration = AlarmManager.AlarmConfiguration(schedule: .fixed(date), attributes: attributes, sound: .named(sound))
        } else {
            configuration = AlarmManager.AlarmConfiguration(schedule: .fixed(date), attributes: attributes)
        }

        let id = UUID()
        _ = try await manager.schedule(id: id, configuration: configuration)
        storedId = id
    }

    #endif
}

#if canImport(AlarmKit)
/// Leere Zusatzdaten - die Pause braucht keine eigenen Daten am Wecker.
@available(iOS 26.0, *)
struct RestAlarmMetadata: AlarmMetadata {}
#endif
