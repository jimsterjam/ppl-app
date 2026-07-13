import UIKit
import Capacitor
import AVFoundation

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    override init() {
        super.init()
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(reassertAudioSession),
            name: AVAudioSession.routeChangeNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(reassertAudioSession),
            name: AVAudioSession.mediaServicesWereResetNotification,
            object: nil
        )
    }

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        // Hintergrundmusik anderer Apps nicht unterbrechen (kein Ducking)
        reassertAudioSession()
        return true
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // WebKit kann die Audio-Session bei Video-/Audio-Playback eigenmächtig
        // umschalten (z.B. auf .playback), was andere Apps wie Spotify pausiert.
        // Beim Wiederaktivieren der App erzwingen wir daher erneut .ambient + mixWithOthers.
        reassertAudioSession()
    }

    @objc func reassertAudioSession() {
        try? AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default, options: .mixWithOthers)
        try? AVAudioSession.sharedInstance().setActive(true, options: .notifyOthersOnDeactivation)
    }

    func application(
        _ app: UIApplication,
        open url: URL,
        options: [UIApplication.OpenURLOptionsKey: Any] = [:]
    ) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(
        _ application: UIApplication,
        continue userActivity: NSUserActivity,
        restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
    ) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}