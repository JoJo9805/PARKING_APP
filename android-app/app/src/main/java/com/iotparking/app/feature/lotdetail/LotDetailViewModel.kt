package com.iotparking.app.feature.lotdetail

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.iotparking.app.core.data.repository.AuthRepository
import com.iotparking.app.core.data.repository.LotRepository
import com.iotparking.app.core.data.repository.ReservationRepository
import com.iotparking.app.core.data.repository.SessionRepository
import com.iotparking.app.core.domain.model.Lot
import com.iotparking.app.core.domain.model.Slot
import com.iotparking.app.core.domain.model.SlotStatus
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
    val liveAvailableSlots: Int = 0,
    val isLive: Boolean = false,
    val isOnline: Boolean = true,
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
                checkCanReserve()
            }
        }
    }

    private fun observeUserState() {
        val uid = authRepository.currentUserId ?: return
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
        val liveAvailable = if (state.slots.isNotEmpty()) {
            state.slots.count { it.status == SlotStatus.AVAILABLE && !it.sensorOccupied }
        } else {
            lot.availableSlots
        }

        val (canReserve, reason) = when {
            !state.isOnline -> false to "Đang ngoại tuyến"
            !lot.isLive -> false to "Chỉ mở đặt chỗ cho bãi Live"
            state.hasActiveReservation -> false to "Bạn đang có 1 lượt đặt chỗ đang hoạt động"
            state.hasActiveSession -> false to "Bạn đang có xe đỗ trong bãi"
            liveAvailable <= 0 -> false to "Bãi đã hết chỗ trống"
            else -> true to null
        }

        _uiState.update {
            it.copy(
                liveAvailableSlots = liveAvailable,
                canReserve = canReserve,
                cannotReserveReason = reason
            )
        }
    }
}

