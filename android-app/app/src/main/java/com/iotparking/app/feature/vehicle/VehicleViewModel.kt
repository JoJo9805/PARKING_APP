package com.iotparking.app.feature.vehicle

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.iotparking.app.core.data.repository.AuthRepository
import com.iotparking.app.core.data.repository.UserRepository
import com.iotparking.app.core.data.repository.VehicleRepository
import com.iotparking.app.core.domain.PlateUtils
import com.iotparking.app.core.domain.model.Vehicle
import com.iotparking.app.core.domain.model.VehicleType
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class VehicleUiState(
    val vehicles: List<Vehicle> = emptyList(),
    val defaultVehicleId: String? = null,
    val plateInput: String = "",
    val plateNormalizedPreview: String = "",
    val isPlateValid: Boolean = false,
    val selectedType: VehicleType = VehicleType.CAR,
    val nicknameInput: String = "",
    val setDefault: Boolean = false,
    val isLoading: Boolean = false,
    val isAddSuccess: Boolean = false,
    val errorMessage: String? = null,
    val successMessage: String? = null
)

@HiltViewModel
class VehicleViewModel @Inject constructor(
    private val vehicleRepository: VehicleRepository,
    private val userRepository: UserRepository,
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(VehicleUiState())
    val uiState: StateFlow<VehicleUiState> = _uiState.asStateFlow()

    init {
        loadData()
    }

    private fun loadData() {
        val uid = authRepository.currentUserId ?: return

        viewModelScope.launch {
            userRepository.getUserStream(uid).collect { user ->
                _uiState.update { it.copy(defaultVehicleId = user?.defaultVehicleId) }
            }
        }

        viewModelScope.launch {
            vehicleRepository.getVehiclesStream(uid).collect { vehicles ->
                _uiState.update { it.copy(vehicles = vehicles) }
            }
        }
    }

    fun onPlateInputChanged(input: String) {
        val normalized = PlateUtils.normalize(input)
        val valid = PlateUtils.isValid(normalized)
        _uiState.update {
            it.copy(
                plateInput = input,
                plateNormalizedPreview = normalized,
                isPlateValid = valid
            )
        }
    }

    fun onNicknameInputChanged(nickname: String) {
        _uiState.update { it.copy(nicknameInput = nickname) }
    }

    fun onTypeSelected(type: VehicleType) {
        _uiState.update { it.copy(selectedType = type) }
    }

    fun onSetDefaultToggled(setDefault: Boolean) {
        _uiState.update { it.copy(setDefault = setDefault) }
    }

    fun addVehicle() {
        val state = _uiState.value
        if (!state.isPlateValid) {
            _uiState.update { it.copy(errorMessage = "Biển số xe không đúng định dạng Việt Nam") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            val result = vehicleRepository.addVehicle(
                plateDisplay = state.plateInput.trim(),
                type = state.selectedType,
                nickname = state.nicknameInput.trim().ifEmpty { "Xe của tôi" },
                setDefault = state.setDefault || state.vehicles.isEmpty()
            )

            if (result.isSuccess) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        isAddSuccess = true,
                        plateInput = "",
                        plateNormalizedPreview = "",
                        nicknameInput = "",
                        successMessage = "Thêm xe thành công!"
                    )
                }
            } else {
                val err = result.exceptionOrNull()?.message ?: "Thêm xe thất bại"
                val friendly = if (err.contains("already-exists") || err.contains("ALREADY_EXISTS")) {
                    "Biển số này đã được đăng ký bởi tài khoản khác trong hệ thống."
                } else err
                _uiState.update { it.copy(isLoading = false, errorMessage = friendly) }
            }
        }
    }

    fun removeVehicle(plateNormalized: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            val result = vehicleRepository.removeVehicle(plateNormalized)
            if (result.isSuccess) {
                _uiState.update { it.copy(isLoading = false, successMessage = "Đã xóa xe thành công") }
            } else {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = result.exceptionOrNull()?.message ?: "Không thể xóa xe lúc này"
                    )
                }
            }
        }
    }

    fun setDefaultVehicle(vehicleId: String) {
        val uid = authRepository.currentUserId ?: return
        viewModelScope.launch {
            userRepository.updateDefaultVehicle(uid, vehicleId)
        }
    }

    fun clearError() {
        _uiState.update { it.copy(errorMessage = null) }
    }

    fun clearSuccess() {
        _uiState.update { it.copy(successMessage = null) }
    }

    fun resetAddState() {
        _uiState.update { it.copy(isAddSuccess = false) }
    }
}

