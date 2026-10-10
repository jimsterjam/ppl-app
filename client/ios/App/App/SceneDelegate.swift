import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        guard let windowScene = (scene as? UIWindowScene) else { return }

        window = UIWindow(windowScene: windowScene)
        // MainViewController = CAPBridgeViewController + eigenes Plugin RestAlarm (siehe MainViewController.swift)
        window?.rootViewController = MainViewController()
        window?.makeKeyAndVisible()
    }
}