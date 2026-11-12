import Foundation
import Capacitor
import AVFoundation
import UIKit

/// Timer-Töne (Pausen-Gong, 3-2-1, Vorwarnung, Intervall-Timer) direkt über iOS statt über Web Audio.
///
/// Warum (Meldung 12.11.): Web Audio in der Web-Ansicht wird von iOS nach Hintergrund, Anruf, Musik anderer Apps oder
/// Bluetooth-Wechsel angehalten und darf erst nach einer Berührung wieder starten. Auf manchen Geräten blieb der Gong
/// deshalb stumm oder kam gesammelt beim Zurückkehren in die App. AVAudioPlayer braucht keine Berührung.
///
/// JS-Seite: client/src/utils/nativeTimerSound.js (jsName "TimerSound"). Registrierung: MainViewController.swift.
/// Tondateien: timer-*.wav im App-Paket (erzeugt von client/scripts/generate-timer-sounds.mjs).
///
/// - play(file): sofort spielen.
/// - schedule(cues: [{ key, file, at }]): ersetzt alle geplanten Töne; at = Millisekunden seit 1970. iOS spielt sie
///   zeitgenau (AVAudioPlayer.play(atTime:)), auch wenn die Web-Ansicht gerade hängt.
/// - cancel(): alle geplanten Töne verwerfen.
/// - getVolume(): { volume: 0...1 } Medienlautstärke; Ereignis "volume" bei Änderung.
///
/// Verspätet wird nie gespielt: Geht die App in den Hintergrund oder unterbricht iOS den Ton (Anruf), werden die
/// geplanten Spieler gestoppt; beim Zurückkehren werden nur noch Töne geplant, deren Zeit noch nicht vorbei ist
/// (Toleranz lateTolerance). Im Hintergrund melden sich Wecker bzw. Mitteilung (RestAlarmPlugin / restEndSignal.js).
///
/// HINWEIS: Geschrieben ohne Xcode (Cloud-Session), nicht kompiliert und nicht auf einem Gerät getestet.
/// Alle Methoden antworten mit resolve (nie reject).
@objc(TimerSoundPlugin)
public class TimerSoundPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TimerSoundPlugin"
    public let jsName = "TimerSound"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "play", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "schedule", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getVolume", returnType: CAPPluginReturnPromise)
    ]

    private struct Cue {
        let key: String
        let file: String
        let at: Date
    }

    /// Geplante Töne (bleiben über Hintergrund/Unterbrechung erhalten, um danach künftige neu zu planen).
    private var cues: [Cue] = []
    /// Spieler der aktuell bei iOS eingeplanten Töne.
    private var armed: [AVAudioPlayer] = []
    /// Sofort gespielte Töne (Referenz halten, sonst bricht iOS die Wiedergabe ab).
    private var oneShots: [AVAudioPlayer] = []
    private var soundData: [String: Data] = [:]
    private var volumeObservation: NSKeyValueObservation?
    private var inForeground = true
    /// So viel darf ein Ton zu spät sein, damit er noch gespielt wird (danach: verwerfen).
    private let lateTolerance: TimeInterval = 0.4

    override public func load() {
        let center = NotificationCenter.default
        center.addObserver(self, selector: #selector(didEnterBackground), name: UIApplication.didEnterBackgroundNotification, object: nil)
        center.addObserver(self, selector: #selector(willEnterForeground), name: UIApplication.willEnterForegroundNotification, object: nil)
        center.addObserver(self, selector: #selector(audioInterrupted(_:)), name: AVAudioSession.interruptionNotification, object: nil)
        center.addObserver(self, selector: #selector(mediaServicesReset), name: AVAudioSession.mediaServicesWereResetNotification, object: nil)
        // Kopfhörer/Bluetooth verbunden oder getrennt: eingeplante Spieler hängen am alten Ausgang - neu einplanen
        center.addObserver(self, selector: #selector(routeChanged), name: AVAudioSession.routeChangeNotification, object: nil)
        volumeObservation = AVAudioSession.sharedInstance().observe(\.outputVolume, options: [.new]) { [weak self] session, _ in
            self?.notifyListeners("volume", data: ["volume": session.outputVolume])
        }
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
        volumeObservation?.invalidate()
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": true])
    }

    @objc func play(_ call: CAPPluginCall) {
        guard let file = call.getString("file") else {
            call.resolve(["played": false, "reason": "invalid-arguments"])
            return
        }
        DispatchQueue.main.async {
            guard self.inForeground else {
                call.resolve(["played": false, "reason": "background"])
                return
            }
            self.activateSession()
            guard let player = self.makePlayer(file) else {
                call.resolve(["played": false, "reason": "missing-file"])
                return
            }
            self.oneShots.removeAll { !$0.isPlaying }
            self.oneShots.append(player)
            let ok = player.play()
            call.resolve(["played": ok])
        }
    }

    @objc func schedule(_ call: CAPPluginCall) {
        let raw = call.getArray("cues", JSObject.self) ?? []
        var next: [Cue] = []
        for item in raw {
            guard let key = item["key"] as? String, let file = item["file"] as? String else { continue }
            let atMs = (item["at"] as? Double) ?? (item["at"] as? NSNumber)?.doubleValue
            guard let ms = atMs else { continue }
            next.append(Cue(key: key, file: file, at: Date(timeIntervalSince1970: ms / 1000.0)))
        }
        DispatchQueue.main.async {
            self.disarm()
            self.cues = next
            // Im Vordergrund: Anzahl tatsächlich eingeplanter Töne. Im Hintergrund wird erst beim Zurückkehren eingeplant;
            // gemeldet wird dann, wie viele Töne eine Datei im App-Paket haben (fehlt eine, spielt JS per Web Audio).
            let count = self.inForeground
                ? self.arm(allowLate: true)
                : next.filter { self.hasFile($0.file) }.count
            call.resolve(["scheduled": count, "total": next.count])
        }
    }

    @objc func cancel(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.disarm()
            self.cues = []
            call.resolve()
        }
    }

    @objc func getVolume(_ call: CAPPluginCall) {
        call.resolve(["volume": AVAudioSession.sharedInstance().outputVolume])
    }

    // MARK: - Planen

    /// Plant alle noch nicht vergangenen Töne bei iOS ein. @return Anzahl eingeplanter Töne
    /// allowLate: nur beim frischen Planen darf ein gerade fälliger Ton (bis lateTolerance) sofort kommen; beim erneuten
    /// Planen nach Hintergrund/Unterbrechung nur künftige Töne (ein eben gespielter Ton käme sonst doppelt).
    private func arm(allowLate: Bool = false) -> Int {
        // Immer erst die bisher eingeplanten Spieler stoppen - sonst kämen Töne doppelt (z. B. Rückkehr aus dem
        // Hintergrund UND Ende einer Unterbrechung direkt nacheinander).
        disarm()
        activateSession()
        let now = Date()
        var count = 0
        for cue in cues {
            let delay = cue.at.timeIntervalSince(now)
            if delay < (allowLate ? -lateTolerance : 0.05) { continue } // vorbei: nicht nachspielen
            guard let player = makePlayer(cue.file) else { continue }
            let ok = delay > 0.02 ? player.play(atTime: player.deviceCurrentTime + delay) : player.play()
            if ok {
                armed.append(player)
                count += 1
            }
        }
        // Vergangene Töne nicht aufbewahren
        cues.removeAll { $0.at.timeIntervalSince(now) < -lateTolerance }
        return count
    }

    private func disarm() {
        for player in armed { player.stop() }
        armed.removeAll()
    }

    private func hasFile(_ file: String) -> Bool {
        Bundle.main.url(forResource: (file as NSString).lastPathComponent, withExtension: nil) != nil
    }

    private func makePlayer(_ file: String) -> AVAudioPlayer? {
        // Nur Dateinamen aus dem App-Paket (kein Pfad), Daten zwischenspeichern
        let name = (file as NSString).lastPathComponent
        if soundData[name] == nil {
            guard let url = Bundle.main.url(forResource: name, withExtension: nil),
                  let data = try? Data(contentsOf: url) else { return nil }
            soundData[name] = data
        }
        guard let data = soundData[name], let player = try? AVAudioPlayer(data: data) else { return nil }
        player.prepareToPlay()
        return player
    }

    /// Gleiche Einstellung wie AppDelegate.reassertAudioSession: hörbar trotz Stumm-Schalter, Musik läuft weiter.
    private func activateSession() {
        let session = AVAudioSession.sharedInstance()
        if session.category != .playback || !session.categoryOptions.contains(.mixWithOthers) {
            try? session.setCategory(.playback, mode: .default, options: .mixWithOthers)
        }
        try? session.setActive(true)
    }

    // MARK: - App-Zustand und Unterbrechungen

    @objc private func didEnterBackground() {
        DispatchQueue.main.async {
            self.inForeground = false
            self.disarm()
        }
    }

    @objc private func willEnterForeground() {
        DispatchQueue.main.async {
            self.inForeground = true
            _ = self.arm()
            // Lautstärke kann sich im Hintergrund geändert haben (Kontrollzentrum) - Hinweis in der App aktualisieren
            self.notifyVolume()
        }
    }

    @objc private func routeChanged() {
        // Kurz warten: AppDelegate setzt die Audio-Einstellung bei jedem Wechsel neu
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            if self.inForeground { _ = self.arm() }
            self.notifyVolume()
        }
    }

    private func notifyVolume() {
        notifyListeners("volume", data: ["volume": AVAudioSession.sharedInstance().outputVolume])
    }

    @objc private func audioInterrupted(_ notification: Notification) {
        guard let info = notification.userInfo,
              let raw = info[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
        DispatchQueue.main.async {
            if type == .began {
                self.disarm()
            } else if self.inForeground {
                _ = self.arm()
            }
        }
    }

    @objc private func mediaServicesReset() {
        DispatchQueue.main.async {
            self.soundData.removeAll()
            self.armed.removeAll()
            self.oneShots.removeAll()
            if self.inForeground { _ = self.arm() }
        }
    }
}
