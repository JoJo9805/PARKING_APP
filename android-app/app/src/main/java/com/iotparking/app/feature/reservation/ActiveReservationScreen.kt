package com.iotparking.app.feature.reservation

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.Directions
import androidx.compose.material.icons.filled.HourglassEmpty
import androidx.compose.material.icons.filled.MoreTime
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.iotparking.app.R
import com.iotparking.app.core.designsystem.component.ConfirmDialog
import com.iotparking.app.core.designsystem.component.EmptyState
import com.iotparking.app.core.designsystem.component.ErrorDialog
import com.iotparking.app.core.designsystem.component.LoadingOverlay
import com.iotparking.app.core.designsystem.component.ParkingDangerButton
import com.iotparking.app.core.designsystem.component.ParkingPrimaryButton
import com.iotparking.app.core.designsystem.component.ParkingSecondaryButton
import com.iotparking.app.core.designsystem.theme.WarningAmber

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ActiveReservationScreen(
    viewModel: ReservationViewModel,
    onNavigateBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val res = uiState.activeReservation
    val context = LocalContext.current
    var showCancelDialog by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.active_reservation_title)) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.back))
                    }
                }
            )
        }
    ) { paddingValues ->
        if (res == null) {
            EmptyState(
                title = "Không có lượt giữ chỗ",
                description = "Lượt đặt chỗ của bạn có thể đã hết hạn hoặc đã hoàn tất khi xe vào bãi.",
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                action = {
                    ParkingPrimaryButton(
                        text = "Quay lại",
                        onClick = onNavigateBack,
                        modifier = Modifier.width(160.dp)
                    )
                }
            )
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .padding(16.dp)
                    .verticalScroll(rememberScrollState()),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Countdown Timer Display
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = if (uiState.isExpiredPending) MaterialTheme.colorScheme.errorContainer
                        else MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.4f)
                    )
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            imageVector = Icons.Default.HourglassEmpty,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(36.dp)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = if (uiState.isExpiredPending) "ĐANG XÁC NHẬN HẾT HẠN..." else "THỜI GIAN GIỮ CHỖ CÒN LẠI",
                            style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                            color = MaterialTheme.colorScheme.primary
                        )
                        Spacer(modifier = Modifier.height(12.dp))

                        val minutes = uiState.remainingSeconds / 60
                        val seconds = uiState.remainingSeconds % 60
                        val timerText = String.format("%02d:%02d", minutes, seconds)

                        Text(
                            text = if (uiState.isExpiredPending) "00:00" else timerText,
                            style = MaterialTheme.typography.displayLarge.copy(
                                fontWeight = FontWeight.Bold,
                                fontSize = 48.sp
                            ),
                            color = if (uiState.isExpiredPending) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Lot & Slot Details
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(text = "Bãi đỗ xe", color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(text = res.lotName, fontWeight = FontWeight.Bold)
                        }
                        Spacer(modifier = Modifier.height(10.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(text = "Vị trí ô đỗ", color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(MaterialTheme.colorScheme.primary)
                                    .padding(horizontal = 12.dp, vertical = 4.dp)
                            ) {
                                Text(
                                    text = res.slotId,
                                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                    color = Color.White
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(10.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(text = "Biển số xe đăng ký", color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(text = res.plateDisplay, fontWeight = FontWeight.Bold)
                        }

                        // Sơ đồ chỉ dẫn rẽ từ cổng
                        Spacer(modifier = Modifier.height(12.dp))
                        val isZoneA = res.slotId.startsWith("A", ignoreCase = true)
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = if (isZoneA) Icons.Default.ArrowBack else Icons.Default.ArrowForward,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = if (isZoneA) "Qua cổng barie -> RẼ TRÁI vào Khu A (Ô ${res.slotId})"
                                else "Qua cổng barie -> RẼ PHẢI vào Khu B (Ô ${res.slotId})",
                                style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Bold),
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Action buttons: Chỉ đường, Gia hạn, Hủy đặt chỗ
                ParkingSecondaryButton(
                    text = "Chỉ đường đến bãi đỗ",
                    onClick = {
                        val fallbackIntent = Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=${res.lotName}"))
                        context.startActivity(fallbackIntent)
                    }
                )

                if (res.extendCount < res.maxExtendCount) {
                    Spacer(modifier = Modifier.height(12.dp))
                    ParkingPrimaryButton(
                        text = "Gia hạn thêm 15 phút (Còn ${res.maxExtendCount - res.extendCount} lần)",
                        onClick = viewModel::extendReservation,
                        isLoading = uiState.isLoading
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))
                ParkingDangerButton(
                    text = "Hủy đặt chỗ",
                    onClick = { showCancelDialog = true }
                )
            }
        }

        // Cancel Confirmation Dialog with Buffer Zone prediction
        if (showCancelDialog) {
            ConfirmDialog(
                title = "Xác nhận hủy đặt chỗ?",
                message = "${uiState.cancelPredictionText}\n\nBạn có chắc chắn muốn hủy lượt giữ chỗ này?",
                confirmText = "Hủy đặt chỗ",
                cancelText = "Giữ lại",
                isDestructive = true,
                onConfirm = {
                    showCancelDialog = false
                    viewModel.cancelReservation()
                },
                onDismiss = { showCancelDialog = false }
            )
        }

        // Cancel Result Summary Dialog
        uiState.cancelResultSummary?.let { summary ->
            ConfirmDialog(
                title = "Thông báo hủy",
                message = summary,
                confirmText = "Đóng",
                cancelText = "",
                onConfirm = {
                    viewModel.clearCancelResult()
                    onNavigateBack()
                },
                onDismiss = {
                    viewModel.clearCancelResult()
                    onNavigateBack()
                }
            )
        }

        LoadingOverlay(isLoading = uiState.isLoading)

        uiState.errorMessage?.let { error ->
            ErrorDialog(
                message = error,
                onDismiss = viewModel::clearError
            )
        }
    }
}

