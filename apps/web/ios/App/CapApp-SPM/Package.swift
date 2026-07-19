// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.3.1"),
        .package(name: "CapacitorFirebaseAuthentication", path: "..\..\..\..\..\node_modules\.pnpm\@capacitor-firebase+authentication@8.3.0_@capacitor+core@8.3.1_firebase@12.12.1\node_modules\@capacitor-firebase\authentication"),
        .package(name: "CapacitorApp", path: "..\..\..\..\..\node_modules\.pnpm\@capacitor+app@8.1.0_@capacitor+core@8.3.1\node_modules\@capacitor\app"),
        .package(name: "CapacitorBrowser", path: "..\..\..\..\..\node_modules\.pnpm\@capacitor+browser@8.0.3_@capacitor+core@8.3.1\node_modules\@capacitor\browser"),
        .package(name: "CapacitorFilesystem", path: "..\..\..\..\..\node_modules\.pnpm\@capacitor+filesystem@8.1.2_@capacitor+core@8.3.1\node_modules\@capacitor\filesystem"),
        .package(name: "CapacitorGeolocation", path: "..\..\..\..\..\node_modules\.pnpm\@capacitor+geolocation@8.2.0_@capacitor+core@8.3.1\node_modules\@capacitor\geolocation"),
        .package(name: "CapacitorHaptics", path: "..\..\..\..\..\node_modules\.pnpm\@capacitor+haptics@8.0.2_@capacitor+core@8.3.1\node_modules\@capacitor\haptics"),
        .package(name: "CapacitorLocalNotifications", path: "..\..\..\..\..\node_modules\.pnpm\@capacitor+local-notifications@8.2.0_@capacitor+core@8.3.1\node_modules\@capacitor\local-notifications"),
        .package(name: "CapacitorPushNotifications", path: "..\..\..\..\..\node_modules\.pnpm\@capacitor+push-notifications@8.1.1_@capacitor+core@8.3.1\node_modules\@capacitor\push-notifications"),
        .package(name: "CapacitorShare", path: "..\..\..\..\..\node_modules\.pnpm\@capacitor+share@8.0.1_@capacitor+core@8.3.1\node_modules\@capacitor\share"),
        .package(name: "CapacitorStatusBar", path: "..\..\..\..\..\node_modules\.pnpm\@capacitor+status-bar@8.0.2_@capacitor+core@8.3.1\node_modules\@capacitor\status-bar"),
        .package(name: "CapgoCapacitorIncomingCallKit", path: "..\..\..\..\..\node_modules\.pnpm\@capgo+capacitor-incoming-call-kit@8.2.1_@capacitor+core@8.3.1\node_modules\@capgo\capacitor-incoming-call-kit"),
        .package(name: "CapacitorNativeSettings", path: "..\..\..\..\..\node_modules\.pnpm\capacitor-native-settings@8.1.0_@capacitor+core@8.3.1\node_modules\capacitor-native-settings")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorFirebaseAuthentication", package: "CapacitorFirebaseAuthentication"),
                .product(name: "CapacitorApp", package: "CapacitorApp"),
                .product(name: "CapacitorBrowser", package: "CapacitorBrowser"),
                .product(name: "CapacitorFilesystem", package: "CapacitorFilesystem"),
                .product(name: "CapacitorGeolocation", package: "CapacitorGeolocation"),
                .product(name: "CapacitorHaptics", package: "CapacitorHaptics"),
                .product(name: "CapacitorLocalNotifications", package: "CapacitorLocalNotifications"),
                .product(name: "CapacitorPushNotifications", package: "CapacitorPushNotifications"),
                .product(name: "CapacitorShare", package: "CapacitorShare"),
                .product(name: "CapacitorStatusBar", package: "CapacitorStatusBar"),
                .product(name: "CapgoCapacitorIncomingCallKit", package: "CapgoCapacitorIncomingCallKit"),
                .product(name: "CapacitorNativeSettings", package: "CapacitorNativeSettings")
            ]
        )
    ]
)
