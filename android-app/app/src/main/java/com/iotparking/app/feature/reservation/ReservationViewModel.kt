package com.iotparking.app.feature.reservation

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.iotparking.app.core.data.repository.AuthRepository
import com.iotparking.app.core.data.repository.LotRepository
import com.iotparking.app.core.data.repository.ReservationRepository
import com.iotparking.app.core.data.repository.UserRepository
import com.iotparking.app.core.data.repository.VehicleRepository
import com.iotparking.app.core.domain.TimeOffsetProvider
import com.iotparking.app.core.domain.model.Lot
import com.iotparking.app.core.domain.model.Reservation
import com.iotparking.app.core.domain.model.Slot
import com.iotparking.app.core.domain.model.User
import com.iotparking.app.core.domain.model.Vehicle
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ReservationUiState(
    val lot: Lot? = null,
    val slots: List<Slot> = emptyList(),
    val selectedSlot: Slot? = null,
    val autoAssignSlot: Boolean = false,
    val vehicles: List<Vehicle> = emptyList(),
    val selectedVehicle: Vehicle? = null,
    val user: User? = null,
    val activeReservation: Reservation? = null,
    val remainingSeconds: Long = 0L,
    val isExpiredPending: Boolean = false,
    val cancelPredictionText: String = "",
    val isBufferZone: Boolean = false,
    val isCancelForfeited: Boolean = false,
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val successReservationId: String? = null,
    val cancelResultSummary: String? = null
)

