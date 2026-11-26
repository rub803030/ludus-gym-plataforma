import Foundation
import Network
import Observation

/// Estado de red usado para elegir pase en línea o credencial offline.
@Observable
@MainActor
final class NetworkMonitor {
    @MainActor static let shared = NetworkMonitor()

    private(set) var isOnline = true

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "com.ludus.gym.network")

    init() {
        monitor.pathUpdateHandler = { [weak self] path in
            let online = path.status == .satisfied
            Task { @MainActor in
                self?.isOnline = online
            }
        }
        monitor.start(queue: queue)
    }
}
