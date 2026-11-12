package com.iotparking.app.feature.settings

import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.iotparking.app.core.data.datasource.PreferencesDataStore
import com.iotparking.app.core.data.repository.AuthRepository
import com.iotparking.app.core.data.repository.UserRepository
import com.iotparking.app.core.domain.model.User
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SettingsUiState(
    val user: User? = null,
    val email: String = "",
    val isEmailVerified: Boolean = false,
    val themeMode: String = "SYSTEM",
    val locale: String = "vi",
    val reminderEnabled: Boolean = true,
    val reminderMinutes: Int = 10,
    val isEditingName: Boolean = false,
    val displayNameInput: String = "",
    val isLoading: Boolean = false,
    val isSignOutSuccess: Boolean = false,
    val errorMessage: String? = null,
    val successMessage: String? = null
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val userRepository: UserRepository,
    private val preferencesDataStore: PreferencesDataStore,
    private val auth: FirebaseAuth
) : ViewModel() {

    private val _uiState = MutableStateFlow(SettingsUiState())
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    init {
        loadSettings()
    }

    private fun loadSettings() {
        val currentUser = auth.currentUser
        val uid = currentUser?.uid ?: return

        _uiState.update {
            it.copy(
                email = currentUser.email ?: "",
                isEmailVerified = currentUser.isEmailVerified
            )
        }

        viewModelScope.launch {
            userRepository.getUserStream(uid).collect { user ->
                _uiState.update {
                    it.copy(
                        user = user,
                        displayNameInput = user?.displayName ?: ""
                    )
                }
            }
        }

        viewModelScope.launch {
            preferencesDataStore.themeMode.collect { mode ->
                _uiState.update { it.copy(themeMode = mode) }
            }
        }

        viewModelScope.launch {
            preferencesDataStore.locale.collect { loc ->
                _uiState.update { it.copy(locale = loc) }
            }
        }

        viewModelScope.launch {
            preferencesDataStore.reminderEnabled.collect { enabled ->
                _uiState.update { it.copy(reminderEnabled = enabled) }
            }
        }

        viewModelScope.launch {
            preferencesDataStore.reminderMinutes.collect { mins ->
                _uiState.update { it.copy(reminderMinutes = mins) }
            }
        }
    }

    fun onDisplayNameChanged(name: String) {
        _uiState.update { it.copy(displayNameInput = name) }
    }

    fun setEditingName(editing: Boolean) {
        _uiState.update { it.copy(isEditingName = editing) }
    }

    fun saveDisplayName() {
        val uid = authRepository.currentUserId ?: return
        val newName = _uiState.value.displayNameInput.trim()
        if (newName.isBlank()) return

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            val result = userRepository.updateDisplayName(uid, newName)
            if (result.isSuccess) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        isEditingName = false,
                        successMessage = "Cập nhật tên thành công!"
                    )
                }
            } else {
                _uiState.update { it.copy(isLoading = false, errorMessage = "Cập nhật tên thất bại") }
            }
        }
    }

    fun setTheme(mode: String) {
        viewModelScope.launch {
            preferencesDataStore.setThemeMode(mode)
        }
    }

    fun setLocale(localeCode: String) {
        viewModelScope.launch {
            preferencesDataStore.setLocale(localeCode)
            val uid = authRepository.currentUserId
            if (uid != null) {
                userRepository.updateLocale(uid, localeCode)
            }
            // Áp dụng qua AppCompatDelegate
            val appLocale = LocaleListCompat.forLanguageTags(localeCode)
            AppCompatDelegate.setApplicationLocales(appLocale)
        }
    }

    fun setReminderEnabled(enabled: Boolean) {
        viewModelScope.launch {
            preferencesDataStore.setReminderEnabled(enabled)
        }
    }

    fun setReminderMinutes(minutes: Int) {
        viewModelScope.launch {
            preferencesDataStore.setReminderMinutes(minutes)
        }
    }

    fun sendEmailVerification() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            val result = authRepository.sendEmailVerification()
            if (result.isSuccess) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        successMessage = "Đã gửi email xác minh. Hãy kiểm tra hộp thư!"
                    )
                }
            } else {
                _uiState.update { it.copy(isLoading = false, errorMessage = "Gửi email xác minh thất bại") }
            }
        }
    }

    fun changePassword(newPass: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            val result = authRepository.updatePassword(newPass)
            if (result.isSuccess) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        successMessage = "Đổi mật khẩu thành công!"
                    )
                }
            } else {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = result.exceptionOrNull()?.message ?: "Đổi mật khẩu thất bại"
                    )
                }
            }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            authRepository.signOut()
            _uiState.update { it.copy(isLoading = false, isSignOutSuccess = true) }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(errorMessage = null) }
    }

    fun clearSuccess() {
        _uiState.update { it.copy(successMessage = null) }
    }
}

