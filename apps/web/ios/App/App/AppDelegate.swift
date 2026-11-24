import UIKit
import Capacitor
import AVFoundation

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Fond de lancement unique (clair #FFFFFF / sombre #111111) — même couleur que
        // LaunchScreen, l'image Splash, la WebView et le fond de l'app : aucun flash.
        window?.backgroundColor = AppColors.launchBackground

        // Son des vidéos (OUT VLOGS, pages) même avec le commutateur silencieux/vibreur.
        // Sans catégorie explicite, iOS utilise .soloAmbient qui coupe l'audio du WKWebView
        // quand l'iPhone est en mode silencieux. La catégorie est seulement déclarée ici :
        // la session n'est activée (et la musique d'une autre app interrompue) que lorsqu'une
        // vidéo AVEC son démarre — les aperçus muets ne l'activent pas.
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback, options: [])
        } catch {
            print("[AudioSession] Impossible de passer en mode playback : \(error)")
        }
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    // Notifications push : transmet le jeton APNs (ou l'erreur) au plugin @capacitor/push-notifications.
    // Sans ces deux méthodes, l'événement JS 'registration' ne se déclenche jamais sur iOS
    // et aucun jeton iPhone n'est enregistré côté serveur.
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}

// MARK: - Fond de lancement (aucun flash blanc / noir au démarrage)

enum AppColors {
    /// Couleur « LaunchBackground » d'Assets.xcassets : #FFFFFF (clair) / #111111 (sombre)
    static var launchBackground: UIColor {
        UIColor(named: "LaunchBackground") ?? UIColor { trait in
            trait.userInterfaceStyle == .dark
                ? UIColor(red: 17 / 255, green: 17 / 255, blue: 17 / 255, alpha: 1)
                : .white
        }
    }
}

/// Contrôleur principal (Main.storyboard) : sans réglage, Capacitor donne à la WebView le fond
/// `systemBackground`, NOIR en mode sombre, visible tant que la page distante n'est pas affichée.
/// On lui donne la couleur de fond de l'app, identique au splash.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        let background = AppColors.launchBackground
        view.backgroundColor = background
        webView?.backgroundColor = background
        webView?.scrollView.backgroundColor = background
        if #available(iOS 15.0, *) {
            webView?.underPageBackgroundColor = background
        }
    }
}
