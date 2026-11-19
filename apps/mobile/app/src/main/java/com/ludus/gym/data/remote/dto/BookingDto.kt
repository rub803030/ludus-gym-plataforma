package com.ludus.gym.data.remote.dto

import com.ludus.gym.domain.model.GymClass
import com.squareup.moshi.Json

data class ClassDto(
    @Json(name = "id") val id: String? = null,
    @Json(name = "title") val title: String? = null,
    @Json(name = "name") val name: String? = null,
    @Json(name = "startAt") val startAt: String? = null,
    @Json(name = "startsAt") val startsAt: String? = null,
    @Json(name = "time") val time: String? = null,
    @Json(name = "durationMinutes") val durationMinutes: Int? = null,
    @Json(name = "coach") val coach: String? = null,
    @Json(name = "instructor") val instructor: String? = null,
    @Json(name = "capacity") val capacity: Int? = null,
    @Json(name = "booked") val booked: Int? = null,
    @Json(name = "enrolled") val enrolled: Int? = null,
    @Json(name = "spotsLeft") val spotsLeft: Int? = null,
    @Json(name = "isBooked") val isBooked: Boolean? = null,
    @Json(name = "bookedByMe") val bookedByMe: Boolean? = null,
    @Json(name = "intensity") val intensity: String? = null,
) {
    fun toDomain(index: Int): GymClass {
        val max = capacity ?: 16
        val taken = booked ?: enrolled ?: max - (spotsLeft ?: 0)
        return GymClass(
            id = id ?: "class-$index",
            title = title ?: name ?: "Clase Hyrox",
            startAt = startAt ?: startsAt ?: time.orEmpty(),
            durationMinutes = durationMinutes ?: 60,
            coach = coach ?: instructor ?: "Equipo Ludus",
            capacity = max,
            booked = taken.coerceIn(0, max),
            isBooked = isBooked ?: bookedByMe ?: false,
            intensity = intensity ?: "Alta",
        )
    }
}

data class BookResponseDto(
    @Json(name = "success") val success: Boolean? = null,
    @Json(name = "bookingId") val bookingId: String? = null,
    @Json(name = "booked") val booked: Boolean? = null,
)
