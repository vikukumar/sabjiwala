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
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.4.0"),
        .package(name: "CapacitorFirebaseAnalytics", path: "..\..\..\node_modules\@capacitor-firebase\analytics"),
        .package(name: "CapacitorFirebaseCrashlytics", path: "..\..\..\node_modules\@capacitor-firebase\crashlytics"),
        .package(name: "CapacitorFirebasePerformance", path: "..\..\..\node_modules\@capacitor-firebase\performance"),
        .package(name: "CapacitorBackgroundRunner", path: "..\..\..\node_modules\@capacitor\background-runner"),
        .package(name: "CapacitorCamera", path: "..\..\..\node_modules\@capacitor\camera"),
        .package(name: "CapacitorDevice", path: "..\..\..\node_modules\@capacitor\device"),
        .package(name: "CapacitorDialog", path: "..\..\..\node_modules\@capacitor\dialog"),
        .package(name: "CapacitorFilesystem", path: "..\..\..\node_modules\@capacitor\filesystem"),
        .package(name: "CapacitorLocalNotifications", path: "..\..\..\node_modules\@capacitor\local-notifications"),
        .package(name: "CapacitorNetwork", path: "..\..\..\node_modules\@capacitor\network"),
        .package(name: "CapacitorPushNotifications", path: "..\..\..\node_modules\@capacitor\push-notifications"),
        .package(name: "CapacitorToast", path: "..\..\..\node_modules\@capacitor\toast"),
        .package(name: "CapawesomeTeamCapacitorFileOpener", path: "..\..\..\node_modules\@capawesome-team\capacitor-file-opener"),
        .package(name: "CapgoCapacitorAndroidSmsRetriever", path: "..\..\..\node_modules\@capgo\capacitor-android-sms-retriever"),
        .package(name: "CapgoCapacitorStreamCall", path: "..\..\..\node_modules\@capgo\capacitor-stream-call"),
        .package(name: "CapgoCapacitorUpdater", path: "..\..\..\node_modules\@capgo\capacitor-updater")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorFirebaseAnalytics", package: "CapacitorFirebaseAnalytics"),
                .product(name: "CapacitorFirebaseCrashlytics", package: "CapacitorFirebaseCrashlytics"),
                .product(name: "CapacitorFirebasePerformance", package: "CapacitorFirebasePerformance"),
                .product(name: "CapacitorBackgroundRunner", package: "CapacitorBackgroundRunner"),
                .product(name: "CapacitorCamera", package: "CapacitorCamera"),
                .product(name: "CapacitorDevice", package: "CapacitorDevice"),
                .product(name: "CapacitorDialog", package: "CapacitorDialog"),
                .product(name: "CapacitorFilesystem", package: "CapacitorFilesystem"),
                .product(name: "CapacitorLocalNotifications", package: "CapacitorLocalNotifications"),
                .product(name: "CapacitorNetwork", package: "CapacitorNetwork"),
                .product(name: "CapacitorPushNotifications", package: "CapacitorPushNotifications"),
                .product(name: "CapacitorToast", package: "CapacitorToast"),
                .product(name: "CapawesomeTeamCapacitorFileOpener", package: "CapawesomeTeamCapacitorFileOpener"),
                .product(name: "CapgoCapacitorAndroidSmsRetriever", package: "CapgoCapacitorAndroidSmsRetriever"),
                .product(name: "CapgoCapacitorStreamCall", package: "CapgoCapacitorStreamCall"),
                .product(name: "CapgoCapacitorUpdater", package: "CapgoCapacitorUpdater")
            ]
        )
    ]
)
