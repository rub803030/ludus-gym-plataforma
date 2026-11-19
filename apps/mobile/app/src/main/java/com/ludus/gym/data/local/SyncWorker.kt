package com.ludus.gym.data.local

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.ludus.gym.LudusApplication

/** Sincroniza la cola de series y los eventos de acceso cuando vuelve la red. */
class SyncWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result = try {
        val container = (applicationContext as LudusApplication).container
        container.workoutRepository.syncPending()
        Result.success()
    } catch (error: Exception) {
        if (runAttemptCount < 3) Result.retry() else Result.failure()
    }

    companion object {
        private const val WORK_NAME = "ludus-offline-sync"

        fun enqueue(context: Context) {
            val request = OneTimeWorkRequestBuilder<SyncWorker>()
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build(),
                )
                .build()
            WorkManager.getInstance(context.applicationContext)
                .enqueueUniqueWork(WORK_NAME, ExistingWorkPolicy.KEEP, request)
        }
    }
}
