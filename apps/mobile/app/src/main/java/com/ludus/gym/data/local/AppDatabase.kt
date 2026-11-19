package com.ludus.gym.data.local

import androidx.room.Dao
import androidx.room.Database
import androidx.room.Delete
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.RoomDatabase
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "cached_members")
data class MemberEntity(
    @PrimaryKey val id: String,
    val name: String,
    val email: String,
    val membershipStatus: String,
    val planName: String,
    val daysRemaining: Int,
    val cachedAt: Long,
)

@Entity(tableName = "routines")
data class RoutineEntity(
    @PrimaryKey val id: String,
    val dayOfWeek: Int,
    val title: String,
    val exercisesJson: String,
    val durationMinutes: Int,
    val cachedAt: Long,
)

@Entity(tableName = "workout_logs")
data class WorkoutLogEntity(
    @PrimaryKey val id: String,
    val exerciseId: String,
    val exerciseName: String,
    val sets: Int,
    val reps: Int,
    val weightKg: Double,
    val rpe: Int,
    val loggedAt: Long,
    val synced: Boolean,
)

@Entity(tableName = "qr_credentials")
data class QrCredentialEntity(
    @PrimaryKey val id: String = "current",
    val memberId: String,
    val bucket: Long,
    val expiresAt: Long,
    val signature: String,
    val raw: String,
    val createdAt: Long,
)

@Entity(tableName = "pending_sync")
data class PendingSyncEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val type: String,
    val payload: String,
    val createdAt: Long,
    val attempts: Int = 0,
)

@Entity(tableName = "access_events")
data class AccessEventEntity(
    @PrimaryKey val id: String,
    val memberId: String,
    val token: String,
    val scannedAt: Long,
    val synced: Boolean = false,
)

@Dao
interface LudusDao {
    @Query("SELECT * FROM cached_members LIMIT 1")
    fun observeMember(): Flow<MemberEntity?>

    @Query("SELECT * FROM cached_members WHERE id = :id")
    suspend fun member(id: String): MemberEntity?

    @Upsert
    suspend fun saveMember(member: MemberEntity)

    @Query("SELECT * FROM routines ORDER BY dayOfWeek ASC")
    fun observeRoutines(): Flow<List<RoutineEntity>>

    @Query("SELECT * FROM routines ORDER BY dayOfWeek ASC")
    suspend fun routinesOnce(): List<RoutineEntity>

    @Query("SELECT COUNT(*) FROM routines")
    suspend fun routineCount(): Int

    @Upsert
    suspend fun saveRoutines(routines: List<RoutineEntity>)

    @Query("SELECT * FROM workout_logs ORDER BY loggedAt DESC")
    fun observeWorkoutLogs(): Flow<List<WorkoutLogEntity>>

    @Query("SELECT * FROM workout_logs WHERE synced = 0")
    suspend fun unsyncedLogs(): List<WorkoutLogEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLog(log: WorkoutLogEntity)

    @Query("UPDATE workout_logs SET synced = 1 WHERE id = :id")
    suspend fun markLogSynced(id: String)

    @Query("SELECT * FROM qr_credentials WHERE id = 'current'")
    suspend fun qrCredential(): QrCredentialEntity?

    @Upsert
    suspend fun saveQrCredential(credential: QrCredentialEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun enqueueSync(item: PendingSyncEntity)

    @Query("SELECT * FROM pending_sync ORDER BY createdAt ASC LIMIT 100")
    suspend fun pendingSync(): List<PendingSyncEntity>

    @Query("UPDATE pending_sync SET attempts = attempts + 1 WHERE id = :id")
    suspend fun increaseAttempts(id: Long)

    @Delete
    suspend fun removeSync(item: PendingSyncEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAccessEvent(event: AccessEventEntity)

    @Query("SELECT * FROM access_events WHERE synced = 0 ORDER BY scannedAt ASC LIMIT 100")
    suspend fun unsyncedAccessEvents(): List<AccessEventEntity>

    @Query("UPDATE access_events SET synced = 1 WHERE id = :id")
    suspend fun markAccessEventSynced(id: String)
}

@Database(
    entities = [
        MemberEntity::class,
        RoutineEntity::class,
        WorkoutLogEntity::class,
        QrCredentialEntity::class,
        PendingSyncEntity::class,
        AccessEventEntity::class,
    ],
    version = 1,
    exportSchema = false,
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun dao(): LudusDao
}