@HiltViewModel
class ReservationViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val lotRepository: LotRepository,
    private val reservationRepository: ReservationRepository,
    private val vehicleRepository: VehicleRepository,
    private val userRepository: UserRepository,
    private val authRepository: AuthRepository,
    private val timeOffsetProvider: TimeOffsetProvider
) : ViewModel() {

    private val lotId: String? = savedStateHandle["lotId"]
    private val reservationId: String? = savedStateHandle["reservationId"]

    private val _uiState = MutableStateFlow(ReservationUiState())
    val uiState: StateFlow<ReservationUiState> = _uiState.asStateFlow()

    init {
        loadData()
        startCountdownTimer()
    }

    private fun loadData() {
        val uid = authRepository.currentUserId ?: return

        // Observe user
        viewModelScope.launch {
            userRepository.getUserStream(uid).collect { user ->
                _uiState.update { it.copy(user = user) }
            }
        }

        // Observe vehicles
        viewModelScope.launch {
            vehicleRepository.getVehiclesStream(uid).collect { vehicles ->
                _uiState.update { state ->
                    val defaultV = vehicles.find { it.plateNormalized == state.user?.defaultVehicleId }
                        ?: vehicles.firstOrNull()
                    state.copy(vehicles = vehicles, selectedVehicle = state.selectedVehicle ?: defaultV)
                }
            }
        }

        // Observe lot & slots if lotId provided
        if (lotId != null) {
            viewModelScope.launch {
                lotRepository.getLotStream(lotId).collect { lot ->
                    _uiState.update { it.copy(lot = lot) }
                }
            }
            viewModelScope.launch {
                lotRepository.getSlotsStream(lotId).collect { slots ->
                    _uiState.update { it.copy(slots = slots) }
                }
            }
        }

        // Observe active reservation
        viewModelScope.launch {
            reservationRepository.getActiveReservationStream(uid).collect { res ->
                _uiState.update { it.copy(activeReservation = res) }
                updateCancelPrediction()
            }
        }
    }

    private fun startCountdownTimer() {
        viewModelScope.launch {
            while (true) {
                val res = _uiState.value.activeReservation
                if (res != null) {
                    val serverNow = timeOffsetProvider.serverNow()
                    val remainingMs = res.expiresAt - serverNow
                    val remainingSec = (remainingMs / 1000).coerceAtLeast(0L)
                    _uiState.update {
                        it.copy(
                            remainingSeconds = remainingSec,
                            isExpiredPending = remainingSec == 0L
                        )
                    }
                    updateCancelPrediction()
                }
                delay(1000)
            }
        }
    }

    private fun updateCancelPrediction() {
        val res = _uiState.value.activeReservation ?: return
        viewModelScope.launch {
            val serverNow = timeOffsetProvider.serverNow()
            val elapsedSec = ((serverNow - res.createdAt) / 1000).coerceAtLeast(0L)

            when {
                elapsedSec < 110 -> {
                    _uiState.update {
                        it.copy(
                            cancelPredictionText = "Bạn sẽ được hoàn lại 5.000đ (dự kiến)",
                            isBufferZone = false,
                            isCancelForfeited = false
                        )
                    }
                }
                elapsedSec in 110..130 -> {
                    _uiState.update {
                        it.copy(
                            cancelPredictionText = "Bạn đang sát mốc 2 phút. Kết quả hoàn/mất cọc do hệ thống xác định khi xử lý.",
                            isBufferZone = true,
                            isCancelForfeited = false
                        )
                    }
                }
                else -> {
                    _uiState.update {
                        it.copy(
                            cancelPredictionText = "Bạn sẽ mất phí cọc 5.000đ (dự kiến do đã quá 2 phút)",
                            isBufferZone = false,
                            isCancelForfeited = true
                        )
                    }
                }
            }
        }
    }

    fun selectSlot(slot: Slot?) {
        _uiState.update { it.copy(selectedSlot = slot, autoAssignSlot = slot == null) }
    }

    fun selectVehicle(vehicle: Vehicle) {
        _uiState.update { it.copy(selectedVehicle = vehicle) }
    }

    fun clearError() {
        _uiState.update { it.copy(errorMessage = null) }
    }

    fun clearCancelResult() {
        _uiState.update { it.copy(cancelResultSummary = null) }
    }

    fun confirmReservation() {
        val state = _uiState.value
        val lot = state.lot ?: return
        val vehicle = state.selectedVehicle ?: run {
            _uiState.update { it.copy(errorMessage = "Vui lòng chọn phương tiện") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            val slotId = if (state.autoAssignSlot) null else state.selectedSlot?.id
            val result = reservationRepository.createReservation(lot.id, slotId, vehicle.plateNormalized)

            if (result.isSuccess) {
                val data = result.getOrNull()
                val resId = data?.get("reservationId") as? String
                _uiState.update { it.copy(isLoading = false, successReservationId = resId) }
            } else {
                val err = result.exceptionOrNull()?.message ?: "Đặt chỗ thất bại"
                val friendlyMessage = when (err) {
                    "NEGATIVE_BALANCE" -> "Ví đang âm, vui lòng nạp thêm tiền để đặt chỗ."
                    "INSUFFICIENT_BALANCE" -> "Số dư ví không đủ 5.000đ tiền cọc. Vui lòng nạp thêm."
                    "HAS_ACTIVE_RESERVATION" -> "Bạn đang có một lượt giữ chỗ chưa hoàn tất."
                    "HAS_ACTIVE_SESSION" -> "Bạn đang có phương tiện đỗ trong bãi, không thể đặt thêm."
                    "RESOURCE_EXHAUSTED" -> "Chỗ đỗ này vừa có người khác đặt. Vui lòng chọn chỗ khác."
                    else -> err
                }
                _uiState.update { it.copy(isLoading = false, errorMessage = friendlyMessage) }
            }
        }
    }

    fun cancelReservation() {
        val res = _uiState.value.activeReservation ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            val result = reservationRepository.cancelReservation(res.id)
            if (result.isSuccess) {
                val data = result.getOrNull()
                val refunded = data?.get("refunded") as? Boolean ?: false
                val refundAmount = (data?.get("refundAmount") as? Number)?.toLong() ?: 0L
                val msg = if (refunded) {
                    "Đã hủy đặt chỗ thành công! Bạn được hoàn lại ${refundAmount}đ tiền cọc vào ví."
                } else {
                    "Đã hủy đặt chỗ. Tiền cọc đã bị trừ do hủy sau 2 phút."
                }
                _uiState.update { it.copy(isLoading = false, cancelResultSummary = msg) }
            } else {
                _uiState.update { it.copy(isLoading = false, errorMessage = result.exceptionOrNull()?.message ?: "Hủy thất bại") }
            }
        }
    }

    fun extendReservation() {
        val res = _uiState.value.activeReservation ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            val result = reservationRepository.extendReservation(res.id)
            if (result.isSuccess) {
                _uiState.update { it.copy(isLoading = false) }
            } else {
                _uiState.update { it.copy(isLoading = false, errorMessage = result.exceptionOrNull()?.message ?: "Không thể gia hạn thêm") }
            }
        }
    }
}

