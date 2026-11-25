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
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
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
    val gymId: String? = null,
)

@Entity(tableName = "gyms")
data class GymEntity(
    @PrimaryKey val id: String,
    val name: String,
    val publicCode: String? = null,
    val status: String = "ACTIVE",
    val cachedAt: Long = 0L,
)

@Entity(tableName = "active_gym")
data class ActiveGymEntity(
    @PrimaryKey val id: String = "active",
    val gymId: String,
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
    val expiresAtMillis: Long,
    val raw: String,
    val cachedAt: Long,
    val gymId: String? = null,
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

    @Query("SELECT * FROM gyms ORDER BY name ASC")
    fun observeGyms(): Flow<List<GymEntity>>

    @Query("SELECT * FROM gyms ORDER BY name ASC")
    suspend fun gymsOnce(): List<GymEntity>

    @Upsert
    suspend fun saveGyms(gyms: List<GymEntity>)

    @Query("SELECT * FROM active_gym WHERE id = 'active'")
    fun observeActiveGym(): Flow<ActiveGymEntity?>

    @Query("SELECT * FROM active_gym WHERE id = 'active'")
    suspend fun activeGym(): ActiveGymEntity?

    @Upsert
    suspend fun saveActiveGym(active: ActiveGymEntity)

    @Query("DELETE FROM active_gym")
    suspend fun clearActiveGym()

    @Query("DELETE FROM gyms")
    suspend fun clearGyms()

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
        GymEntity::class,
        ActiveGymEntity::class,
        RoutineEntity::class,
        WorkoutLogEntity::class,
        QrCredentialEntity::class,
        PendingSyncEntity::class,
        AccessEventEntity::class,
    ],
    version = 3,
    exportSchema = false,
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun dao(): LudusDao
}

val MIGRATION_2_3 = object : Migration(2, 3) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE cached_members ADD COLUMN gymId TEXT")
        db.execSQL("ALTER TABLE qr_credentials ADD COLUMN gymId TEXT")
        db.execSQL(
            "CREATE TABLE IF NOT EXISTS gyms (" +
                "id TEXT PRIMARY KEY NOT NULL, " +
                "name TEXT NOT NULL, " +
                "publicCode TEXT, " +
                "status TEXT NOT NULL, " +
                "cachedAt INTEGER NOT NULL)",
        )
        db.execSQL(
            "CREATE TABLE IF NOT EXISTS active_gym (" +
                "id TEXT PRIMARY KEY NOT NULL, " +
                "gymId TEXT NOT NULL)",
        )
    }
}
