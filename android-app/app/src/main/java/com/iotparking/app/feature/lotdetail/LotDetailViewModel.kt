package com.iotparking.app.feature.lotdetail

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.iotparking.app.core.data.repository.AuthRepository
import com.iotparking.app.core.data.repository.LotRepository
import com.iotparking.app.core.data.repository.ReservationRepository
import com.iotparking.app.core.data.repository.SessionRepository
import com.iotparking.app.core.data.repository.UserRepository
import com.iotparking.app.core.domain.model.Lot
import com.iotparking.app.core.domain.model.Slot
import com.iotparking.app.core.network.NetworkMonitor
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LotDetailUiState(
    val lot: Lot? = null,
    val slots: List<Slot> = emptyList(),
    val isLive: Boolean = false,
    val isOnline: Boolean = true,
    val walletBalance: Long = 0L,
    val hasActiveReservation: Boolean = false,
    val hasActiveSession: Boolean = false,
    val canReserve: Boolean = false,
    val cannotReserveReason: String? = null,
    val isLoading: Boolean = true
)

@HiltViewModel
class LotDetailViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val lotRepository: LotRepository,
    private val authRepository: AuthRepository,
    private val userRepository: UserRepository,
    private val reservationRepository: ReservationRepository,
    private val sessionRepository: SessionRepository,
    private val networkMonitor: NetworkMonitor
) : ViewModel() {

    private val lotId: String = checkNotNull(savedStateHandle["lotId"])
    private val _uiState = MutableStateFlow(LotDetailUiState())
    val uiState: StateFlow<LotDetailUiState> = _uiState.asStateFlow()

    init {
        observeNetwork()
        observeLot()
        observeSlots()
        observeUserState()
    }

    private fun observeNetwork() {
        viewModelScope.launch {
            networkMonitor.isOnline.collect { online ->
                _uiState.update { it.copy(isOnline = online) }
                checkCanReserve()
            }
        }
    }

    private fun observeLot() {
        viewModelScope.launch {
            lotRepository.getLotStream(lotId).collect { lot ->
                _uiState.update { it.copy(lot = lot, isLive = lot?.isLive ?: false, isLoading = false) }
                checkCanReserve()
            }
        }
    }

    private fun observeSlots() {
        viewModelScope.launch {
            lotRepository.getSlotsStream(lotId).collect { slots ->
                _uiState.update { it.copy(slots = slots) }
            }
        }
    }

    private fun observeUserState() {
        val uid = authRepository.currentUserId ?: return
        viewModelScope.launch {
            userRepository.getUserStream(uid).collect { user ->
                _uiState.update { it.copy(walletBalance = user?.walletBalance ?: 0L) }
                checkCanReserve()
            }
        }
        viewModelScope.launch {
            reservationRepository.getActiveReservationStream(uid).collect { res ->
                _uiState.update { it.copy(hasActiveReservation = res != null) }
                checkCanReserve()
            }
        }
        viewModelScope.launch {
            sessionRepository.getActiveSessionStream(uid).collect { session ->
                _uiState.update { it.copy(hasActiveSession = session != null) }
                checkCanReserve()
            }
        }
    }

    private fun checkCanReserve() {
        val state = _uiState.value
        val lot = state.lot ?: return

        when {
            !state.isOnline -> {
                _uiState.update { it.copy(canReserve = false, cannotReserveReason = "Đang ngoại tuyến") }
            }
            !lot.isLive -> {
                _uiState.update { it.copy(canReserve = false, cannotReserveReason = "Chỉ mở đặt chỗ cho bãi Live") }
            }
            state.hasActiveReservation -> {
                _uiState.update { it.copy(canReserve = false, cannotReserveReason = "Bạn đang có 1 lượt đặt chỗ đang hoạt động") }
            }
            state.hasActiveSession -> {
                _uiState.update { it.copy(canReserve = false, cannotReserveReason = "Bạn đang có xe đỗ trong bãi") }
            }
            state.walletBalance < 0 -> {
                _uiState.update { it.copy(canReserve = false, cannotReserveReason = "Ví đang âm, vui lòng nạp thêm tiền") }
            }
            lot.availableSlots <= 0 -> {
                _uiState.update { it.copy(canReserve = false, cannotReserveReason = "Bãi đã hết chỗ trống") }
            }
            else -> {
                _uiState.update { it.copy(canReserve = true, cannotReserveReason = null) }
            }
        }
    }
}

