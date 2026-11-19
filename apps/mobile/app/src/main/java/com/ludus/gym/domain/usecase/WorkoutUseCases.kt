package com.ludus.gym.domain.usecase

import com.ludus.gym.data.repository.WorkoutRepository
import com.ludus.gym.domain.model.Exercise
import com.ludus.gym.domain.model.Routine
import com.ludus.gym.domain.model.WorkoutLog
import com.ludus.gym.domain.model.isValidSet
import kotlinx.coroutines.flow.Flow
import java.util.concurrent.atomic.AtomicBoolean

class ObserveRoutinesUseCase(private val workouts: WorkoutRepository) {
    operator fun invoke(): Flow<List<Routine>> = workouts.observeRoutines()
}

class GetTodayRoutineUseCase(private val workouts: WorkoutRepository) {
    suspend operator fun invoke(): Routine? = workouts.routineForToday()
}

class RefreshRoutinesUseCase(private val workouts: WorkoutRepository) {
    suspend operator fun invoke() = workouts.refreshRoutines()
}

class ObservePendingWorkoutsUseCase(private val workouts: WorkoutRepository) {
    operator fun invoke(): Flow<Int> = workouts.observePendingCount()
}

class ObserveWorkoutLogsUseCase(private val workouts: WorkoutRepository) {
    operator fun invoke(): Flow<List<WorkoutLog>> = workouts.observeLogs()
}

/**Evita el doble tap: solo un registro puede estar en curso a la vez. */
class LogWorkoutUseCase(private val workouts: WorkoutRepository) {
    private val running = AtomicBoolean(false)

    suspend operator fun invoke(
        exercise: Exercise,
        sets: Int,
        reps: Int,
        weightKg: Double,
        rpe: Int,
    ): Result<WorkoutLog> {
        if (!running.compareAndSet(false, true)) {
            return Result.failure(IllegalStateException("Ya se está registrando una serie"))
        }
        return try {
            val draft = WorkoutLog("", exercise.id, exercise.name, sets, reps, weightKg, rpe)
            if (!draft.isValidSet()) {
                Result.failure(IllegalArgumentException("Revisa las repeticiones, el peso y la intensidad"))
            } else {
                workouts.logSet(exercise, sets, reps, weightKg, rpe)
            }
        } finally {
            running.set(false)
        }
    }
}
