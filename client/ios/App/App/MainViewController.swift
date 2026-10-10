import UIKit
import Capacitor

/// Hauptansicht der App. Registriert das eigene Plugin RestAlarm (Wecker am Pausenende, AlarmKit),
/// das nicht über npm/CocoaPods kommt. Wird in SceneDelegate.swift als rootViewController gesetzt.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(RestAlarmPlugin())
    }
}
