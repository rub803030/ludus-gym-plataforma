package com.ludus.gym.domain.usecase

import com.ludus.gym.data.repository.BookingRepository
import com.ludus.gym.domain.model.GymClass
import kotlinx.coroutines.flow.StateFlow
import java.util.concurrent.atomic.AtomicBoolean

class ObserveClassesUseCase(private val bookings: BookingRepository) {
    operator fun invoke(): StateFlow<List<GymClass>> = bookings.classes
}

class RefreshClassesUseCase(private val bookings: BookingRepository) {
    suspend operator fun invoke() = bookings.refresh()
}

/** Confirma la reserva una sola vez aunque el usuario pulse dos veces. */
class BookClassUseCase(private val bookings: BookingRepository) {
    private val running = AtomicBoolean(false)

    suspend operator fun invoke(classId: String): Result<Unit> {
        if (!running.compareAndSet(false, true)) {
            return Result.failure(IllegalStateException("Reserva en curso"))
        }
        return try {
            bookings.book(classId).recoverCatching {
                bookings.bookOffline(classId)
            }
        } finally {
            running.set(false)
        }
    }
}

class CancelBookingUseCase(private val bookings: BookingRepository) {
    private val running = AtomicBoolean(false)

    suspend operator fun invoke(classId: String): Result<Unit> {
        if (!running.compareAndSet(false, true)) {
            return Result.failure(IllegalStateException("Cancelación en curso"))
        }
        return try {
            bookings.cancel(classId).recoverCatching {
                bookings.cancelOffline(classId)
            }
        } finally {
            running.set(false)
        }
    }
}
