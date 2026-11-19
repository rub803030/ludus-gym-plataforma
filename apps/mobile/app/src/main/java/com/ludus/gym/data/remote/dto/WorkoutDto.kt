package com.ludus.gym.data.remote.dto

import com.ludus.gym.domain.model.Exercise
import com.ludus.gym.domain.model.Routine
import com.squareup.moshi.Json

data class ExerciseDto(
    @Json(name = "id") val id: String? = null,
    @Json(name = "name") val name: String? = null,
    @Json(name = "sets") val sets: Int? = null,
    @Json(name = "reps") val reps: Int? = null,
    @Json(name = "weightKg") val weightKg: Double? = null,
    @Json(name = "weight") val weight: Double? = null,
    @Json(name = "rpe") val rpe: Int? = null,
    @Json(name = "muscleGroup") val muscleGroup: String? = null,
    @Json(name = "completed") val completed: Boolean? = null,
) {
    fun toDomain(index: Int) = Exercise(
        id = id ?: "exercise-$index",
        name = name ?: "Ejercicio ${index + 1}",
        sets = sets ?: 3,
        reps = reps ?: 10,
        weightKg = weightKg ?: weight ?: 0.0,
        rpe = rpe ?: 7,
        muscleGroup = muscleGroup.orEmpty(),
        completed = completed ?: false,
    )
}

data class RoutineDto(
    @Json(name = "id") val id: String? = null,
    @Json(name = "dayOfWeek") val dayOfWeek: Int? = null,
    @Json(name = "day") val day: String? = null,
    @Json(name = "title") val title: String? = null,
    @Json(name = "name") val name: String? = null,
    @Json(name = "durationMinutes") val durationMinutes: Int? = null,
    @Json(name = "exercises") val exercises: List<ExerciseDto>? = null,
) {
    fun toDomain(index: Int): Routine = Routine(
        id = id ?: "routine-$index",
        dayOfWeek = dayOfWeek ?: parseDay(day),
        title = title ?: name ?: "Rutina del día",
        exercises = (exercises ?: emptyList()).mapIndexed { i, it -> it.toDomain(i) },
        durationMinutes = durationMinutes ?: 60,
    )
}

private fun parseDay(day: String?): Int {
    if (day.isNullOrBlank()) return 1
    return when (day.lowercase().take(3)) {
        "lun" -> 1
        "mar" -> 2
        "mié", "mie" -> 3
        "jue" -> 4
        "vie" -> 5
        "sáb", "sab" -> 6
        "dom" -> 7
        else -> day.toIntOrNull() ?: 1
    }
}

data class WorkoutLogRequestDto(
    @Json(name = "exerciseId") val exerciseId: String,
    @Json(name = "sets") val sets: Int,
    @Json(name = "reps") val reps: Int,
    @Json(name = "weightKg") val weightKg: Double,
    @Json(name = "rpe") val rpe: Int,
    @Json(name = "loggedAt") val loggedAt: Long,
)

data class WorkoutLogResponseDto(
    @Json(name = "id") val id: String? = null,
    @Json(name = "success") val success: Boolean? = null,
)
