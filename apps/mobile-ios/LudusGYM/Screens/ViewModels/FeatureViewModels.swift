import Foundation
import Observation
import UIKit

private struct OccupancyDTO: Decodable {
    let current: Int?
    let count: Int?
    let capacity: Int?
    let maxCapacity: Int?
    let available: Int?
    let updatedAt: String?
}

@Observable
@MainActor
final class HomeViewModel {
    var member: Member?
    var fallbackName: String
    var activeGymId: String?
    var gymName: String?
    var gyms: [Gym] = []
    var occupancy: Occupancy?
    var occupancyUnavailable = false
    var isRefreshing = false

    private let auth = AuthRepository()
    private let gymsRepository = GymRepository()

    init(fallbackName: String) {
        self.fallbackName = fallbackName
    }

    func refresh() async {
        guard !isRefreshing else { return }
        isRefreshing = true
        defer { isRefreshing = false }

        member = try? await auth.profile()
        if let result = try? await gymsRepository.myGyms() {
            gyms = result.gyms
            activeGymId = result.activeGymId ?? SecureStore.activeGymId
            gymName = gyms.first { $0.id == activeGymId }?.displayName
        } else {
            gyms = await gymsRepository.cachedGyms()
            activeGymId = SecureStore.activeGymId
            gymName = gyms.first { $0.id == activeGymId }?.displayName
        }

        // La API exige `access:checkin` para occupancy: un MEMBER recibe 403.
        // En ese caso se muestra «Aforo no disponible» en lugar de inventar datos.
        if let dto: OccupancyDTO = try? await APIClient.shared.request("api/access/occupancy") {
            occupancy = Occupancy(
                current: dto.current ?? dto.count ?? 0,
                capacity: dto.capacity ?? dto.maxCapacity ?? 0,
                updatedAt: dto.updatedAt ?? "Actualizado ahora"
            )
            occupancyUnavailable = false
        } else {
            occupancy = nil
            occupancyUnavailable = true
        }
    }

    func signOut() async {
        await auth.logout()
    }
}

@Observable
@MainActor
final class QrViewModel {
    var ticket: QrTicket?
    var now: Int64 = QrPayload.nowMillis()
    var isRefreshing = false
    var message: String?
    var copied = false
    var gyms: [Gym] = []
    var activeGymId: String?
    var didLoadGyms = false

    private let repository = QrRepository()
    private let gymsRepository = GymRepository()
    private var ticker: Task<Void, Never>?

    var gymName: String? {
        let target = activeGymId ?? ticket?.gymId
        return gyms.first { $0.id == target }?.displayName
    }

    var hasGym: Bool {
        if activeGymId != nil || ticket?.gymId != nil { return true }
        return !gyms.isEmpty
    }

    func start() {
        Task {
            await loadGyms()
            await refresh()
        }
        ticker = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                guard let self else { return }
                self.now = QrPayload.nowMillis()
                if self.ticket == nil || self.ticket?.isExpired(now: self.now) == true {
                    await self.refresh()
                }
            }
        }
    }

    func stop() {
        ticker?.cancel()
        ticker = nil
    }

    func loadGyms() async {
        if let result = try? await gymsRepository.myGyms() {
            gyms = result.gyms
            activeGymId = result.activeGymId
        } else {
            gyms = await gymsRepository.cachedGyms()
            activeGymId = SecureStore.activeGymId
        }
        didLoadGyms = true
    }

    @discardableResult
    func refresh() async -> Bool {
        guard !isRefreshing else { return false }
        guard hasGym else {
            message = "Unase a algun gimnasio para tener acceso"
            return false
        }
        isRefreshing = true
        defer { isRefreshing = false }
        do {
            ticket = try await repository.refresh()
            message = nil
            return true
        } catch {
            ticket = nil
            message = APIErrorMessages.readable(error)
            return false
        }
    }

    func copyCode() {
        guard let ticket else { return }
        UIPasteboard.general.string = ticket.token
        copied = true
    }
}

@Observable
@MainActor
final class WorkoutViewModel {
    var routines: [Routine] = []
    var selectedDay = WorkoutViewModel.today()
    var pendingCount = 0
    var selectedExercise: Exercise?
    var sets = "3"
    var reps = "10"
    var weight = "0"
    var rpe = 7
    var isLogging = false
    var message: String?

    private let repository = WorkoutRepository()

