package com.iotparking.app.feature.reservation

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.iotparking.app.core.data.repository.AuthRepository
import com.iotparking.app.core.data.repository.LotRepository
import com.iotparking.app.core.data.repository.PaymentMethodRepository
import com.iotparking.app.core.data.repository.ReservationRepository
import com.iotparking.app.core.data.repository.UserRepository
import com.iotparking.app.core.data.repository.VehicleRepository
import com.iotparking.app.core.domain.TimeOffsetProvider
import com.iotparking.app.core.domain.model.Lot
import com.iotparking.app.core.domain.model.PaymentMethod
import com.iotparking.app.core.domain.model.Reservation
import com.iotparking.app.core.domain.model.Slot
import com.iotparking.app.core.domain.model.SlotStatus
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
    val defaultPaymentMethod: PaymentMethod? = null,
    val activeReservation: Reservation? = null,
    val remainingSeconds: Long = 0L,
    val isExpiredPending: Boolean = false,
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
    private val paymentMethodRepository: PaymentMethodRepository,
    private val userRepository: UserRepository,
    private val authRepository: AuthRepository,
    private val timeOffsetProvider: TimeOffsetProvider
) : ViewModel() {

    private val lotId: String? = savedStateHandle["lotId"]
    private val slotIdArg: String? = savedStateHandle["slotId"]
    private val reservationId: String? = savedStateHandle["reservationId"]

    private val _uiState = MutableStateFlow(
        ReservationUiState(autoAssignSlot = (slotIdArg == "auto"))
    )
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

        // Observe linked virtual payment cards (demo)
        viewModelScope.launch {
            paymentMethodRepository.getPaymentMethodsStream(uid).collect { methods ->
                val defaultCard = methods.find { it.isDefault } ?: methods.firstOrNull()
                _uiState.update { it.copy(defaultPaymentMethod = defaultCard) }
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
                    _uiState.update { state ->
                        val updatedSelectedSlot = when {
                            slotIdArg == "auto" -> null
                            slotIdArg != null -> slots.find {
                                it.id == slotIdArg && it.status == SlotStatus.AVAILABLE && !it.sensorOccupied
                            }
                            else -> state.selectedSlot?.let { prev ->
                                slots.find {
                                    it.id == prev.id && it.status == SlotStatus.AVAILABLE && !it.sensorOccupied
                                }
                            }
                        }
                        val effectiveAutoAssign = if (slotIdArg == "auto") true else state.autoAssignSlot
                        state.copy(
                            slots = slots,
                            selectedSlot = updatedSelectedSlot,
                            autoAssignSlot = effectiveAutoAssign
                        )
                    }
                }
            }
        }

        // Observe active reservation
        viewModelScope.launch {
            reservationRepository.getActiveReservationStream(uid).collect { res ->
                if (res != null) {
                    val serverNow = timeOffsetProvider.serverNow()
                    val remainingMs = res.expiresAt - serverNow
                    val remainingSec = (remainingMs / 1000).coerceAtLeast(0L)
                    _uiState.update {
                        it.copy(
                            activeReservation = res,
                            remainingSeconds = remainingSec,
                            isExpiredPending = remainingSec == 0L
                        )
                    }
                } else {
                    _uiState.update { it.copy(activeReservation = null) }
                }
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
                }
                delay(1000)
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
                    "HAS_ACTIVE_RESERVATION" -> "Bạn hoặc biển số xe này đang có một lượt giữ chỗ chưa hoàn tất."
                    "HAS_ACTIVE_SESSION" -> "Bạn hoặc biển số xe này đang có phương tiện đỗ trong bãi, không thể đặt thêm."
                    "RESOURCE_EXHAUSTED" -> "Chỗ đỗ này vừa có người khác đặt hoặc đã có xe đỗ. Vui lòng chọn chỗ khác."
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
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        cancelResultSummary = "Đã hủy đặt chỗ thành công! Ô đỗ đã được mở lại."
                    )
                }
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

