package com.iotparking.app.core.di

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.preferencesDataStore
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.storage.FirebaseStorage
import com.iotparking.app.core.network.ConnectivityManagerNetworkMonitor
import com.iotparking.app.core.network.NetworkMonitor
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "parking_preferences")

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    /**
     * Bật USE_EMULATOR = true khi chạy kiểm thử với Firebase Local Emulator Suite.
     * Đổi thành false khi muốn kết nối lên Firebase Cloud Production.
     */
    const val USE_EMULATOR = true

    /**
     * Địa chỉ IP của máy host chạy Firebase Emulator:
     * - "10.0.2.2": Mặc định cho máy ảo Android Studio (Android Virtual Device - AVD)
     * - "192.168.x.x": Thay bằng IP LAN máy tính nếu chạy trên điện thoại thật kết nối cùng WiFi
     */
    const val EMULATOR_HOST = "10.0.2.2"

    @Provides
    @Singleton
    fun provideDataStore(@ApplicationContext context: Context): DataStore<Preferences> {
        return context.dataStore
    }

    @Provides
    @Singleton
    fun provideFirebaseAuth(): FirebaseAuth {
        val auth = FirebaseAuth.getInstance()
        if (USE_EMULATOR) {
            try {
                auth.useEmulator(EMULATOR_HOST, 9099)
            } catch (e: Exception) {
                // Đã khởi tạo emulator trước đó
            }
        }
        return auth
    }

    @Provides
    @Singleton
    fun provideFirebaseFirestore(): FirebaseFirestore {
        val firestore = FirebaseFirestore.getInstance()
        if (USE_EMULATOR) {
            try {
                firestore.useEmulator(EMULATOR_HOST, 8080)
            } catch (e: Exception) {
                // Đã khởi tạo emulator trước đó
            }
        }
        return firestore
    }

    @Provides
    @Singleton
    fun provideFirebaseFunctions(): FirebaseFunctions {
        val functions = FirebaseFunctions.getInstance("asia-southeast1")
        if (USE_EMULATOR) {
            try {
                functions.useEmulator(EMULATOR_HOST, 5001)
            } catch (e: Exception) {
                // Đã khởi tạo emulator trước đó
            }
        }
        return functions
    }

    @Provides
    @Singleton
    fun provideFirebaseStorage(): FirebaseStorage {
        val storage = FirebaseStorage.getInstance()
        if (USE_EMULATOR) {
            try {
                storage.useEmulator(EMULATOR_HOST, 9199)
            } catch (e: Exception) {
                // Đã khởi tạo emulator trước đó
            }
        }
        return storage
    }

    @Provides
    @Singleton
    fun provideNetworkMonitor(networkMonitor: ConnectivityManagerNetworkMonitor): NetworkMonitor {
        return networkMonitor
    }
}

