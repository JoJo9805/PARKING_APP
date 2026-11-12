package com.iotparking.app.feature.inbox

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.iotparking.app.core.data.repository.AuthRepository
import com.iotparking.app.core.data.repository.NotificationRepository
import com.iotparking.app.core.domain.model.Notification
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class InboxUiState(
    val notifications: List<Notification> = emptyList(),
    val unreadCount: Int = 0,
    val isLoading: Boolean = true
)

@HiltViewModel
class InboxViewModel @Inject constructor(
    private val notificationRepository: NotificationRepository,
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(InboxUiState())
    val uiState: StateFlow<InboxUiState> = _uiState.asStateFlow()

    init {
        loadNotifications()
    }

    private fun loadNotifications() {
        val uid = authRepository.currentUserId ?: return
        viewModelScope.launch {
            notificationRepository.getNotificationsStream(uid).collect { list ->
                _uiState.update {
                    it.copy(
                        notifications = list,
                        unreadCount = list.count { notif -> !notif.read },
                        isLoading = false
                    )
                }
            }
        }
    }

    fun markAsRead(notificationId: String) {
        val uid = authRepository.currentUserId ?: return
        viewModelScope.launch {
            notificationRepository.markAsRead(uid, notificationId)
        }
    }

    fun markAllAsRead() {
        val uid = authRepository.currentUserId ?: return
        viewModelScope.launch {
            notificationRepository.markAllAsRead(uid)
        }
    }
}

