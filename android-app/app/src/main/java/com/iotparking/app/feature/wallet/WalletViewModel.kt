package com.iotparking.app.feature.wallet

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.iotparking.app.core.data.repository.AuthRepository
import com.iotparking.app.core.data.repository.PaymentMethodRepository
import com.iotparking.app.core.domain.model.PaymentMethod
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class WalletUiState(
    val paymentMethods: List<PaymentMethod> = emptyList(),
    val defaultPaymentMethod: PaymentMethod? = null,
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val successMessage: String? = null
)

@HiltViewModel
class WalletViewModel @Inject constructor(
    private val paymentMethodRepository: PaymentMethodRepository,
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(WalletUiState())
    val uiState: StateFlow<WalletUiState> = _uiState.asStateFlow()

    init {
        loadData()
    }

    private fun loadData() {
        val uid = authRepository.currentUserId ?: return

        // Observe linked virtual payment cards
        viewModelScope.launch {
            paymentMethodRepository.getPaymentMethodsStream(uid).collect { methods ->
                val defaultMethod = methods.find { it.isDefault } ?: methods.firstOrNull()
                _uiState.update { state ->
                    state.copy(
                        paymentMethods = methods,
                        defaultPaymentMethod = defaultMethod
                    )
                }
            }
        }
    }

    fun addPaymentCard(brand: String, last4: String, holderName: String, isDefault: Boolean) {
        val uid = authRepository.currentUserId ?: return
        val effectiveDefault = isDefault || _uiState.value.paymentMethods.isEmpty()
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            val result = paymentMethodRepository.addPaymentMethod(
                uid = uid,
                brand = brand,
                last4 = last4,
                holderName = holderName.trim().uppercase(),
                isDefault = effectiveDefault
            )
            if (result.isSuccess) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        successMessage = "Liên kết thẻ ảo thành công!"
                    )
                }
            } else {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = result.exceptionOrNull()?.message ?: "Thêm thẻ thất bại"
                    )
                }
            }
        }
    }

    fun deletePaymentCard(id: String) {
        val uid = authRepository.currentUserId ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            val result = paymentMethodRepository.deletePaymentMethod(uid, id)
            if (result.isSuccess) {
                _uiState.update { it.copy(isLoading = false, successMessage = "Đã xóa thẻ") }
            } else {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = result.exceptionOrNull()?.message ?: "Xóa thẻ thất bại"
                    )
                }
            }
        }
    }

    fun setDefaultPaymentCard(id: String) {
        val uid = authRepository.currentUserId ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            val result = paymentMethodRepository.setDefaultPaymentMethod(uid, id)
            if (result.isSuccess) {
                _uiState.update { it.copy(isLoading = false, successMessage = "Đã đặt làm thẻ mặc định") }
            } else {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = result.exceptionOrNull()?.message ?: "Cập nhật thẻ mặc định thất bại"
                    )
                }
            }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(errorMessage = null) }
    }

    fun clearSuccess() {
        _uiState.update { it.copy(successMessage = null) }
    }
}

