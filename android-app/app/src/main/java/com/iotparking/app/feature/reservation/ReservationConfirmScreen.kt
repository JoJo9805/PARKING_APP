package com.iotparking.app.feature.reservation

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.iotparking.app.R
import com.iotparking.app.core.designsystem.component.ErrorDialog
import com.iotparking.app.core.designsystem.component.LoadingOverlay
import com.iotparking.app.core.designsystem.component.ParkingPrimaryButton
import com.iotparking.app.core.designsystem.component.ParkingSecondaryButton
import com.iotparking.app.core.designsystem.theme.WarningAmber

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReservationConfirmScreen(
    viewModel: ReservationViewModel,
    onNavigateBack: () -> Unit,
    onNavigateToActiveReservation: (String) -> Unit,
    onNavigateToWallet: () -> Unit,
    onNavigateToAddVehicle: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val lot = uiState.lot
    val deposit = lot?.depositAmount ?: 5000L
    val walletBalance = uiState.user?.walletBalance ?: 0L
    val isInsufficientBalance = walletBalance < deposit
    val isNegativeBalance = walletBalance < 0L

    var vehicleDropdownExpanded by remember { mutableStateOf(false) }

    LaunchedEffect(uiState.successReservationId) {
        uiState.successReservationId?.let { resId ->
            onNavigateToActiveReservation(resId)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.reservation_confirm_title)) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.back))
                    }
                }
            )
        },
        bottomBar = {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    if (isInsufficientBalance) {
                        ParkingSecondaryButton(
                            text = "Nạp thêm tiền vào ví",
                            onClick = onNavigateToWallet,
                            modifier = Modifier.padding(bottom = 8.dp)
                        )
                    }
                    ParkingPrimaryButton(
                        text = "Xác nhận & Giữ chỗ",
                        enabled = !isInsufficientBalance && !isNegativeBalance && uiState.selectedVehicle != null,
                        isLoading = uiState.isLoading,
                        onClick = viewModel::confirmReservation
                    )
                }
            }
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp)
                .verticalScroll(rememberScrollState())
        ) {
            // Tóm tắt thông tin đặt chỗ
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Thông tin đặt chỗ",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(text = "Bãi đỗ:", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(text = lot?.name ?: "", fontWeight = FontWeight.Bold)
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(text = "Vị trí ô đỗ:", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(
                            text = if (uiState.autoAssignSlot) "Hệ thống tự gán" else (uiState.selectedSlot?.id ?: "Chưa chọn"),
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(text = "Thời gian giữ chỗ:", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(text = "${lot?.holdDurationMinutes ?: 15} phút", fontWeight = FontWeight.Bold)
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(text = "Tiền cọc giữ chỗ:", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(
                            text = "${deposit}đ",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Chọn phương tiện
            Text(
                text = "Chọn phương tiện đến đỗ:",
                style = MaterialTheme.typography.titleSmall
            )
            Spacer(modifier = Modifier.height(8.dp))

            if (uiState.vehicles.isEmpty()) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable(onClick = onNavigateToAddVehicle),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer.copy(alpha = 0.5f))
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.DirectionsCar, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(text = "Bạn chưa có phương tiện nào", fontWeight = FontWeight.Bold)
                            Text(text = "Chạm vào đây để thêm phương tiện", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            } else {
                ExposedDropdownMenuBox(
                    expanded = vehicleDropdownExpanded,
                    onExpandedChange = { vehicleDropdownExpanded = !vehicleDropdownExpanded }
                ) {
                    OutlinedTextField(
                        value = uiState.selectedVehicle?.let { "${it.plateDisplay} (${it.nickname})" } ?: "Chọn xe",
                        onValueChange = {},
                        readOnly = true,
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = vehicleDropdownExpanded) },
                        modifier = Modifier
                            .menuAnchor()
                            .fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp)
                    )

                    ExposedDropdownMenu(
                        expanded = vehicleDropdownExpanded,
                        onDismissRequest = { vehicleDropdownExpanded = false }
                    ) {
                        uiState.vehicles.forEach { vehicle ->
                            DropdownMenuItem(
                                text = { Text("${vehicle.plateDisplay} - ${vehicle.nickname}") },
                                onClick = {
                                    viewModel.selectVehicle(vehicle)
                                    vehicleDropdownExpanded = false
                                }
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Số dư ví hiện tại
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (isInsufficientBalance) MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.4f)
                    else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)
                )
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.AccountBalanceWallet, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(text = "Số dư ví:")
                    }
                    Text(
                        text = "${walletBalance}đ",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                        color = if (isInsufficientBalance) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface
                    )
                }
            }

            if (isNegativeBalance) {
                Spacer(modifier = Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Warning, contentDescription = null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Ví của bạn đang âm. Vui lòng nạp tiền trước khi tiếp tục.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error
                    )
                }
            } else if (isInsufficientBalance) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Số dư không đủ trừ 5.000đ tiền cọc. Hãy nạp thêm.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Quy định quan trọng & Cảnh báo biển số
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(WarningAmber.copy(alpha = 0.12f))
                    .padding(14.dp)
            ) {
                Row {
                    Icon(Icons.Default.Info, contentDescription = null, tint = WarningAmber, modifier = Modifier.size(20.dp))
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = "Lưu ý quan trọng:",
                            style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                            color = WarningAmber
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "1. Hệ thống chỉ mở cổng và nhận diện giữ chỗ nếu đúng biển số xe đã chọn.\n2. Nếu hủy trong 2 phút đầu: hoàn 100% cọc.\n3. Nếu hủy sau 2 phút hoặc quá hạn 15 phút: tiền cọc sẽ không được hoàn lại.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }
                }
            }
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

