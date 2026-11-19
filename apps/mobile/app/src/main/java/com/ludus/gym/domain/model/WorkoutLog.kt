package com.ludus.gym.domain.model

import kotlin.math.roundToInt

data class Exercise(
    val id: String,
    val name: String,
    val sets: Int = 3,
    val reps: Int = 10,
    val weightKg: Double = 0.0,
    val rpe: Int = 7,
    val muscleGroup: String = "",
    val completed: Boolean = false,
)

data class Routine(
    val id: String,
    val dayOfWeek: Int,
    val title: String,
    val exercises: List<Exercise> = emptyList(),
    val durationMinutes: Int = 60,
)

data class WorkoutLog(
    val id: String,
    val exerciseId: String,
    val exerciseName: String,
    val sets: Int,
    val reps: Int,
    val weightKg: Double,
    val rpe: Int,
    val loggedAt: Long = System.currentTimeMillis(),
    val synced: Boolean = false,
)

fun WorkoutLog.volumeKg(): Double = sets * reps * weightKg

fun WorkoutLog.isValidSet(): Boolean =
    sets in 1..20 && reps in 1..100 && weightKg >= 0.0 && rpe in 1..10

fun Double.weightLabel(): String =
    if (this % 1.0 == 0.0) "${roundToInt()} kg" else String.format(java.util.Locale.US, "%.1f kg", this)
