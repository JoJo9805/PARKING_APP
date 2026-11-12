package com.iotparking.app.core.notification

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject

@HiltWorker
class ReconcileWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val ongoingSessionNotifier: OngoingSessionNotifier
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        return try {
            ongoingSessionNotifier.reconcile()
            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }
}

