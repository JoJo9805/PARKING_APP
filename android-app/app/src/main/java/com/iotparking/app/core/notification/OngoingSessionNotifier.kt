package com.iotparking.app.core.notification

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.SystemClock
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import androidx.core.content.getSystemService
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.iotparking.app.R
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Quản lý thông báo phiên đỗ xe đang hoạt động với Chronometer đếm thời gian.
 *
 * - Hiển thị tên bãi, mã chỗ, thời gian đã đỗ (Chronometer)
 * - setOngoing(true) để giữ thông báo cố định
 * - Xử lý dismiss trên Android 14+ qua deleteIntent
 * - Lưu sessionId đã dismiss vào DataStore để không hiển thị lại
 * - reconcile(): kiểm tra phiên hoạt động, hủy nếu không còn
 */
@Singleton
class OngoingSessionNotifier @Inject constructor(
    @ApplicationContext private val context: Context,
    private val dataStore: DataStore<Preferences>,
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth
) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val manager: NotificationManager? = context.getSystemService()

    companion object {
        const val NOTIFICATION_ID = 9001
        val KEY_DISMISSED_SESSION = stringPreferencesKey("dismissed_ongoing_session_id")
    }

    /**
     * Hiển thị thông báo ongoing với Chronometer đếm từ thời điểm xe vào.
     *
     * @param sessionId ID phiên đỗ xe
     * @param lotName Tên bãi đỗ xe
     * @param slotCode Mã chỗ đỗ
     * @param entryTimeMillis Thời điểm xe vào (server timestamp) tính bằng millis
     */
    fun show(
        sessionId: String,
        lotName: String,
        slotCode: String,
        entryTimeMillis: Long
    ) {
        scope.launch {
            // Kiểm tra nếu session này đã bị dismiss, không hiển thị lại
            val dismissedId = dataStore.data
                .map { it[KEY_DISMISSED_SESSION] }
                .first()
            if (dismissedId == sessionId) return@launch

            showNotification(sessionId, lotName, slotCode, entryTimeMillis)
        }
    }

    private fun showNotification(
        sessionId: String,
        lotName: String,
        slotCode: String,
        entryTimeMillis: Long
    ) {
        // Tính offset để Chronometer hiển thị đúng thời gian từ server
        val now = System.currentTimeMillis()
        val elapsed = now - entryTimeMillis
        val chronoBase = SystemClock.elapsedRealtime() - elapsed

        // Intent mở ứng dụng tại màn hình phiên đang hoạt động
        val openIntent = context.packageManager
            .getLaunchIntentForPackage(context.packageName)
            ?.apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("navigate_to", "active_session")
                putExtra("session_id", sessionId)
            }

        val openPending = PendingIntent.getActivity(
            context,
            NOTIFICATION_ID,
            openIntent ?: Intent(),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Intent xử lý khi người dùng vuốt bỏ thông báo (Android 14+)
        val dismissIntent = Intent(ActionReceiver.ACTION_DISMISS_ONGOING).apply {
            setPackage(context.packageName)
            putExtra("session_id", sessionId)
        }
        val dismissPending = PendingIntent.getBroadcast(
            context,
            NOTIFICATION_ID + 1,
            dismissIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, NotificationChannels.ONGOING_SESSION)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(context.getString(R.string.notif_ongoing_title, lotName))
            .setContentText(context.getString(R.string.notif_ongoing_text, slotCode))
            .setWhen(entryTimeMillis)
            .setUsesChronometer(true)
            .setChronometerCountDown(false)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setContentIntent(openPending)
            .setDeleteIntent(dismissPending)
            .setShowWhen(true)
            .setSilent(true)
            .build()

        manager?.notify(NOTIFICATION_ID, notification)
    }

    /**
     * Hủy thông báo ongoing.
     */
    fun cancel() {
        manager?.cancel(NOTIFICATION_ID)
    }

    /**
     * Lưu sessionId đã bị dismiss vào DataStore.
     */
    suspend fun saveDismissed(sessionId: String) {
        dataStore.edit { prefs ->
            prefs[KEY_DISMISSED_SESSION] = sessionId
        }
    }

    /**
     * Xóa sessionId đã dismiss khỏi DataStore (khi có phiên mới).
     */
    suspend fun clearDismissed() {
        dataStore.edit { prefs ->
            prefs.remove(KEY_DISMISSED_SESSION)
        }
    }

    /**
     * Kiểm tra xem có phiên đỗ xe đang hoạt động không.
     * Nếu không còn phiên nào, hủy thông báo.
     * Nếu có phiên nhưng đã dismiss, không hiển thị lại.
     *
     * Gọi khi: mở app, nhận FCM, WorkManager periodic (15 phút).
     */
    suspend fun reconcile() {
        val uid = auth.currentUser?.uid ?: run {
            cancel()
            return
        }

        try {
            val sessionsSnapshot = firestore.collection("sessions")
                .whereEqualTo("uid", uid)
                .whereEqualTo("status", "active")
                .limit(1)
                .get()
                .await()

            if (sessionsSnapshot.isEmpty) {
                cancel()
                clearDismissed()
                return
            }

            val session = sessionsSnapshot.documents.first()
            val sessionId = session.id
            val dismissedId = dataStore.data
                .map { it[KEY_DISMISSED_SESSION] }
                .first()

            // Nếu đã dismiss thì không hiển thị lại
            if (dismissedId == sessionId) return

            // Hiển thị lại nếu cần
            val lotName = session.getString("lotName") ?: ""
            val slotCode = session.getString("slotCode") ?: ""
            val entryTime = session.getTimestamp("entryTime")
            val entryMillis = entryTime?.toDate()?.time ?: System.currentTimeMillis()

            showNotification(sessionId, lotName, slotCode, entryMillis)
        } catch (_: Exception) {
            // Lỗi mạng — giữ nguyên trạng thái thông báo hiện tại
        }
    }
}
