package com.iotparking.app.feature.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthInvalidCredentialsException
import com.google.firebase.auth.FirebaseAuthInvalidUserException
import com.google.firebase.auth.FirebaseAuthUserCollisionException
import com.google.firebase.auth.FirebaseAuthWeakPasswordException
import com.google.firebase.auth.userProfileChangeRequest
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

data class AuthUiState(
    val email: String = "",
    val password: String = "",
    val confirmPassword: String = "",
    val displayName: String = "",
    val isLoading: Boolean = false,
    val isPasswordVisible: Boolean = false,
    val isConfirmPasswordVisible: Boolean = false,
    val emailError: String? = null,
    val passwordError: String? = null,
    val confirmPasswordError: String? = null,
    val displayNameError: String? = null,
    val errorMessage: String? = null,
    val successMessage: String? = null,
    val loginSuccess: Boolean = false,
    val registerSuccess: Boolean = false,
    val resetEmailSent: Boolean = false,
    val passwordStrength: PasswordStrength = PasswordStrength.NONE
)

enum class PasswordStrength {
    NONE, WEAK, MEDIUM, STRONG
}

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val firebaseAuth: FirebaseAuth
) : ViewModel() {

    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    fun updateEmail(email: String) {
        _uiState.update {
            it.copy(
                email = email,
                emailError = null,
                errorMessage = null
            )
        }
    }

    fun updatePassword(password: String) {
        _uiState.update {
            it.copy(
                password = password,
                passwordError = null,
                errorMessage = null,
                passwordStrength = calculatePasswordStrength(password)
            )
        }
    }

    fun updateConfirmPassword(confirmPassword: String) {
        _uiState.update {
            it.copy(
                confirmPassword = confirmPassword,
                confirmPasswordError = null,
                errorMessage = null
            )
        }
    }

    fun updateDisplayName(displayName: String) {
        _uiState.update {
            it.copy(
                displayName = displayName,
                displayNameError = null,
                errorMessage = null
            )
        }
    }

    fun togglePasswordVisibility() {
        _uiState.update { it.copy(isPasswordVisible = !it.isPasswordVisible) }
    }

    fun toggleConfirmPasswordVisibility() {
        _uiState.update { it.copy(isConfirmPasswordVisible = !it.isConfirmPasswordVisible) }
    }

    fun clearError() {
        _uiState.update { it.copy(errorMessage = null) }
    }

    fun clearSuccess() {
        _uiState.update { it.copy(successMessage = null) }
    }

    fun login() {
        val state = _uiState.value
        // Hỗ trợ đăng nhập nhanh tài khoản Demo khi chạy thử nghiệm
        if (state.email.trim().equals("demo@iotparking.vn", ignoreCase = true) && state.password == "123456") {
            _uiState.update { it.copy(isLoading = false, loginSuccess = true) }
            return
        }

        if (!validateEmail(state.email)) return
        if (!validatePassword(state.password)) return

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            try {
                firebaseAuth.signInWithEmailAndPassword(state.email.trim(), state.password).await()
                _uiState.update { it.copy(isLoading = false, loginSuccess = true) }
            } catch (e: FirebaseAuthInvalidCredentialsException) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = "Invalid email or password."
                    )
                }
            } catch (e: FirebaseAuthInvalidUserException) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = "No account found with this email."
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = e.localizedMessage ?: "Login failed."
                    )
                }
            }
        }
    }

    fun register() {
        val state = _uiState.value
        if (!validateDisplayName(state.displayName)) return
        if (!validateEmail(state.email)) return
        if (!validatePassword(state.password)) return
        if (!validateConfirmPassword(state.password, state.confirmPassword)) return

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            try {
                val result = firebaseAuth.createUserWithEmailAndPassword(
                    state.email.trim(),
                    state.password
                ).await()
                result.user?.updateProfile(
                    userProfileChangeRequest {
                        displayName = state.displayName.trim()
                    }
                )?.await()
                _uiState.update { it.copy(isLoading = false, registerSuccess = true) }
            } catch (e: FirebaseAuthWeakPasswordException) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = "Password is too weak."
                    )
                }
            } catch (e: FirebaseAuthUserCollisionException) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = "An account with this email already exists."
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = e.localizedMessage ?: "Registration failed."
                    )
                }
            }
        }
    }

    fun forgotPassword() {
        val state = _uiState.value
        if (!validateEmail(state.email)) return

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            try {
                firebaseAuth.sendPasswordResetEmail(state.email.trim()).await()
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        resetEmailSent = true,
                        successMessage = "Password reset email sent."
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = e.localizedMessage ?: "Failed to send reset email."
                    )
                }
            }
        }
    }

    fun resetState() {
        _uiState.update {
            AuthUiState()
        }
    }

    private fun validateEmail(email: String): Boolean {
        return when {
            email.isBlank() -> {
                _uiState.update { it.copy(emailError = "Email is required.") }
                false
            }
            !android.util.Patterns.EMAIL_ADDRESS.matcher(email.trim()).matches() -> {
                _uiState.update { it.copy(emailError = "Invalid email address.") }
                false
            }
            else -> true
        }
    }

    private fun validatePassword(password: String): Boolean {
        return when {
            password.isBlank() -> {
                _uiState.update { it.copy(passwordError = "Password is required.") }
                false
            }
            password.length < 6 -> {
                _uiState.update { it.copy(passwordError = "Password must be at least 6 characters.") }
                false
            }
            else -> true
        }
    }

    private fun validateConfirmPassword(password: String, confirmPassword: String): Boolean {
        return when {
            confirmPassword.isBlank() -> {
                _uiState.update { it.copy(confirmPasswordError = "Please confirm your password.") }
                false
            }
            password != confirmPassword -> {
                _uiState.update { it.copy(confirmPasswordError = "Passwords do not match.") }
                false
            }
            else -> true
        }
    }

    private fun validateDisplayName(displayName: String): Boolean {
        return when {
            displayName.isBlank() -> {
                _uiState.update { it.copy(displayNameError = "Display name is required.") }
                false
            }
            else -> true
        }
    }

    private fun calculatePasswordStrength(password: String): PasswordStrength {
        if (password.isEmpty()) return PasswordStrength.NONE
        var score = 0
        if (password.length >= 6) score++
        if (password.length >= 10) score++
        if (password.any { it.isDigit() }) score++
        if (password.any { it.isUpperCase() }) score++
        if (password.any { !it.isLetterOrDigit() }) score++
        return when {
            score <= 1 -> PasswordStrength.WEAK
            score <= 3 -> PasswordStrength.MEDIUM
            else -> PasswordStrength.STRONG
        }
    }
}
