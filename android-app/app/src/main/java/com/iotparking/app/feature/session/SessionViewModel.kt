package com.iotparking.app.feature.session

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.iotparking.app.core.data.repository.AuthRepository
import com.iotparking.app.core.data.repository.LotRepository
import com.iotparking.app.core.data.repository.SessionRepository
import com.iotparking.app.core.domain.FeeCalculator
import com.iotparking.app.core.domain.FeeResult
import com.iotparking.app.core.domain.TimeOffsetProvider
import com.iotparking.app.core.domain.model.Lot
import com.iotparking.app.core.domain.model.Session
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SessionUiState(
    val session: Session? = null,
    val lot: Lot? = null,
    val elapsedSeconds: Long = 0L,
    val feeResult: FeeResult? = null,
    val plannedRemainingMinutes: Long? = null,
    val isLoading: Boolean = false,
    val errorMessage: String? = null
)

@HiltViewModel
class SessionViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val sessionRepository: SessionRepository,
    private val lotRepository: LotRepository,
    private val authRepository: AuthRepository,
    private val timeOffsetProvider: TimeOffsetProvider
) : ViewModel() {

    private val sessionId: String? = savedStateHandle["sessionId"]
    private val _uiState = MutableStateFlow(SessionUiState())
    val uiState: StateFlow<SessionUiState> = _uiState.asStateFlow()

    init {
        observeSession()
        startChronometer()
    }

    private fun observeSession() {
        val uid = authRepository.currentUserId ?: return
        viewModelScope.launch {
            if (sessionId != null) {
                sessionRepository.getSessionStream(sessionId).collect { session ->
                    handleSessionUpdate(session)
                }
            } else {
                sessionRepository.getActiveSessionStream(uid).collect { session ->
                    handleSessionUpdate(session)
                }
            }
        }
    }

    private fun handleSessionUpdate(session: Session?) {
        _uiState.update { it.copy(session = session) }
        if (session != null) {
            viewModelScope.launch {
                lotRepository.getLotStream(session.lotId).collect { lot ->
                    _uiState.update { it.copy(lot = lot) }
                    updateFee()
                }
            }
        }
    }

    private fun startChronometer() {
        viewModelScope.launch {
            while (true) {
                val session = _uiState.value.session
                if (session != null) {
                    val serverNow = timeOffsetProvider.serverNow()
                    val elapsedMs = (serverNow - session.entryTime).coerceAtLeast(0L)
                    val elapsedSec = elapsedMs / 1000

                    // Tính thời gian đỗ dự kiến còn lại
                    val plannedRemMin = session.plannedEndTime?.let { plannedEnd ->
                        ((plannedEnd - serverNow) / 60_000).coerceAtLeast(0L)
                    }

                    _uiState.update {
                        it.copy(
                            elapsedSeconds = elapsedSec,
                            plannedRemainingMinutes = plannedRemMin
                        )
                    }

                    // Cập nhật phí mỗi phút
                    if (elapsedSec % 60 == 0L) {
                        updateFee()
                    }
                }
                delay(1000)
            }
        }
    }

    private fun updateFee() {
        val session = _uiState.value.session ?: return
        val lot = _uiState.value.lot ?: return

        viewModelScope.launch {
            val serverNow = timeOffsetProvider.serverNow()
            val feeResult = FeeCalculator.calculateRealTimeFee(
                entryTimeMs = session.entryTime,
                currentTimeMs = serverNow,
                graceMinutes = lot.graceMinutes,
                blockMinutes = lot.blockMinutes,
                pricePerBlock = lot.pricePerBlock,
                depositApplied = session.depositApplied ?: (if (session.reservationId != null) 5000L else 0L)
            )
            _uiState.update { it.copy(feeResult = feeResult) }
        }
    }

    fun extendPlannedDuration(addMinutes: Int) {
        val session = _uiState.value.session ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            val result = sessionRepository.extendPlannedDuration(session.id, addMinutes)
            if (result.isSuccess) {
                _uiState.update { it.copy(isLoading = false) }
            } else {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = result.exceptionOrNull()?.message ?: "Gia hạn thất bại"
                    )
                }
            }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(errorMessage = null) }
    }
}

