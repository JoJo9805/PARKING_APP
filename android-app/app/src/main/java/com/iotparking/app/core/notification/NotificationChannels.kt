package com.iotparking.app.core.notification

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import androidx.core.content.getSystemService
import com.iotparking.app.R

/**
 * Tạo và quản lý các kênh thông báo cho ứng dụng.
 *
 * Mỗi kênh phục vụ một loại sự kiện khác nhau:
 * - parking_events: Xe vào/ra bãi
 * - reservation: Đặt chỗ sắp hết hạn/đã hết hạn
 * - reminders: Nhắc nhở thời gian đỗ xe
 * - wallet: Thay đổi ví
 * - ongoing_session: Thông báo phiên đỗ xe đang hoạt động
 */
object NotificationChannels {

    const val PARKING_EVENTS = "parking_events"
    const val RESERVATION = "reservation"
    const val REMINDERS = "reminders"
    const val WALLET = "wallet"
    const val ONGOING_SESSION = "ongoing_session"

    /**
     * Tạo tất cả kênh thông báo. Nên gọi trong Application.onCreate().
     */
    fun createAll(context: Context) {
        val manager = context.getSystemService<NotificationManager>() ?: return

        val channels = listOf(
            NotificationChannel(
                PARKING_EVENTS,
                context.getString(R.string.notif_channel_parking_events),
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = context.getString(R.string.notif_channel_parking_events_desc)
                enableVibration(true)
                setShowBadge(true)
            },
            NotificationChannel(
                RESERVATION,
                context.getString(R.string.notif_channel_reservation),
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = context.getString(R.string.notif_channel_reservation_desc)
                enableVibration(true)
                setShowBadge(true)
            },
            NotificationChannel(
                REMINDERS,
                context.getString(R.string.notif_channel_reminders),
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = context.getString(R.string.notif_channel_reminders_desc)
                enableVibration(true)
                setShowBadge(false)
            },
            NotificationChannel(
                WALLET,
                context.getString(R.string.notif_channel_wallet),
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = context.getString(R.string.notif_channel_wallet_desc)
                enableVibration(false)
                setShowBadge(true)
            },
            NotificationChannel(
                ONGOING_SESSION,
                context.getString(R.string.notif_channel_ongoing_session),
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = context.getString(R.string.notif_channel_ongoing_session_desc)
                enableVibration(false)
                setShowBadge(false)
            }
        )

        manager.createNotificationChannels(channels)
    }
}