    var currentRoutine: Routine? {
        routines.first { $0.dayOfWeek == selectedDay }
    }

    static func today() -> Int {
        let weekday = Calendar.current.component(.weekday, from: Date())
        return (weekday + 5) % 7 + 1
    }

    func refresh() async {
        do {
            routines = try await repository.routines()
        } catch {
            message = APIErrorMessages.readable(error)
        }
        pendingCount = await repository.pendingCount()
    }

    func selectExercise(_ exercise: Exercise) {
        selectedExercise = exercise
        sets = "\(exercise.sets)"
        reps = "\(exercise.reps)"
        weight = exercise.weightKg.truncatingRemainder(dividingBy: 1) == 0
            ? "\(Int(exercise.weightKg))"
            : "\(exercise.weightKg)"
        rpe = exercise.rpe
        message = nil
    }

    @discardableResult
    func logSet() async -> Bool {
        guard let exercise = selectedExercise else {
            message = "Elige un ejercicio para registrar la serie."
            return false
        }
        guard !isLogging else { return false }
        isLogging = true
        defer { isLogging = false }
        do {
            try await repository.logSet(
                exerciseId: exercise.id,
                sets: Int(sets) ?? 3,
                reps: Int(reps) ?? 10,
                weightKg: Double(weight.replacingOccurrences(of: ",", with: ".")) ?? 0,
                rpe: rpe
            )
            message = "Serie guardada. Se sincronizará cuando haya conexión."
            pendingCount = await repository.pendingCount()
            selectedExercise = nil
            return true
        } catch {
            message = APIErrorMessages.readable(error)
            return false
        }
    }
}

@Observable
@MainActor
final class NutritionViewModel {
    var plan: NutritionPlan = .demo
    var hydrationGlasses = 0

    private let repository = NutritionRepository()
    private let store = FileStore.shared

    func load() async {
        plan = await repository.plan()
        hydrationGlasses = await store.load(FileStore.Key.hydration) ?? 0
    }

    func addGlass() {
        hydrationGlasses = min(hydrationGlasses + 1, 12)
        Task { await store.save(hydrationGlasses, key: FileStore.Key.hydration) }
    }

    func removeGlass() {
        hydrationGlasses = max(hydrationGlasses - 1, 0)
        Task { await store.save(hydrationGlasses, key: FileStore.Key.hydration) }
    }
}

@Observable
@MainActor
final class BookingViewModel {
    var classes: [GymClass] = []
    var receipts: [Receipt] = []
    var confirmationFor: GymClass?
    var busyClassId: String?
    var message: String?
    var showReceipts = false

    private let repository = BookingRepository()

    func refresh() async {
        do {
            classes = try await repository.classes()
        } catch {
            classes = await repository.cachedClasses()
            message = APIErrorMessages.readable(error)
        }
        receipts = await repository.receipts()
    }

    func requestBook(_ item: GymClass) { confirmationFor = item }
    func requestCancel(_ item: GymClass) { confirmationFor = item }
    func consumeMessage() { message = nil }

    @discardableResult
    func confirm() async -> Bool {
        guard let item = confirmationFor else { return false }
        confirmationFor = nil
        let shouldBook = !item.isBooked
        busyClassId = item.id
        defer { busyClassId = nil }
        do {
            if shouldBook {
                try await repository.book(classId: item.id)
                message = "Plaza reservada. ¡Nos vemos en clase!"
            } else {
                try await repository.cancel(classId: item.id)
                message = "Reserva cancelada."
            }
            await refresh()
            return true
        } catch let error as APIError {
            // La operación queda reflejada localmente mientras se sincroniza.
            toggleLocally(item)
            message = APIErrorMessages.readable(error)
            return false
        } catch {
            toggleLocally(item)
            message = "No se pudo completar la operación. Inténtalo de nuevo."
            return false
        }
    }

    private func toggleLocally(_ item: GymClass) {
        guard let index = classes.firstIndex(where: { $0.id == item.id }) else { return }
        var copy = classes[index]
        copy = GymClass(
            id: copy.id, title: copy.title, startAt: copy.startAt,
            durationMinutes: copy.durationMinutes, coach: copy.coach,
            capacity: copy.capacity,
            booked: max(0, copy.booked + (copy.isBooked ? -1 : 1)),
            isBooked: !copy.isBooked,
            intensity: copy.intensity
        )
        classes[index] = copy
    }
}
