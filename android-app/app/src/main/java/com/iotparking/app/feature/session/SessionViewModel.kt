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
import com.iotparking.app.core.domain.model.SessionStatus
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SessionUiState(
    val session: Session? = null,
    val lot: Lot? = null,
    val elapsedSeconds: Long = 0L,
    val feeResult: FeeResult? = null,
    val plannedRemainingMinutes: Long? = null,
    val isExitRequestActive: Boolean = false,
    val exitRequestRemainingSeconds: Long = 0L,
    val isWaitingAtExitGate: Boolean = false,
    val autoExitSuccessMessage: String? = null,
    val isLoading: Boolean = false,
    val errorMessage: String? = null
)

@OptIn(ExperimentalCoroutinesApi::class)
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
    private var lotObserverJob: Job? = null
    private var observedLotId: String? = null

    init {
        observeSession()
        startChronometer()
    }

    private fun observeSession() {
        viewModelScope.launch {
            if (sessionId != null) {
                sessionRepository.getSessionStream(sessionId).collect { session ->
                    handleSessionUpdate(session)
                }
            } else {
                authRepository.currentUser
                    .map { it?.uid }
                    .distinctUntilChanged()
                    .flatMapLatest { uid ->
                        if (uid == null) flowOf(null)
                        else sessionRepository.getActiveSessionStream(uid)
                    }
                    .collect { session ->
                        handleSessionUpdate(session)
                    }
            }
        }
    }

    private suspend fun handleSessionUpdate(session: Session?) {
        if (session == null) {
            lotObserverJob?.cancel()
            lotObserverJob = null
            observedLotId = null
            _uiState.update {
                it.copy(
                    session = null,
                    lot = null,
                    feeResult = null,
                    elapsedSeconds = 0L,
                    plannedRemainingMinutes = null,
                    isExitRequestActive = false,
                    exitRequestRemainingSeconds = 0L,
                    isWaitingAtExitGate = false
                )
            }
            return
        }

        val serverNow = timeOffsetProvider.serverNow()
        val exitRemSec = computeExitRemainingSeconds(session, serverNow)
        val waitingAtExit = computeIsWaitingAtExitGate(session, serverNow)
        _uiState.update {
            it.copy(
                session = session,
                isExitRequestActive = exitRemSec > 0L,
                exitRequestRemainingSeconds = exitRemSec,
                isWaitingAtExitGate = waitingAtExit
            )
        }
        if (session.lotId != observedLotId) {
            observedLotId = session.lotId
            lotObserverJob?.cancel()
            lotObserverJob = viewModelScope.launch {
                lotRepository.getLotStream(session.lotId).collect { lot ->
                    _uiState.update { it.copy(lot = lot) }
                    updateFee()
                }
            }
        } else {
            updateFee()
        }
    }

    private fun computeIsWaitingAtExitGate(session: Session?, serverNowMs: Long): Boolean {
        if (session == null || session.status != SessionStatus.ACTIVE || !session.waitingAtExitGate) {
            return false
        }
        val waitingAt = session.waitingAtExitGateAt ?: return true
        return (serverNowMs - waitingAt) <= 5 * 60 * 1000L
    }

    private fun computeExitRemainingSeconds(session: Session?, serverNowMs: Long): Long {
        if (session == null || !session.exitRequested) return 0L
        val exp = session.exitRequestExpiresAt ?: return 0L
        return if (exp > serverNowMs) ((exp - serverNowMs) / 1000L) else 0L
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

                    val exitRemSec = computeExitRemainingSeconds(session, serverNow)
                    val waitingAtExit = computeIsWaitingAtExitGate(session, serverNow)

                    _uiState.update {
                        it.copy(
                            elapsedSeconds = elapsedSec,
                            plannedRemainingMinutes = plannedRemMin,
                            isExitRequestActive = exitRemSec > 0L,
                            exitRequestRemainingSeconds = exitRemSec,
                            isWaitingAtExitGate = waitingAtExit
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
                depositApplied = session.depositApplied ?: 0L
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

    fun requestExit() {
        val session = _uiState.value.session ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            val result = sessionRepository.requestExit(session.id)
            if (result.isSuccess) {
                val data = result.getOrNull()
                val autoOpenedGate = (data?.get("autoOpenedGate") as? Boolean) == true
                if (autoOpenedGate) {
                    val fee = (data?.get("fee") as? Number)?.toLong()
                    val feeLine = if (fee != null) "\nPhí đỗ xe: ${fee}đ." else ""
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            isWaitingAtExitGate = false,
                            autoExitSuccessMessage = "Đã xác nhận ra bãi và tự động mở barie Cổng RA!$feeLine"
                        )
                    }
                } else {
                    val expiresAtMs = (data?.get("exitRequestExpiresAtMs") as? Number)?.toLong()
                        ?: (timeOffsetProvider.serverNow() + 5 * 60 * 1000L)
                    val updated = session.copy(
                        exitRequested = true,
                        exitRequestExpiresAt = expiresAtMs,
                        waitingAtExitGate = false
                    )
                    val remSec = computeExitRemainingSeconds(updated, timeOffsetProvider.serverNow())
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            session = updated,
                            isExitRequestActive = remSec > 0L,
                            exitRequestRemainingSeconds = remSec,
                            isWaitingAtExitGate = false
                        )
                    }
                }
            } else {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = result.exceptionOrNull()?.message ?: "Gửi yêu cầu ra thất bại"
                    )
                }
            }
        }
    }

    fun cancelExitRequest() {
        val session = _uiState.value.session ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            val result = sessionRepository.cancelExitRequest(session.id)
            if (result.isSuccess) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        session = session.copy(exitRequested = false, exitRequestExpiresAt = null),
                        isExitRequestActive = false,
                        exitRequestRemainingSeconds = 0L
                    )
                }
            } else {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = result.exceptionOrNull()?.message ?: "Hủy yêu cầu ra thất bại"
                    )
                }
            }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(errorMessage = null) }
    }

    fun clearAutoExitSuccess() {
        _uiState.update { it.copy(autoExitSuccessMessage = null) }
    }
}

