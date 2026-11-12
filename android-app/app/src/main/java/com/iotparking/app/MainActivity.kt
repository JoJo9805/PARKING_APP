package com.iotparking.app

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.lifecycleScope
import com.iotparking.app.core.data.datasource.PreferencesDataStore
import com.iotparking.app.core.data.repository.CloudFunctionRepository
import com.iotparking.app.core.designsystem.theme.ParkingAppTheme
import com.iotparking.app.core.notification.OngoingSessionNotifier
import com.iotparking.app.navigation.AppNavHost
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : AppCompatActivity() {

    @Inject
    lateinit var preferencesDataStore: PreferencesDataStore

    @Inject
    lateinit var cloudFunctionRepository: CloudFunctionRepository

    @Inject
    lateinit var ongoingSessionNotifier: OngoingSessionNotifier

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Đồng bộ thời gian với server khi khởi động app
        lifecycleScope.launch {
            cloudFunctionRepository.syncServerTime()
        }

        // Đối soát Ongoing notification chống kẹt
        lifecycleScope.launch {
            ongoingSessionNotifier.reconcile()
        }

        setContent {
            val themeMode by preferencesDataStore.themeMode.collectAsState(initial = "SYSTEM")
            val isDarkTheme = when (themeMode) {
                "DARK" -> true
                "LIGHT" -> false
                else -> isSystemInDarkTheme()
            }

            ParkingAppTheme(darkTheme = isDarkTheme) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    AppNavHost()
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        // Đồng bộ lại server time khi quay lại foreground
        lifecycleScope.launch {
            cloudFunctionRepository.syncServerTime()
            ongoingSessionNotifier.reconcile()
        }
    }
}

