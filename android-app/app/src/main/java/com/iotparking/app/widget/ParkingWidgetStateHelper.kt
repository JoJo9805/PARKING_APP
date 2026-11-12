package com.iotparking.app.widget

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.state.updateAppWidgetState
import com.iotparking.app.core.domain.model.Reservation
import com.iotparking.app.core.domain.model.Session

object ParkingWidgetStateHelper {

    val KEY_WIDGET_MODE = stringPreferencesKey("widget_mode") // "IDLE", "RESERVATION", "SESSION"
    val KEY_LOT_NAME = stringPreferencesKey("widget_lot_name")
    val KEY_SLOT_CODE = stringPreferencesKey("widget_slot_code")
    val KEY_TIME_INFO = stringPreferencesKey("widget_time_info")

    suspend fun updateState(
        context: Context,
        mode: String,
        lotName: String = "",
        slotCode: String = "",
        timeInfo: String = ""
    ) {
        val manager = GlanceAppWidgetManager(context)
        val glanceIds = manager.getGlanceIds(ParkingGlanceWidget::class.java)

        glanceIds.forEach { glanceId ->
            updateAppWidgetState(context, glanceId) { prefs ->
                prefs[KEY_WIDGET_MODE] = mode
                prefs[KEY_LOT_NAME] = lotName
                prefs[KEY_SLOT_CODE] = slotCode
                prefs[KEY_TIME_INFO] = timeInfo
            }
            ParkingGlanceWidget().update(context, glanceId)
        }
    }
}

