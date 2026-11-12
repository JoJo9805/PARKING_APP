package com.iotparking.app.core.notification

import android.content.Context
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.iotparking.app.R
import com.iotparking.app.core.data.repository.CloudFunctionRepository
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject

@HiltWorker
class ExtendSessionWorker @AssistedInject constructor(
    @Assisted private val context: Context,
    @Assisted params: WorkerParameters,
    private val cloudFunctionRepository: CloudFunctionRepository
) : CoroutineWorker(context, params) {

    companion object {
        const val KEY_SESSION_ID = "session_id"
        const val KEY_ADD_MINUTES = "add_minutes"
    }

    override suspend fun doWork(): Result {
        val sessionId = inputData.getString(KEY_SESSION_ID) ?: return Result.failure()
        val addMinutes = inputData.getInt(KEY_ADD_MINUTES, 30)

        return try {
            val result = cloudFunctionRepository.extendPlannedDuration(sessionId, addMinutes)
            if (result.isSuccess) {
                val notification = NotificationCompat.Builder(context, NotificationChannels.REMINDERS)
                    .setSmallIcon(R.drawable.ic_notification)
                    .setContentTitle(context.getString(R.string.session_extended_title))
                    .setContentText(context.getString(R.string.session_extended_body, addMinutes))
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setAutoCancel(true)
                    .build()

                try {
                    NotificationManagerCompat.from(context).notify(sessionId.hashCode(), notification)
                } catch (_: SecurityException) { }

                Result.success()
            } else {
                showErrorNotification(context.getString(R.string.extend_failed))
                Result.failure()
            }
        } catch (e: Exception) {
            showErrorNotification(e.message ?: context.getString(R.string.extend_failed))
            Result.failure()
        }
    }

    private fun showErrorNotification(msg: String) {
        val notification = NotificationCompat.Builder(context, NotificationChannels.REMINDERS)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(context.getString(R.string.error_dialog_title))
            .setContentText(msg)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .build()

        try {
            NotificationManagerCompat.from(context).notify(System.currentTimeMillis().toInt(), notification)
        } catch (_: SecurityException) { }
    }
}

