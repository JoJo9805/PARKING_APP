package com.iotparking.app.core.data.datasource

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PreferencesDataStore @Inject constructor(
    private val dataStore: DataStore<Preferences>
) {
    companion object {
        val KEY_THEME = stringPreferencesKey("theme_mode") // "SYSTEM", "LIGHT", "DARK"
        val KEY_LOCALE = stringPreferencesKey("app_locale") // "vi", "en"
        val KEY_SERVER_TIME_OFFSET = longPreferencesKey("server_time_offset")
        val KEY_ONGOING_DISMISSED_SESSION_ID = stringPreferencesKey("ongoing_dismissed_session_id")
        val KEY_REMINDER_ENABLED = booleanPreferencesKey("reminder_enabled")
        val KEY_REMINDER_MINUTES = intPreferencesKey("reminder_minutes")
        val KEY_FIRST_LAUNCH = booleanPreferencesKey("is_first_launch")
    }

    val themeMode: Flow<String> = dataStore.data.map { it[KEY_THEME] ?: "SYSTEM" }
    suspend fun setThemeMode(mode: String) {
        dataStore.edit { it[KEY_THEME] = mode }
    }

    val locale: Flow<String> = dataStore.data.map { it[KEY_LOCALE] ?: "vi" }
    suspend fun setLocale(loc: String) {
        dataStore.edit { it[KEY_LOCALE] = loc }
    }

    val serverTimeOffset: Flow<Long> = dataStore.data.map { it[KEY_SERVER_TIME_OFFSET] ?: 0L }
    suspend fun setServerTimeOffset(offset: Long) {
        dataStore.edit { it[KEY_SERVER_TIME_OFFSET] = offset }
    }

    val ongoingDismissedSessionId: Flow<String?> = dataStore.data.map { it[KEY_ONGOING_DISMISSED_SESSION_ID] }
    suspend fun setOngoingDismissedSessionId(sessionId: String?) {
        dataStore.edit {
            if (sessionId != null) {
                it[KEY_ONGOING_DISMISSED_SESSION_ID] = sessionId
            } else {
                it.remove(KEY_ONGOING_DISMISSED_SESSION_ID)
            }
        }
    }

    val reminderEnabled: Flow<Boolean> = dataStore.data.map { it[KEY_REMINDER_ENABLED] ?: true }
    suspend fun setReminderEnabled(enabled: Boolean) {
        dataStore.edit { it[KEY_REMINDER_ENABLED] = enabled }
    }

    val reminderMinutes: Flow<Int> = dataStore.data.map { it[KEY_REMINDER_MINUTES] ?: 10 }
    suspend fun setReminderMinutes(minutes: Int) {
        dataStore.edit { it[KEY_REMINDER_MINUTES] = minutes }
    }

    val isFirstLaunch: Flow<Boolean> = dataStore.data.map { it[KEY_FIRST_LAUNCH] ?: true }
    suspend fun setFirstLaunchCompleted() {
        dataStore.edit { it[KEY_FIRST_LAUNCH] = false }
    }

    suspend fun clearSessionData() {
        dataStore.edit {
            it.remove(KEY_ONGOING_DISMISSED_SESSION_ID)
            it.remove(KEY_SERVER_TIME_OFFSET)
        }
    }
}

