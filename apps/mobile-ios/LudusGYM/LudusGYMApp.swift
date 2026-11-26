import BackgroundTasks
import SwiftUI

@main
struct LudusGYMApp: App {
    init() {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: "com.ludus.gym.sync",
            using: nil
        ) { task in
            Task {
                await SyncCoordinator.syncPending()
                task.setTaskCompleted(success: true)
            }
        }
    }

    var body: some Scene {
        WindowGroup {
            RootView()
        }
    }
}
