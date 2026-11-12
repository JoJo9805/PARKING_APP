package com.iotparking.app.core.notification

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.iotparking.app.MainActivity
import com.iotparking.app.R
import com.iotparking.app.widget.ParkingWidgetReceiver
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class ParkingMessagingService : FirebaseMessagingService() {

    @Inject
    lateinit var ongoingSessionNotifier: OngoingSessionNotifier

    @Inject
    lateinit var auth: FirebaseAuth

    @Inject
    lateinit var firestore: FirebaseFirestore

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        val uid = auth.currentUser?.uid ?: return
        firestore.collection("users").document(uid)
            .update("fcmTokens", FieldValue.arrayUnion(token))
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        val data = remoteMessage.data
        if (data.isEmpty()) return

        val type = data["type"] ?: return

        when (type) {
            "VEHICLE_ENTERED" -> handleVehicleEntered(data)
            "VEHICLE_EXITED" -> handleVehicleExited(data)
            "RESERVATION_EXPIRING" -> handleReservationExpiring(data)
            "RESERVATION_EXPIRED" -> handleReservationExpired(data)
            "PLANNED_DURATION_NEAR" -> handlePlannedDurationNear(data)
            "WALLET_CHANGED" -> handleWalletChanged(data)
        }
    }

    private fun handleVehicleEntered(data: Map<String, String>) {
        val sessionId = data["sessionId"] ?: ""
        val lotName = data["lotName"] ?: ""
        val slotCode = data["slotCode"] ?: ""
        val plate = data["plate"] ?: ""
        val entryTimeMs = data["entryTimeMs"]?.toLongOrNull() ?: System.currentTimeMillis()

        // 1. Dựng thông báo sự kiện xe vào
        val openIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("navigate_to", "active_session")
            putExtra("session_id", sessionId)
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 101, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, NotificationChannels.PARKING_EVENTS)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(getString(R.string.notif_vehicle_entered_title, plate))
            .setContentText(getString(R.string.notif_vehicle_entered_body, lotName, slotCode))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        try {
            NotificationManagerCompat.from(this).notify(sessionId.hashCode(), notification)
        } catch (_: SecurityException) { }

        // 2. Bật Ongoing Notification
        ongoingSessionNotifier.show(sessionId, lotName, slotCode, entryTimeMs)

        // 3. Cập nhật Widget
        ParkingWidgetReceiver.update(this)
    }

    private fun handleVehicleExited(data: Map<String, String>) {
        val sessionId = data["sessionId"] ?: ""
        val invoiceId = data["invoiceId"] ?: ""
        val amountPaid = data["amountPaid"] ?: "0"
        val depositRefund = data["depositRefund"] ?: "0"

        // 1. Tắt Ongoing Notification
        ongoingSessionNotifier.cancel()

        // 2. Dựng thông báo xe ra kèm nút mở hóa đơn
        val openIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("navigate_to", "invoice_detail")
            putExtra("session_id", sessionId)
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 102, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val body = if (depositRefund.toLongOrNull() ?: 0L > 0) {
            getString(R.string.notif_vehicle_exited_body_refund, amountPaid, depositRefund)
        } else {
            getString(R.string.notif_vehicle_exited_body, amountPaid)
        }

        val notification = NotificationCompat.Builder(this, NotificationChannels.PARKING_EVENTS)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(getString(R.string.notif_vehicle_exited_title))
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        try {
            NotificationManagerCompat.from(this).notify(sessionId.hashCode() + 1, notification)
        } catch (_: SecurityException) { }

        // 3. Cập nhật Widget
        ParkingWidgetReceiver.update(this)
    }

    private fun handleReservationExpiring(data: Map<String, String>) {
        val reservationId = data["reservationId"] ?: ""
        val lotName = data["lotName"] ?: ""
        val slotCode = data["slotCode"] ?: ""
        val canExtend = data["canExtend"] != "false"

        val openIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("navigate_to", "active_reservation")
            putExtra("reservation_id", reservationId)
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 103, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(this, NotificationChannels.RESERVATION)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(getString(R.string.notif_reservation_expiring_title))
            .setContentText(getString(R.string.notif_reservation_expiring_body, lotName, slotCode))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)

        // Nút hành động "Gia hạn +15p" nếu còn lượt
        if (canExtend) {
            val extendIntent = Intent(this, ActionReceiver::class.java).apply {
                action = ActionReceiver.ACTION_EXTEND_RESERVATION
                putExtra(ActionReceiver.EXTRA_RESERVATION_ID, reservationId)
            }
            val extendPendingIntent = PendingIntent.getBroadcast(
                this, 104, extendIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            builder.addAction(
                R.drawable.ic_notification,
                getString(R.string.action_extend_15m),
                extendPendingIntent
            )
        }

        try {
            NotificationManagerCompat.from(this).notify(reservationId.hashCode(), builder.build())
        } catch (_: SecurityException) { }
    }

    private fun handleReservationExpired(data: Map<String, String>) {
        val reservationId = data["reservationId"] ?: ""
        val lotName = data["lotName"] ?: ""
        val slotCode = data["slotCode"] ?: ""

        val notification = NotificationCompat.Builder(this, NotificationChannels.RESERVATION)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(getString(R.string.notif_reservation_expired_title))
            .setContentText(getString(R.string.notif_reservation_expired_body, lotName, slotCode))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .build()

        try {
            NotificationManagerCompat.from(this).notify(reservationId.hashCode(), notification)
        } catch (_: SecurityException) { }

        ParkingWidgetReceiver.update(this)
    }

    private fun handlePlannedDurationNear(data: Map<String, String>) {
        val sessionId = data["sessionId"] ?: ""
        val lotName = data["lotName"] ?: ""
        val slotCode = data["slotCode"] ?: ""

        val openIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("navigate_to", "active_session")
            putExtra("session_id", sessionId)
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 105, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Nút "Gia hạn +30p"
        val ext30Intent = Intent(this, ActionReceiver::class.java).apply {
            action = ActionReceiver.ACTION_EXTEND_SESSION_30
            putExtra(ActionReceiver.EXTRA_SESSION_ID, sessionId)
        }
        val ext30Pending = PendingIntent.getBroadcast(
            this, 106, ext30Intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Nút "Gia hạn +1h"
        val ext60Intent = Intent(this, ActionReceiver::class.java).apply {
            action = ActionReceiver.ACTION_EXTEND_SESSION_60
            putExtra(ActionReceiver.EXTRA_SESSION_ID, sessionId)
        }
        val ext60Pending = PendingIntent.getBroadcast(
            this, 107, ext60Intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, NotificationChannels.REMINDERS)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(getString(R.string.notif_planned_near_title))
            .setContentText(getString(R.string.notif_planned_near_body, lotName, slotCode))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .addAction(R.drawable.ic_notification, getString(R.string.action_extend_30m), ext30Pending)
            .addAction(R.drawable.ic_notification, getString(R.string.action_extend_1h), ext60Pending)
            .build()

        try {
            NotificationManagerCompat.from(this).notify(sessionId.hashCode() + 2, notification)
        } catch (_: SecurityException) { }
    }

    private fun handleWalletChanged(data: Map<String, String>) {
        val delta = data["delta"] ?: ""
        val newBalance = data["newBalance"] ?: ""
        val reason = data["reason"] ?: ""

        val openIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("navigate_to", "wallet")
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 108, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, NotificationChannels.WALLET)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(getString(R.string.notif_wallet_changed_title))
            .setContentText(getString(R.string.notif_wallet_changed_body, delta, newBalance))
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        try {
            NotificationManagerCompat.from(this).notify(System.currentTimeMillis().toInt(), notification)
        } catch (_: SecurityException) { }
    }
}

