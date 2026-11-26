import Foundation

struct BookingRepository {
    private let api = APIClient.shared
    private let store = FileStore.shared

    func classes() async throws -> [GymClass] {
        let dtos: [ClassDTO] = try await api.request("api/classes")
        var items = dtos.enumerated().map { GymClass(dto: $0.element, index: $0.offset) }
        let local = await localBookedIDs()
        if !local.isEmpty {
            items = items.map { item in
                var copy = item
                if local.contains(item.id) { copy = GymClass(
                    id: item.id, title: item.title, startAt: item.startAt,
                    durationMinutes: item.durationMinutes, coach: item.coach,
                    capacity: item.capacity, booked: min(item.booked + 1, item.capacity),
                    isBooked: true, intensity: item.intensity
                ) }
                return copy
            }
        }
        await store.save(items, key: "cached_classes")
        return items
    }

    func cachedClasses() async -> [GymClass] {
        await store.load("cached_classes") ?? []
    }

    /// `GET /api/payments` requiere `payments:audit`: un MEMBER recibe 403.
    /// Se muestran solo comprobantes guardados localmente; nunca se inventan cargos.
    func receipts() async -> [Receipt] {
        if let dtos: [PaymentDTO] = try? await api.request("api/payments") {
            let items = dtos.enumerated().map { Receipt(dto: $0.element, index: $0.offset) }
            await store.save(items, key: "cached_receipts")
            return items
        }
        return await store.load("cached_receipts") ?? []
    }

    func book(classId: String) async throws {
        do {
            try await api.requestVoid("api/classes/\(classId)/book", method: .post)
        } catch {
            var ids = await localBookedIDs()
            if !ids.contains(classId) {
                ids.append(classId)
                await store.save(ids, key: FileStore.Key.bookings)
            }
            throw error
        }
        var ids = await localBookedIDs()
        ids.removeAll { $0 == classId }
        await store.save(ids, key: FileStore.Key.bookings)
    }

    func cancel(classId: String) async throws {
        do {
            try await api.requestVoid("api/classes/\(classId)/book", method: .delete)
        } catch {
            var ids = await localBookedIDs()
            ids.removeAll { $0 == classId }
            await store.save(ids, key: FileStore.Key.bookings)
            throw error
        }
    }

    private func localBookedIDs() async -> [String] {
        await store.load(FileStore.Key.bookings) ?? []
    }
}
