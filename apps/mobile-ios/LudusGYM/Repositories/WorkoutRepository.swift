import Foundation

struct WorkoutLogPayload: Codable {
    let exerciseId: String
    let weightKg: Double
    let repsDone: Int
    let rpe: Int
    let performedAt: String
}

struct WorkoutRepository {
    private let api = APIClient.shared
    private let store = FileStore.shared

    func routines() async throws -> [Routine] {
        let dtos: [RoutineDTO] = try await api.request("api/routines")
        let mapped = RoutineMapper.routines(from: dtos)
        let result = mapped.isEmpty ? (await store.load(FileStore.Key.routines) ?? []) : mapped
        if !result.isEmpty {
            await store.save(result, key: FileStore.Key.routines)
        }
        return result
    }

    @discardableResult
    func logSet(
        exerciseId: String,
        sets: Int,
        reps: Int,
        weightKg: Double,
        rpe: Int
    ) async throws -> WorkoutLogPayload {
        guard (1...20).contains(sets), (1...100).contains(reps), weightKg >= 0, (1...10).contains(rpe) else {
            throw APIError.message("Revisa las repeticiones, el peso y la intensidad")
        }

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let payload = WorkoutLogPayload(
            exerciseId: exerciseId,
            weightKg: weightKg,
            repsDone: reps,
            rpe: rpe,
            performedAt: formatter.string(from: Date())
        )
        let encoder = JSONEncoder()
        guard let data = try? encoder.encode(payload),
              let json = String(data: data, encoding: .utf8) else {
            throw APIError.message("No se pudo guardar la serie")
        }

        await store.enqueue(type: "workout_log", payload: json)
        Task { await SyncCoordinator.syncPending() }
        return payload
    }

    func pendingCount() async -> Int {
        await store.pending().count
    }
}
