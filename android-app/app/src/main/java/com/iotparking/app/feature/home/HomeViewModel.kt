package com.iotparking.app.feature.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.iotparking.app.core.data.repository.AuthRepository
import com.iotparking.app.core.data.repository.LotRepository
import com.iotparking.app.core.data.repository.ReservationRepository
import com.iotparking.app.core.data.repository.SessionRepository
import com.iotparking.app.core.domain.model.Lot
import com.iotparking.app.core.domain.model.Reservation
import com.iotparking.app.core.domain.model.Session
import com.iotparking.app.core.domain.model.VehicleType
import com.iotparking.app.core.location.LocationService
import com.iotparking.app.core.location.UserLocation
import com.iotparking.app.core.network.NetworkMonitor
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class SortOption { NEAREST, CHEAPEST, MOST_AVAILABLE }

data class FilterOptions(
    val maxPrice: Long? = null,
    val maxDistanceMeters: Double? = null,
    val vehicleType: VehicleType? = null,
    val hasRoof: Boolean? = null,
    val hasEv: Boolean? = null,
    val onlyAvailable: Boolean = false,
    val sortBy: SortOption = SortOption.NEAREST
)

data class HomeUiState(
    val lots: List<Lot> = emptyList(),
    val filteredLots: List<Lot> = emptyList(),
    val selectedLot: Lot? = null,
    val userLocation: UserLocation? = null,
    val activeReservation: Reservation? = null,
    val activeSession: Session? = null,
    val isOffline: Boolean = false,
    val searchQuery: String = "",
    val filters: FilterOptions = FilterOptions(),
    val isFilterSheetVisible: Boolean = false,
    val isLoading: Boolean = false
)

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val lotRepository: LotRepository,
    private val reservationRepository: ReservationRepository,
    private val sessionRepository: SessionRepository,
    private val authRepository: AuthRepository,
    private val locationService: LocationService,
    private val networkMonitor: NetworkMonitor
) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    init {
        observeNetwork()
        observeLots()
        observeUserActivities()
        fetchLocation()
    }

    private fun observeNetwork() {
        viewModelScope.launch {
            networkMonitor.isOnline.collect { online ->
                _uiState.update { it.copy(isOffline = !online) }
            }
        }
    }

    private fun observeLots() {
        viewModelScope.launch {
            lotRepository.getAllLotsStream().collect { allLots ->
                _uiState.update { state ->
                    val filtered = applyFilters(allLots, state.searchQuery, state.filters, state.userLocation)
                    state.copy(lots = allLots, filteredLots = filtered)
                }
            }
        }
    }

    private fun observeUserActivities() {
        val uid = authRepository.currentUserId ?: return
        viewModelScope.launch {
            reservationRepository.getActiveReservationStream(uid).collect { res ->
                _uiState.update { it.copy(activeReservation = res) }
            }
        }
        viewModelScope.launch {
            sessionRepository.getActiveSessionStream(uid).collect { session ->
                _uiState.update { it.copy(activeSession = session) }
            }
        }
    }

    fun fetchLocation() {
        viewModelScope.launch {
            val location = locationService.getCurrentLocation()
            _uiState.update { state ->
                val filtered = applyFilters(state.lots, state.searchQuery, state.filters, location)
                state.copy(userLocation = location, filteredLots = filtered)
            }
        }
    }

    fun onSearchQueryChanged(query: String) {
        _uiState.update { state ->
            val filtered = applyFilters(state.lots, query, state.filters, state.userLocation)
            state.copy(searchQuery = query, filteredLots = filtered)
        }
    }

    fun onLotSelected(lot: Lot?) {
        _uiState.update { it.copy(selectedLot = lot) }
    }

    fun setFilterSheetVisible(visible: Boolean) {
        _uiState.update { it.copy(isFilterSheetVisible = visible) }
    }

    fun applyFilterOptions(filters: FilterOptions) {
        _uiState.update { state ->
            val filtered = applyFilters(state.lots, state.searchQuery, filters, state.userLocation)
            state.copy(filters = filters, filteredLots = filtered, isFilterSheetVisible = false)
        }
    }

    fun calculateDistance(lot: Lot): String? {
        val userLoc = _uiState.value.userLocation ?: return null
        val distance = locationService.calculateDistanceMeters(
            userLoc.latitude, userLoc.longitude,
            lot.latitude, lot.longitude
        )
        return locationService.formatDistance(distance)
    }

    private fun applyFilters(
        lots: List<Lot>,
        query: String,
        filters: FilterOptions,
        userLoc: UserLocation?
    ): List<Lot> {
        var result = lots

        if (query.isNotBlank()) {
            result = result.filter {
                it.name.contains(query, ignoreCase = true) || it.address.contains(query, ignoreCase = true)
            }
        }

        if (filters.onlyAvailable) {
            result = result.filter { it.availableSlots > 0 }
        }

        if (filters.hasRoof == true) {
            result = result.filter { it.hasRoof }
        }

        if (filters.hasEv == true) {
            result = result.filter { it.hasEv }
        }

        if (filters.vehicleType != null) {
            result = result.filter { it.vehicleTypes.contains(filters.vehicleType) }
        }

        if (filters.maxPrice != null) {
            result = result.filter { it.pricePerBlock <= filters.maxPrice }
        }

        // Sorting
        result = when (filters.sortBy) {
            SortOption.CHEAPEST -> result.sortedBy { it.pricePerBlock }
            SortOption.MOST_AVAILABLE -> result.sortedByDescending { it.availableSlots }
            SortOption.NEAREST -> {
                if (userLoc != null) {
                    result.sortedBy {
                        locationService.calculateDistanceMeters(
                            userLoc.latitude, userLoc.longitude,
                            it.latitude, it.longitude
                        )
                    }
                } else result
            }
        }

        return result
    }
}

