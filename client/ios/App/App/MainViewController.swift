import UIKit
import Capacitor
import WebKit

/// Hauptansicht der App. Registriert die eigenen Plugins RestAlarm (Wecker am Pausenende, AlarmKit) und TimerSound (Timer-Töne),
/// die nicht über npm/CocoaPods kommen. Wird in SceneDelegate.swift als rootViewController gesetzt.
class MainViewController: CAPBridgeViewController {
    /// Eindeutig pro App-Prozess: bleibt gleich, wenn iOS nur die Web-Ansicht im Hintergrund beendet und neu lädt,
    /// und ist neu, sobald die App komplett geschlossen und wieder geöffnet wurde. Die Seite liest ihn als
    /// window.__fbeLaunchId (siehe Start-Skript in index.html: Startanimation nur beim echten App-Start).
    private static let processLaunchId = UUID().uuidString

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(RestAlarmPlugin())
        // Timer-Töne direkt über iOS (TimerSoundPlugin.swift), unabhängig vom Web-Audio der Web-Ansicht
        bridge?.registerPluginInstance(TimerSoundPlugin())
        // Hier einspielen, nicht in webViewConfiguration(for:): Capacitor ersetzt danach den userContentController
        // der Konfiguration (CAPBridgeViewController.prepareWebView), dort hinzugefügte Skripte gingen verloren.
        // capacitorDidLoad() läuft in loadView(), also vor dem ersten Laden der Seite (viewDidLoad -> loadWebView).
        let script = WKUserScript(
            source: "window.__fbeLaunchId = '\(MainViewController.processLaunchId)';",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        webView?.configuration.userContentController.addUserScript(script)
    }
}
