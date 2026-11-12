package com.iotparking.app.feature.wallet

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.iotparking.app.core.data.repository.AuthRepository
import com.iotparking.app.core.data.repository.PaymentMethodRepository
import com.iotparking.app.core.data.repository.UserRepository
import com.iotparking.app.core.data.repository.WalletRepository
import com.iotparking.app.core.domain.model.PaymentMethod
import com.iotparking.app.core.domain.model.Transaction
import com.iotparking.app.core.domain.model.User
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class WalletUiState(
    val user: User? = null,
    val balance: Long = 0L,
    val isNegativeBalance: Boolean = false,
    val paymentMethods: List<PaymentMethod> = emptyList(),
    val selectedPaymentMethod: PaymentMethod? = null,
    val transactions: List<Transaction> = emptyList(),
    val customAmountText: String = "",
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val successMessage: String? = null
)

@HiltViewModel
class WalletViewModel @Inject constructor(
    private val walletRepository: WalletRepository,
    private val paymentMethodRepository: PaymentMethodRepository,
    private val userRepository: UserRepository,
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(WalletUiState())
    val uiState: StateFlow<WalletUiState> = _uiState.asStateFlow()

    init {
        loadData()
    }

    private fun loadData() {
        val uid = authRepository.currentUserId ?: return

        // Observe user & wallet balance
        viewModelScope.launch {
            userRepository.getUserStream(uid).collect { user ->
                _uiState.update {
                    it.copy(
                        user = user,
                        balance = user?.walletBalance ?: 0L,
                        isNegativeBalance = (user?.walletBalance ?: 0L) < 0L
                    )
                }
            }
        }

        // Observe payment methods
        viewModelScope.launch {
            paymentMethodRepository.getPaymentMethodsStream(uid).collect { methods ->
                _uiState.update { state ->
                    val defaultMethod = methods.find { it.isDefault } ?: methods.firstOrNull()
                    state.copy(
                        paymentMethods = methods,
                        selectedPaymentMethod = state.selectedPaymentMethod ?: defaultMethod
                    )
                }
            }
        }

        // Observe transactions
        viewModelScope.launch {
            walletRepository.getTransactionsStream(uid).collect { txs ->
                _uiState.update { it.copy(transactions = txs) }
            }
        }
    }

    fun onCustomAmountChanged(amount: String) {
        _uiState.update { it.copy(customAmountText = amount) }
    }

    fun selectPaymentMethod(method: PaymentMethod) {
        _uiState.update { it.copy(selectedPaymentMethod = method) }
    }

    fun topUp(amount: Long) {
        val methodId = _uiState.value.selectedPaymentMethod?.id
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            val result = walletRepository.topUpWallet(amount, methodId)
            if (result.isSuccess) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        successMessage = "Nạp thành công ${amount}đ vào ví!",
                        customAmountText = ""
                    )
                }
            } else {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = result.exceptionOrNull()?.message ?: "Nạp tiền thất bại"
                    )
                }
            }
        }
    }

    fun addPaymentCard(brand: String, last4: String, holderName: String, isDefault: Boolean) {
        val uid = authRepository.currentUserId ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            val result = paymentMethodRepository.addPaymentMethod(uid, brand, last4, holderName, isDefault)
            if (result.isSuccess) {
                _uiState.update { it.copy(isLoading = false, successMessage = "Thêm thẻ thành công!") }
            } else {
                _uiState.update { it.copy(isLoading = false, errorMessage = "Thêm thẻ thất bại") }
            }
        }
    }

    fun deletePaymentCard(id: String) {
        val uid = authRepository.currentUserId ?: return
        viewModelScope.launch {
            paymentMethodRepository.deletePaymentMethod(uid, id)
        }
    }

    fun setDefaultPaymentCard(id: String) {
        val uid = authRepository.currentUserId ?: return
        viewModelScope.launch {
            paymentMethodRepository.setDefaultPaymentMethod(uid, id)
        }
    }

    fun clearError() {
        _uiState.update { it.copy(errorMessage = null) }
    }

    fun clearSuccess() {
        _uiState.update { it.copy(successMessage = null) }
    }
}

