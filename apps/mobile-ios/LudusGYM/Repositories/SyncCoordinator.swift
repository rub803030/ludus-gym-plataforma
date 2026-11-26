import Foundation

/// Drena la cola persistida cuando vuelve la conexión o al entrar en primer plano.
/// `POST /api/access/events` no existe en la API, por lo que ese tipo no se encola.
enum SyncCoordinator {
    static func syncPending() async {
        let operations = await FileStore.shared.pending()
        guard !operations.isEmpty else { return }

        var remaining: [PendingOperation] = []
        for operation in operations {
            guard operation.type == "workout_log",
                  let data = operation.payload.data(using: .utf8),
                  let log = try? JSONDecoder().decode(WorkoutLogPayload.self, from: data) else {
                // Tipos sin endpoint o payload malformado: se descartan.
                continue
            }
            do {
                try await APIClient.shared.requestVoid("api/workout-logs", method: .post, body: log)
            } catch {
                var retry = operation
                retry.attempts += 1
                remaining.append(retry)
            }
        }
        await FileStore.shared.updatePending(remaining)
    }
}
