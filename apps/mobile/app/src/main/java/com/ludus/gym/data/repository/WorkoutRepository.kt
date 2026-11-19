package com.ludus.gym.data.repository

import android.content.Context
import com.ludus.gym.data.demo.DemoCatalog
import com.ludus.gym.data.local.LudusDao
import com.ludus.gym.data.local.PendingSyncEntity
import com.ludus.gym.data.local.RoutineEntity
import com.ludus.gym.data.local.SyncWorker
import com.ludus.gym.data.local.WorkoutLogEntity
import com.ludus.gym.data.remote.ApiService
import com.ludus.gym.data.remote.dto.AccessEventRequestDto
import com.ludus.gym.data.remote.dto.WorkoutLogRequestDto
import com.ludus.gym.domain.model.Exercise
import com.ludus.gym.domain.model.Routine
import com.ludus.gym.domain.model.WorkoutLog
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.util.Calendar
import java.util.UUID

class WorkoutRepository(
    private val api: ApiService,
    private val dao: LudusDao,
    private val moshi: Moshi,
    private val context: Context,
) {
    private val exercisesAdapter = moshi.adapter<List<Exercise>>(
        Types.newParameterizedType(List::class.java, Exercise::class.java),
    )
    private val logAdapter = moshi.adapter(WorkoutLog::class.java)
    private val accessEventAdapter = moshi.adapter(AccessEventRequestDto::class.java)

    fun observeRoutines(): Flow<List<Routine>> = dao.observeRoutines().map { rows ->
        rows.mapNotNull { row ->
            val exercises = runCatching { exercisesAdapter.fromJson(row.exercisesJson) }.getOrNull() ?: emptyList()
            Routine(row.id, row.dayOfWeek, row.title, exercises, row.durationMinutes)
        }.sortedBy { it.dayOfWeek }
    }

    fun observeLogs(): Flow<List<WorkoutLog>> = dao.observeWorkoutLogs().map { rows -> rows.map { it.toDomain() } }

    fun observePendingCount(): Flow<Int> = dao.observeWorkoutLogs().map { rows -> rows.count { !it.synced } }

    suspend fun routineForToday(): Routine? {
        val day = (Calendar.getInstance().get(Calendar.DAY_OF_WEEK) + 5) % 7 + 1
        val all = routinesOnce()
        return all.firstOrNull { it.dayOfWeek == day } ?: all.firstOrNull()
    }

    private suspend fun routinesOnce(): List<Routine> = dao.routinesOnce().mapNotNull { row ->
        val exercises = runCatching { exercisesAdapter.fromJson(row.exercisesJson) }.getOrNull() ?: emptyList()
        Routine(row.id, row.dayOfWeek, row.title, exercises, row.durationMinutes)
    }

    suspend fun refreshRoutines(): Result<Unit> = runCatching {
        val remote = runCatching { api.routines() }.getOrDefault(emptyList())
        val routines = if (remote.isEmpty()) {
            DemoCatalog.routines
        } else {
            remote.mapIndexed { index, dto -> dto.toDomain(index) }
        }
        dao.saveRoutines(routines.map { it.toEntity() })
    }

    suspend fun logSet(exercise: Exercise, sets: Int, reps: Int, weightKg: Double, rpe: Int): Result<WorkoutLog> =
        runCatching {
            val log = WorkoutLog(
                id = UUID.randomUUID().toString(),
                exerciseId = exercise.id,
                exerciseName = exercise.name,
                sets = sets,
                reps = reps,
                weightKg = weightKg,
                rpe = rpe,
                loggedAt = System.currentTimeMillis(),
                synced = false,
            )
            dao.insertLog(log.toEntity())
            dao.enqueueSync(
                PendingSyncEntity(
                    type = "workout_log",
                    payload = logAdapter.toJson(log),
                    createdAt = System.currentTimeMillis(),
                ),
            )
            SyncWorker.enqueue(context)
            log
        }

    /** Llamado por WorkManager con red disponible. */
    suspend fun syncPending() {
        for (item in dao.pendingSync()) {
            when (item.type) {
                "workout_log" -> {
                    val log = runCatching { logAdapter.fromJson(item.payload) }.getOrNull()
                    if (log == null) {
                        dao.removeSync(item)
                        continue
                    }
                    val sent = runCatching {
                        api.createWorkoutLog(
                            WorkoutLogRequestDto(
                                exerciseId = log.exerciseId,
                                sets = log.sets,
                                reps = log.reps,
                                weightKg = log.weightKg,
                                rpe = log.rpe,
                                loggedAt = log.loggedAt,
                            ),
                        )
                    }.isSuccess
                    if (sent) {
                        dao.markLogSynced(log.id)
                        dao.removeSync(item)
                    } else {
                        dao.increaseAttempts(item.id)
                    }
                }
                "access_event" -> {
                    val event = runCatching { accessEventAdapter.fromJson(item.payload) }.getOrNull()
                    if (event == null) {
                        dao.removeSync(item)
                        continue
                    }
                    val sent = runCatching { api.recordAccessEvent(event) }.isSuccess
                    if (sent) dao.removeSync(item) else dao.increaseAttempts(item.id)
                }
            }
        }

        for (event in dao.unsyncedAccessEvents()) {
            val sent = runCatching {
                api.recordAccessEvent(
                    AccessEventRequestDto(event.memberId, event.token, event.scannedAt),
                )
            }.isSuccess
            if (sent) dao.markAccessEventSynced(event.id)
        }
    }

    private fun WorkoutLog.toEntity() = WorkoutLogEntity(
        id = id,
        exerciseId = exerciseId,
        exerciseName = exerciseName,
        sets = sets,
        reps = reps,
        weightKg = weightKg,
        rpe = rpe,
        loggedAt = loggedAt,
        synced = synced,
    )

    private fun WorkoutLogEntity.toDomain() = WorkoutLog(
        id = id,
        exerciseId = exerciseId,
        exerciseName = exerciseName,
        sets = sets,
        reps = reps,
        weightKg = weightKg,
        rpe = rpe,
        loggedAt = loggedAt,
        synced = synced,
    )

    private fun Routine.toEntity() = RoutineEntity(
        id = id,
        dayOfWeek = dayOfWeek,
        title = title,
        exercisesJson = exercisesAdapter.toJson(exercises),
        durationMinutes = durationMinutes,
        cachedAt = System.currentTimeMillis(),
    )
}
