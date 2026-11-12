package com.iotparking.app

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import com.iotparking.app.core.notification.NotificationChannels
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

/**
 * Lớp Application chính của IOT Parking App.
 * Khởi tạo Hilt, các kênh thông báo và WorkManager.
 */
@HiltAndroidApp
class ParkingApp : Application(), Configuration.Provider {

    @Inject
    lateinit var workerFactory: HiltWorkerFactory

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()

    override fun onCreate() {
        super.onCreate()
        // Khởi tạo các notification channel
        NotificationChannels.createAll(this)
    }
}

