package com.iotparking.app.feature.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.iotparking.app.R
import com.iotparking.app.core.designsystem.component.ParkingPrimaryButton
import com.iotparking.app.core.designsystem.component.ParkingSecondaryButton
import com.iotparking.app.core.domain.model.VehicleType

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun FilterSheet(
    currentFilters: FilterOptions,
    onApply: (FilterOptions) -> Unit,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var onlyAvailable by remember { mutableStateOf(currentFilters.onlyAvailable) }
    var hasRoof by remember { mutableStateOf(currentFilters.hasRoof ?: false) }
    var hasEv by remember { mutableStateOf(currentFilters.hasEv ?: false) }
    var selectedVehicleType by remember { mutableStateOf(currentFilters.vehicleType) }
    var sortBy by remember { mutableStateOf(currentFilters.sortBy) }
    var maxPrice by remember { mutableStateOf(currentFilters.maxPrice?.toFloat() ?: 30000f) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
                .padding(bottom = 32.dp)
                .verticalScroll(rememberScrollState())
        ) {
            Text(
                text = stringResource(R.string.filter_title),
                style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold)
            )

            Spacer(modifier = Modifier.height(20.dp))

            // Sắp xếp
            Text(text = "Sắp xếp theo", style = MaterialTheme.typography.titleSmall)
            Spacer(modifier = Modifier.height(8.dp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = sortBy == SortOption.NEAREST,
                    onClick = { sortBy = SortOption.NEAREST },
                    label = { Text("Gần nhất") }
                )
                FilterChip(
                    selected = sortBy == SortOption.CHEAPEST,
                    onClick = { sortBy = SortOption.CHEAPEST },
                    label = { Text("Giá rẻ nhất") }
                )
                FilterChip(
                    selected = sortBy == SortOption.MOST_AVAILABLE,
                    onClick = { sortBy = SortOption.MOST_AVAILABLE },
                    label = { Text("Nhiều chỗ nhất") }
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Mức giá tối đa
            Text(
                text = "Mức giá tối đa: ${maxPrice.toInt()}đ / 30p",
                style = MaterialTheme.typography.titleSmall
            )
            Slider(
                value = maxPrice,
                onValueChange = { maxPrice = it },
                valueRange = 5000f..50000f,
                steps = 8
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Tiện ích toggles
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(text = "Chỉ bãi còn chỗ trống", style = MaterialTheme.typography.bodyMedium)
                Switch(checked = onlyAvailable, onCheckedChange = { onlyAvailable = it })
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(text = "Có mái che", style = MaterialTheme.typography.bodyMedium)
                Switch(checked = hasRoof, onCheckedChange = { hasRoof = it })
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(text = "Có sạc xe điện (EV)", style = MaterialTheme.typography.bodyMedium)
                Switch(checked = hasEv, onCheckedChange = { hasEv = it })
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Action Buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                ParkingSecondaryButton(
                    text = "Đặt lại",
                    onClick = {
                        onlyAvailable = false
                        hasRoof = false
                        hasEv = false
                        selectedVehicleType = null
                        sortBy = SortOption.NEAREST
                        maxPrice = 30000f
                    },
                    modifier = Modifier.weight(1f)
                )
                ParkingPrimaryButton(
                    text = "Áp dụng",
                    onClick = {
                        onApply(
                            FilterOptions(
                                maxPrice = maxPrice.toLong(),
                                vehicleType = selectedVehicleType,
                                hasRoof = if (hasRoof) true else null,
                                hasEv = if (hasEv) true else null,
                                onlyAvailable = onlyAvailable,
                                sortBy = sortBy
                            )
                        )
                    },
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}

