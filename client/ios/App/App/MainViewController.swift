import UIKit
import Capacitor
import WebKit

/// Hauptansicht der App. Registriert das eigene Plugin RestAlarm (Wecker am Pausenende, AlarmKit),
/// das nicht über npm/CocoaPods kommt. Wird in SceneDelegate.swift als rootViewController gesetzt.
class MainViewController: CAPBridgeViewController {
    /// Eindeutig pro App-Prozess: bleibt gleich, wenn iOS nur die Web-Ansicht im Hintergrund beendet und neu lädt,
    /// und ist neu, sobald die App komplett geschlossen und wieder geöffnet wurde. Die Seite liest ihn als
    /// window.__fbeLaunchId (siehe Start-Skript in index.html: Startanimation nur beim echten App-Start).
    private static let processLaunchId = UUID().uuidString

    override open func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let configuration = super.webViewConfiguration(for: instanceConfiguration)
        let script = WKUserScript(
            source: "window.__fbeLaunchId = '\(MainViewController.processLaunchId)';",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        configuration.userContentController.addUserScript(script)
        return configuration
    }

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(RestAlarmPlugin())
    }
}
