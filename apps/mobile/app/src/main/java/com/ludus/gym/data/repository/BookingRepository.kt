package com.ludus.gym.data.repository

import com.ludus.gym.data.demo.DemoCatalog
import com.ludus.gym.data.remote.ApiService
import com.ludus.gym.domain.model.GymClass
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class BookingRepository(private val api: ApiService) {
    private val _classes = MutableStateFlow(DemoCatalog.classes)
    val classes: StateFlow<List<GymClass>> = _classes.asStateFlow()

    suspend fun refresh(): Result<Unit> = runCatching {
        val remote = api.classes().mapIndexed { index, dto -> dto.toDomain(index) }
        if (remote.isNotEmpty()) _classes.value = remote
    }

    suspend fun book(classId: String): Result<Unit> = runCatching {
        api.bookClass(classId)
        _classes.value = _classes.value.map { item ->
            if (item.id == classId) item.copy(isBooked = true, booked = (item.booked + 1).coerceAtMost(item.capacity))
            else item
        }
    }

    suspend fun cancel(classId: String): Result<Unit> = runCatching {
        api.cancelBooking(classId)
        _classes.value = _classes.value.map { item ->
            if (item.id == classId) item.copy(isBooked = false, booked = (item.booked - 1).coerceAtLeast(0))
            else item
        }
    }

    /** Confirmación local para reservas: actualiza aunque el backend no esté disponible. */
    suspend fun bookOffline(classId: String) {
        _classes.value = _classes.value.map { item ->
            if (item.id == classId && !item.isBooked) {
                item.copy(isBooked = true, booked = (item.booked + 1).coerceAtMost(item.capacity))
            } else item
        }
    }

    suspend fun cancelOffline(classId: String) {
        _classes.value = _classes.value.map { item ->
            if (item.id == classId && item.isBooked) {
                item.copy(isBooked = false, booked = (item.booked - 1).coerceAtLeast(0))
            } else item
        }
    }
}
