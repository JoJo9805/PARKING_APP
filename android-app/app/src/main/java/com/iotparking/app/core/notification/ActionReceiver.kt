package com.iotparking.app.core.notification

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.OutOfQuotaPolicy
import androidx.work.WorkManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * BroadcastReceiver xử lý hành động từ nút bấm trên thông báo.
 *
 * Các hành động được hỗ trợ:
 * - ACTION_EXTEND_RESERVATION: Gia hạn đặt chỗ thêm 15 phút
 * - ACTION_EXTEND_SESSION_30: Gia hạn phiên đỗ xe thêm 30 phút
 * - ACTION_EXTEND_SESSION_60: Gia hạn phiên đỗ xe thêm 60 phút
 * - ACTION_DISMISS_ONGOING: Lưu sessionId đã dismiss vào DataStore
 */
@AndroidEntryPoint
class ActionReceiver : BroadcastReceiver() {

    @Inject
    lateinit var dataStore: DataStore<Preferences>

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    companion object {
        const val ACTION_EXTEND_RESERVATION = "com.iotparking.app.ACTION_EXTEND_RESERVATION"
        const val ACTION_EXTEND_SESSION_30 = "com.iotparking.app.ACTION_EXTEND_SESSION_30"
        const val ACTION_EXTEND_SESSION_60 = "com.iotparking.app.ACTION_EXTEND_SESSION_60"
        const val ACTION_DISMISS_ONGOING = "com.iotparking.app.ACTION_DISMISS_ONGOING"

        const val EXTRA_RESERVATION_ID = "reservation_id"
        const val EXTRA_SESSION_ID = "session_id"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val workManager = WorkManager.getInstance(context)

        when (intent.action) {
            ACTION_EXTEND_RESERVATION -> {
                val reservationId = intent.getStringExtra(EXTRA_RESERVATION_ID) ?: return
                val inputData = Data.Builder()
                    .putString(ExtendReservationWorker.KEY_RESERVATION_ID, reservationId)
                    .build()

                val request = OneTimeWorkRequestBuilder<ExtendReservationWorker>()
                    .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
                    .setInputData(inputData)
                    .build()

                workManager.enqueueUniqueWork(
                    "extend_reservation_$reservationId",
                    ExistingWorkPolicy.REPLACE,
                    request
                )
            }

            ACTION_EXTEND_SESSION_30 -> {
                val sessionId = intent.getStringExtra(EXTRA_SESSION_ID) ?: return
                enqueueExtendSession(workManager, sessionId, 30)
            }

            ACTION_EXTEND_SESSION_60 -> {
                val sessionId = intent.getStringExtra(EXTRA_SESSION_ID) ?: return
                enqueueExtendSession(workManager, sessionId, 60)
            }

            ACTION_DISMISS_ONGOING -> {
                val sessionId = intent.getStringExtra(EXTRA_SESSION_ID) ?: return
                scope.launch {
                    dataStore.edit { prefs ->
                        prefs[OngoingSessionNotifier.KEY_DISMISSED_SESSION] = sessionId
                    }
                }
            }
        }
    }

    private fun enqueueExtendSession(
        workManager: WorkManager,
        sessionId: String,
        addMinutes: Int
    ) {
        val inputData = Data.Builder()
            .putString(ExtendSessionWorker.KEY_SESSION_ID, sessionId)
            .putInt(ExtendSessionWorker.KEY_ADD_MINUTES, addMinutes)
            .build()

        val request = OneTimeWorkRequestBuilder<ExtendSessionWorker>()
            .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
            .setInputData(inputData)
            .build()

        workManager.enqueueUniqueWork(
            "extend_session_${sessionId}_$addMinutes",
            ExistingWorkPolicy.REPLACE,
            request
        )
    }
}
