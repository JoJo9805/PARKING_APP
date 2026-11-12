package com.iotparking.app.feature.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.BottomSheetScaffold
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SheetValue
import androidx.compose.material3.Text
import androidx.compose.material3.rememberBottomSheetScaffoldState
import androidx.compose.material3.rememberStandardBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.MapUiSettings
import com.google.maps.android.compose.Marker
import com.google.maps.android.compose.MarkerState
import com.google.maps.android.compose.rememberCameraPositionState
import com.iotparking.app.R
import com.iotparking.app.core.designsystem.component.ActiveBanner
import com.iotparking.app.core.designsystem.component.EmptyState
import com.iotparking.app.core.designsystem.component.OfflineBanner
import com.iotparking.app.core.domain.model.Lot

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    viewModel: HomeViewModel,
    onNavigateToLotDetail: (String) -> Unit,
    onNavigateToActiveReservation: (String) -> Unit,
    onNavigateToActiveSession: (String) -> Unit
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    // Default to Ho Chi Minh City or user's location
    val defaultLocation = LatLng(10.7769, 106.7009)
    val mapCenter = if (uiState.userLocation != null) {
        LatLng(uiState.userLocation!!.latitude, uiState.userLocation!!.longitude)
    } else defaultLocation

    val cameraPositionState = rememberCameraPositionState {
        position = CameraPosition.fromLatLngZoom(mapCenter, 14f)
    }

    val sheetState = rememberStandardBottomSheetState(
        initialValue = SheetValue.PartiallyExpanded
    )
    val scaffoldState = rememberBottomSheetScaffoldState(bottomSheetState = sheetState)

    BottomSheetScaffold(
        scaffoldState = scaffoldState,
        sheetPeekHeight = 220.dp,
        sheetShape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
        sheetContainerColor = MaterialTheme.colorScheme.background,
        sheetContent = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
            ) {
                Text(
                    text = "Bãi đỗ xe gần bạn (${uiState.filteredLots.size})",
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.padding(vertical = 8.dp)
                )

                if (uiState.filteredLots.isEmpty()) {
                    EmptyState(
                        title = "Không tìm thấy bãi đỗ xe",
                        description = "Thử thay đổi từ khóa hoặc bộ lọc tìm kiếm",
                        modifier = Modifier.padding(vertical = 24.dp)
                    )
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(bottom = 80.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        items(uiState.filteredLots, key = { it.id }) { lot ->
                            LotCard(
                                lot = lot,
                                distanceText = viewModel.calculateDistance(lot),
                                onClick = { onNavigateToLotDetail(lot.id) },
                                modifier = Modifier.padding(vertical = 6.dp)
                            )
                        }
                    }
                }
            }
        }
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            // Google Map View
            GoogleMap(
                modifier = Modifier.fillMaxSize(),
                cameraPositionState = cameraPositionState,
                uiSettings = MapUiSettings(
                    myLocationButtonEnabled = false,
                    zoomControlsEnabled = false
                )
            ) {
                uiState.filteredLots.forEach { lot ->
                    Marker(
                        state = MarkerState(position = LatLng(lot.latitude, lot.longitude)),
                        title = lot.name,
                        snippet = "Còn ${lot.availableSlots}/${lot.totalSlots} chỗ • ${lot.pricePerBlock}đ/30p",
                        onClick = {
                            viewModel.onLotSelected(lot)
                            false
                        }
                    )
                }
            }

            // Top Overlay: OfflineBanner, ActiveBanner, Search Bar
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.TopCenter)
            ) {
                OfflineBanner(isOffline = uiState.isOffline)

                // Active Reservation Banner
                uiState.activeReservation?.let { res ->
                    ActiveBanner(
                        title = "Đang giữ chỗ tại ${res.lotName}",
                        subtitle = "Ô đỗ ${res.slotId} • Chạm để xem chi tiết",
                        isReservation = true,
                        onClick = { onNavigateToActiveReservation(res.id) }
                    )
                }

                // Active Session Banner
                uiState.activeSession?.let { session ->
                    ActiveBanner(
                        title = "Xe đang đỗ tại ${session.lotName}",
                        subtitle = "Ô đỗ ${session.actualSlotId ?: session.assignedSlotId ?: ""} • Chạm để xem",
                        isReservation = false,
                        onClick = { onNavigateToActiveSession(session.id) }
                    )
                }

                // Search Bar + Filter Icon
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp)
                ) {
                    OutlinedTextField(
                        value = uiState.searchQuery,
                        onValueChange = viewModel::onSearchQueryChanged,
                        placeholder = { Text("Tìm kiếm bãi đỗ xe, địa chỉ...") },
                        leadingIcon = {
                            Icon(Icons.Default.Search, contentDescription = null)
                        },
                        trailingIcon = {
                            IconButton(onClick = { viewModel.setFilterSheetVisible(true) }) {
                                Icon(Icons.Default.FilterList, contentDescription = "Bộ lọc")
                            }
                        },
                        singleLine = true,
                        shape = RoundedCornerShape(24.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(MaterialTheme.colorScheme.surface, RoundedCornerShape(24.dp))
                    )
                }
            }

            // My Location FAB
            FloatingActionButton(
                onClick = { viewModel.fetchLocation() },
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(end = 16.dp, bottom = 240.dp),
                containerColor = MaterialTheme.colorScheme.surface
            ) {
                Icon(Icons.Default.MyLocation, contentDescription = "Vị trí của tôi")
            }

            // Filter Bottom Sheet
            if (uiState.isFilterSheetVisible) {
                FilterSheet(
                    currentFilters = uiState.filters,
                    onApply = viewModel::applyFilterOptions,
                    onDismiss = { viewModel.setFilterSheetVisible(false) }
                )
            }
        }
    }
}

