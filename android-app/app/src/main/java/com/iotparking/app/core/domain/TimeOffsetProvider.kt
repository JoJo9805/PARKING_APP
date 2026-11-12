package com.iotparking.app.core.domain

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Đồng bộ thời gian với server.
 * Lưu offset giữa thời gian local và server trong DataStore.
 */
@Singleton
class TimeOffsetProvider @Inject constructor(
    private val dataStore: DataStore<Preferences>
) {
    companion object {
        private val KEY_SERVER_TIME_OFFSET = longPreferencesKey("server_time_offset")
    }

    /**
     * Lấy thời gian server hiện tại (epoch ms).
     * serverNow() = System.currentTimeMillis() + offset
     */
    suspend fun serverNow(): Long {
        val offset = getOffset()
        return System.currentTimeMillis() + offset
    }

    /**
     * Cập nhật offset dựa trên thời gian server trả về.
     *
     * @param serverTimeMs Thời gian server trả về (epoch ms)
     * @param requestStartMs Thời gian bắt đầu request (epoch ms)
     * @param requestEndMs Thời gian kết thúc request (epoch ms)
     */
    suspend fun updateOffset(serverTimeMs: Long, requestStartMs: Long, requestEndMs: Long) {
        val localEstimate = (requestStartMs + requestEndMs) / 2
        val offset = serverTimeMs - localEstimate
        dataStore.edit { prefs ->
            prefs[KEY_SERVER_TIME_OFFSET] = offset
        }
    }

    /**
     * Lấy offset hiện tại từ DataStore.
     */
    private suspend fun getOffset(): Long {
        return dataStore.data.map { prefs ->
            prefs[KEY_SERVER_TIME_OFFSET] ?: 0L
        }.first()
    }

    /**
     * Lấy offset hiện tại dưới dạng Flow.
     */
    fun getOffsetFlow() = dataStore.data.map { prefs ->
        prefs[KEY_SERVER_TIME_OFFSET] ?: 0L
    }
}
