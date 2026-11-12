package com.iotparking.app.widget

import android.content.Context
import android.content.Intent
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.datastore.preferences.core.Preferences
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import com.iotparking.app.MainActivity

class ParkingGlanceWidget : GlanceAppWidget() {

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent {
            val prefs = currentState<Preferences>()
            val mode = prefs[ParkingWidgetStateHelper.KEY_WIDGET_MODE] ?: "IDLE"
            val lotName = prefs[ParkingWidgetStateHelper.KEY_LOT_NAME] ?: ""
            val slotCode = prefs[ParkingWidgetStateHelper.KEY_SLOT_CODE] ?: ""
            val timeInfo = prefs[ParkingWidgetStateHelper.KEY_TIME_INFO] ?: ""

            val openAppIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }

            GlanceTheme {
                Box(
                    modifier = GlanceModifier
                        .fillMaxSize()
                        .background(Color(0xFF1565C0))
                        .padding(16.dp)
                        .clickable(actionStartActivity<MainActivity>()),
                    contentAlignment = Alignment.CenterStart
                ) {
                    when (mode) {
                        "RESERVATION" -> {
                            Column(modifier = GlanceModifier.fillMaxWidth()) {
                                Text(
                                    text = "ĐANG GIỮ CHỖ",
                                    style = TextStyle(color = androidx.glance.unit.ColorProvider(Color(0xFFFFD54F)), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                )
                                Spacer(modifier = GlanceModifier.height(4.dp))
                                Text(
                                    text = lotName,
                                    style = TextStyle(color = androidx.glance.unit.ColorProvider(Color.White), fontSize = 16.sp, fontWeight = FontWeight.Bold)
                                )
                                Spacer(modifier = GlanceModifier.height(2.dp))
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        text = "Vị trí: $slotCode",
                                        style = TextStyle(color = androidx.glance.unit.ColorProvider(Color.White), fontSize = 13.sp)
                                    )
                                    Spacer(modifier = GlanceModifier.width(12.dp))
                                    Text(
                                        text = timeInfo,
                                        style = TextStyle(color = androidx.glance.unit.ColorProvider(Color(0xFFE0E0E0)), fontSize = 13.sp)
                                    )
                                }
                            }
                        }
                        "SESSION" -> {
                            Column(modifier = GlanceModifier.fillMaxWidth()) {
                                Text(
                                    text = "XE ĐANG ĐỖ",
                                    style = TextStyle(color = androidx.glance.unit.ColorProvider(Color(0xFF81C784)), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                )
                                Spacer(modifier = GlanceModifier.height(4.dp))
                                Text(
                                    text = lotName,
                                    style = TextStyle(color = androidx.glance.unit.ColorProvider(Color.White), fontSize = 16.sp, fontWeight = FontWeight.Bold)
                                )
                                Spacer(modifier = GlanceModifier.height(2.dp))
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        text = "Vị trí: $slotCode",
                                        style = TextStyle(color = androidx.glance.unit.ColorProvider(Color.White), fontSize = 13.sp)
                                    )
                                    Spacer(modifier = GlanceModifier.width(12.dp))
                                    Text(
                                        text = "Giờ vào: $timeInfo",
                                        style = TextStyle(color = androidx.glance.unit.ColorProvider(Color(0xFFE0E0E0)), fontSize = 13.sp)
                                    )
                                }
                            }
                        }
                        else -> {
                            Column(modifier = GlanceModifier.fillMaxWidth()) {
                                Text(
                                    text = "IOT SMART PARKING",
                                    style = TextStyle(color = androidx.glance.unit.ColorProvider(Color(0xFFBBDEFB)), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                )
                                Spacer(modifier = GlanceModifier.height(4.dp))
                                Text(
                                    text = "Không có xe đang đỗ",
                                    style = TextStyle(color = androidx.glance.unit.ColorProvider(Color.White), fontSize = 15.sp)
                                )
                                Spacer(modifier = GlanceModifier.height(4.dp))
                                Text(
                                    text = "Chạm để tìm bãi đỗ xe",
                                    style = TextStyle(color = androidx.glance.unit.ColorProvider(Color(0xFFE0E0E0)), fontSize = 12.sp)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

