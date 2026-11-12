package com.iotparking.app.feature.history

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.iotparking.app.core.data.repository.AuthRepository
import com.iotparking.app.core.data.repository.SessionRepository
import com.iotparking.app.core.data.repository.VehicleRepository
import com.iotparking.app.core.domain.model.Session
import com.iotparking.app.core.domain.model.Vehicle
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import javax.inject.Inject

data class MonthlySpending(
    val monthLabel: String,
    val totalAmount: Long
)

data class HistoryUiState(
    val sessions: List<Session> = emptyList(),
    val filteredSessions: List<Session> = emptyList(),
    val vehicles: List<Vehicle> = emptyList(),
    val selectedVehiclePlate: String? = null,
    val selectedMonthYear: String? = null, // e.g., "11/2026"
    val selectedSession: Session? = null,
    val monthlyStats: List<MonthlySpending> = emptyList(),
    val totalTrips: Int = 0,
    val totalSpent: Long = 0L,
    val averageDurationMinutes: Int = 0,
    val isLoading: Boolean = true
)

@HiltViewModel
class HistoryViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val sessionRepository: SessionRepository,
    private val vehicleRepository: VehicleRepository,
    private val authRepository: AuthRepository
) : ViewModel() {

    private val sessionId: String? = savedStateHandle["sessionId"]
    private val _uiState = MutableStateFlow(HistoryUiState())
    val uiState: StateFlow<HistoryUiState> = _uiState.asStateFlow()

    init {
        loadData()
    }

    private fun loadData() {
        val uid = authRepository.currentUserId ?: return

        // Load specific session if sessionId is provided (for InvoiceDetail)
        if (sessionId != null) {
            viewModelScope.launch {
                sessionRepository.getSessionStream(sessionId).collect { session ->
                    _uiState.update { it.copy(selectedSession = session, isLoading = false) }
                }
            }
        }

        // Load vehicles
        viewModelScope.launch {
            vehicleRepository.getVehiclesStream(uid).collect { vehicles ->
                _uiState.update { it.copy(vehicles = vehicles) }
            }
        }

        // Load completed sessions
        viewModelScope.launch {
            sessionRepository.getCompletedSessionsStream(uid).collect { sessions ->
                _uiState.update { state ->
                    val filtered = applyFilter(sessions, state.selectedVehiclePlate, state.selectedMonthYear)
                    val stats = calculateStats(sessions)
                    state.copy(
                        sessions = sessions,
                        filteredSessions = filtered,
                        monthlyStats = stats.monthlySpending,
                        totalTrips = sessions.size,
                        totalSpent = sessions.sumOf { it.amountCharged ?: it.fee ?: 0L },
                        averageDurationMinutes = if (sessions.isNotEmpty()) sessions.sumOf { it.durationMin ?: 0 } / sessions.size else 0,
                        isLoading = false
                    )
                }
            }
        }
    }

    fun selectVehicleFilter(plate: String?) {
        _uiState.update { state ->
            val filtered = applyFilter(state.sessions, plate, state.selectedMonthYear)
            state.copy(selectedVehiclePlate = plate, filteredSessions = filtered)
        }
    }

    fun selectMonthYearFilter(monthYear: String?) {
        _uiState.update { state ->
            val filtered = applyFilter(state.sessions, state.selectedVehiclePlate, monthYear)
            state.copy(selectedMonthYear = monthYear, filteredSessions = filtered)
        }
    }

    private fun applyFilter(
        sessions: List<Session>,
        plate: String?,
        monthYear: String?
    ): List<Session> {
        var result = sessions
        if (plate != null) {
            result = result.filter { it.plate.equals(plate, ignoreCase = true) }
        }
        if (monthYear != null) {
            val sdf = SimpleDateFormat("MM/yyyy", Locale.getDefault())
            result = result.filter {
                val date = Date(it.exitTime ?: it.entryTime)
                sdf.format(date) == monthYear
            }
        }
        return result
    }

    private data class StatsResult(
        val monthlySpending: List<MonthlySpending>
    )

    private fun calculateStats(sessions: List<Session>): StatsResult {
        val sdf = SimpleDateFormat("MM/yy", Locale.getDefault())
        val monthlyMap = mutableMapOf<String, Long>()

        // Last 6 months
        val cal = Calendar.getInstance()
        for (i in 0..5) {
            val key = sdf.format(cal.time)
            monthlyMap[key] = 0L
            cal.add(Calendar.MONTH, -1)
        }

        sessions.forEach { s ->
            val date = Date(s.exitTime ?: s.entryTime)
            val key = sdf.format(date)
            if (monthlyMap.containsKey(key)) {
                monthlyMap[key] = (monthlyMap[key] ?: 0L) + (s.amountCharged ?: s.fee ?: 0L)
            }
        }

        val list = monthlyMap.entries.reversed().map {
            MonthlySpending(it.key, it.value)
        }
        return StatsResult(list)
    }
}

